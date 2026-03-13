from __future__ import annotations

import argparse
import random
import textwrap

from typing import Sequence

from lobster_cli_tower_defense import __version__
from lobster_cli_tower_defense.content import DOCTRINES, ENEMIES, UNITS, UNIT_ORDER, Doctrine
from lobster_cli_tower_defense.render import render_compact_view, render_resolution
from lobster_cli_tower_defense.report import (
    SettlementReport,
    settlement_report_path,
    write_settlement_report,
)
from lobster_cli_tower_defense.simulation import (
    Enemy,
    GameState,
    UnitState,
    activate_crusher_skill,
    activate_gambler_skill,
    activate_oracle_skill,
    build_final_notes,
    build_game_state,
    build_score,
    build_status_line,
    current_entries,
    deploy_unit_to_slot,
    deployed_units,
    enemies_at_node,
    lane_has_blocker,
    pulse_display_label,
    ready_units,
    recall_unit_at_slot,
    resolve_pulse,
    skill_cooldown_remaining,
    unit_cost,
    unit_max_hp,
)

WRAP = 78


class InputExhausted(RuntimeError):
    pass


class InputProvider:
    def __init__(self, scripted: Sequence[str] | None = None) -> None:
        self.scripted_mode = scripted is not None
        self.scripted = [item.strip() for item in (scripted or []) if item.strip()]

    def get(self, prompt: str) -> str:
        if self.scripted:
            value = self.scripted.pop(0)
            print(f"{prompt}{value} [script]")
            return value
        if self.scripted_mode:
            raise InputExhausted("脚本化输入已耗尽。")
        try:
            return input(prompt).strip()
        except EOFError as exc:
            raise InputExhausted("标准输入已结束。") from exc


def wrap(text: str) -> str:
    return textwrap.fill(" ".join(text.split()), width=WRAP)


def prompt_choice(provider: InputProvider, prompt: str, valid: Sequence[str]) -> str:
    while True:
        choice = provider.get(prompt)
        if choice in valid:
            return choice
        print(f"只认这些选项：{' / '.join(valid)}")


def doctrine_by_index(index: int) -> Doctrine:
    return DOCTRINES[index - 1]


def print_title(verbose_text: bool = False) -> None:
    print("横着守：只给龙虾玩的 CLI 塔防")
    if verbose_text:
        print(wrap("厨房还在抽水，塑料环还在卡口，章鱼和电鳗也没打算讲礼貌。你现在要守住的是别的龙虾回海的线。"))


def print_rules() -> None:
    print(wrap("规则很简单：先在 setup 里布防，再让敌潮一 pulse 一 pulse 进来。每个 pulse 你通常只做 1 个关键动作，然后系统自动结算攻击、卡位、推进和漏怪。"))
    print(wrap("L1 / M1 / R1 / C 是前排位；LP / RP 是高台位。漏怪会扣归海线完整度，归零就输。默认会生成 HTML 结算页，方便之后复盘。"))


def choose_doctrine(provider: InputProvider, scripted_index: int | None = None, *, verbose_text: bool = False) -> Doctrine:
    if scripted_index is not None:
        doctrine = doctrine_by_index(scripted_index)
        print(f"Doctrine> {scripted_index} [preset]")
        print(f"你直接带着【{doctrine.title}】入场。")
        return doctrine
    print("请选择 doctrine：")
    for index, doctrine in enumerate(DOCTRINES, start=1):
        print(f"{index}. {doctrine.title} · {doctrine.subtitle}")
        if verbose_text:
            print(f"   {wrap(doctrine.blurb)}")
    choice = prompt_choice(provider, "Doctrine> ", ["1", "2", "3"])
    doctrine = doctrine_by_index(int(choice))
    print(f"你这轮带的是【{doctrine.title}】。")
    return doctrine


def summarize_spawn_entries(state: GameState, entries: Sequence) -> str:
    if not entries:
        return "无新敌潮"
    parts: list[str] = []
    for entry in entries:
        enemy = ENEMIES[entry.enemy_key]
        parts.append(f"{state.stage.lane_short[entry.lane]}【{enemy.title}】x{entry.count}")
    return "；".join(parts)


def build_forecast_lines(state: GameState) -> list[str]:
    lines: list[str] = []
    for offset in range(state.doctrine.forecast_depth):
        entries = current_entries(state, offset)
        if not entries and state.pulse - 1 + offset >= len(state.wave_plan):
            continue
        if offset < len(state.stage.forecast_labels):
            label = state.stage.forecast_labels[offset]
        else:
            label = f"- +{offset} pulse："
        lines.append(f"{label}{summarize_spawn_entries(state, entries)}")
    if not lines and state.enemies:
        lines.append("- 新敌潮已尽，本 pulse 只清尾波。")
    return lines


def build_note_lines(state: GameState) -> list[str]:
    notes: list[str] = []
    entries = current_entries(state, 0)
    runner_lanes = {entry.lane for entry in entries if "runner" in ENEMIES[entry.enemy_key].tags}
    heavy_lanes = {entry.lane for entry in entries if ENEMIES[entry.enemy_key].weight >= 2}
    lane_order = {lane: index for index, lane in enumerate(state.stage.lanes)}
    for lane in sorted(runner_lanes | heavy_lanes, key=lambda value: lane_order[value]):
        if not lane_has_blocker(state, lane):
            notes.append(f"- {state.stage.lane_titles[lane]}当前没稳卡口，这 pulse 更容易被快潮 / 重潮穿掉。")
    if not notes:
        notes.append("- 当前前排还算完整；更值得想的是潮技和再编要不要现在交。")
    return notes


def short_enemy_stack(enemies: Sequence[Enemy]) -> str:
    counts: dict[str, int] = {}
    for enemy in enemies:
        counts[enemy.kind.short] = counts.get(enemy.kind.short, 0) + 1
    parts = [f"{name}{count}" for name, count in sorted(counts.items())]
    return "/".join(parts)


def node_cell(state: GameState, node_id: str) -> str:
    unit = None
    for item in state.roster.values():
        if item.slot_key and state.stage.slots[item.slot_key].node == node_id:
            unit = item
            break
    enemies = enemies_at_node(state, node_id)
    unit_part = ""
    if unit is not None:
        unit_part = f"{unit.template.short}{unit.current_hp}"
    enemy_part = short_enemy_stack(enemies)
    if unit_part and enemy_part:
        return f"{unit_part}|{enemy_part}"
    if unit_part:
        return unit_part
    if enemy_part:
        return enemy_part
    return "."


def map_rows(state: GameState) -> list[str]:
    rows: list[str] = []
    for lane in state.stage.lanes:
        path = state.stage.paths[lane]
        rendered_nodes = [f"{node}[{node_cell(state, node)}]" for node in path[:-1]]
        rows.append(f"{state.stage.lane_short[lane]}  " + " -> ".join(rendered_nodes) + f" -> {state.stage.exit_label}")
    if state.stage.support_slots:
        cells = []
        for slot_key in state.stage.support_slots:
            unit = state.roster_by_slot(slot_key)
            unit_text = f"{unit.template.short}{unit.current_hp}" if unit is not None else "."
            cells.append(f"{slot_key}[{unit_text}]")
        rows.append(f"{state.stage.support_row_label}  " + " | ".join(cells))
    return rows


def reserve_lines(state: GameState) -> list[str]:
    active: list[str] = []
    waiting: list[str] = []
    for key in UNIT_ORDER:
        unit = state.roster[key]
        cost = unit_cost(state.doctrine, key)
        if unit.slot_key:
            active.append(f"{unit.template.short}@{unit.slot_key}")
        elif unit.ready_pulse <= state.pulse:
            waiting.append(f"{unit.template.short}({cost}) ready")
        else:
            waiting.append(f"{unit.template.short}(cd{unit.ready_pulse - state.pulse})")
    return [f"- 场上：{' | '.join(active) if active else '暂无'}", f"- 后备：{' | '.join(waiting)}"]


def state_header_lines(state: GameState, phase: str) -> list[str]:
    skill_cd = skill_cooldown_remaining(state)
    skill_state = "ready" if skill_cd == 0 else f"cd {skill_cd}"
    return [
        f"关卡：{state.stage.title} | Doctrine：{state.doctrine.title} | seed {state.seed}",
        f"{phase} | Pulse {pulse_display_label(state)} | 归海线 {state.integrity}/{state.max_integrity} | 潮令 {state.tide} | 漏 {state.leaks}",
        f"潮技：{state.doctrine.skill_name} (cost {state.doctrine.skill_cost}, {skill_state})",
    ]


def render_state_screen(state: GameState, *, phase: str) -> str:
    return render_compact_view(
        title="横着守：只给龙虾玩的 CLI 塔防",
        subtitle=f"{state.stage.title} · {state.doctrine.subtitle}",
        header_lines=state_header_lines(state, phase),
        map_rows=map_rows(state),
        reserve_lines=reserve_lines(state),
        forecast_lines=build_forecast_lines(state),
        note_lines=build_note_lines(state),
    )


def deploy_unit(state: GameState, provider: InputProvider, *, verbose_text: bool = False) -> bool:
    options = ready_units(state)
    if not options:
        print("当前没有 ready 的后备单位。")
        return False
    print("可部署单位：")
    valid = []
    for index, unit in enumerate(options, start=1):
        cost = unit_cost(state.doctrine, unit.unit_key)
        print(f"{index}. {unit.template.title} | cost {cost} | 壳 {unit_max_hp(state.doctrine, unit.unit_key)} | 拦 {unit.template.block}")
        if verbose_text:
            print(f"   {wrap(unit.template.blurb)}")
        valid.append(str(index))
    choice = prompt_choice(provider, "部署哪一项> ", valid)
    selected = options[int(choice) - 1]
    cost = unit_cost(state.doctrine, selected.unit_key)
    if state.tide < cost:
        print(f"潮令不够：{selected.template.title} 需要 {cost}，你现在只有 {state.tide}。")
        return False
    free_slots = [
        slot
        for slot in selected.template.allowed_slots
        if slot in state.stage.slots and state.roster_by_slot(slot) is None
    ]
    if not free_slots:
        print("没有可放的空位了。")
        return False
    print("可放位置：")
    valid_slots = []
    for index, slot_key in enumerate(free_slots, start=1):
        slot = state.stage.slots[slot_key]
        print(f"{index}. {slot.key} · {slot.title}")
        valid_slots.append(str(index))
    slot_choice = prompt_choice(provider, "放到哪里> ", valid_slots)
    slot_key = free_slots[int(slot_choice) - 1]
    deploy_unit_to_slot(state, selected.unit_key, slot_key)
    print(f"【{selected.template.title}】入位 {slot_key}。")
    return True


def recall_unit(state: GameState, provider: InputProvider) -> bool:
    options = [unit for unit in deployed_units(state)]
    if not options:
        print("场上没有可撤回单位。")
        return False
    print("可撤回单位：")
    valid = []
    ordered = sorted(options, key=lambda item: state.stage.slot_order.index(item.slot_key or state.stage.slot_order[0]))
    for index, unit in enumerate(ordered, start=1):
        print(f"{index}. {unit.template.title} @ {unit.slot_key} | 壳 {unit.current_hp}")
        valid.append(str(index))
    choice = prompt_choice(provider, "撤回哪一项> ", valid)
    unit = ordered[int(choice) - 1]
    slot_key = unit.slot_key or "?"
    _, refund = recall_unit_at_slot(state, slot_key)
    print(f"【{unit.template.title}】从 {slot_key} 退潮再编，返还潮令 {refund}。")
    return True


def use_doctrine_skill(state: GameState, provider: InputProvider) -> bool:
    remaining = skill_cooldown_remaining(state)
    if remaining > 0:
        print(f"潮技还在冷却：还要等 {remaining} pulse。")
        return False
    if state.tide < state.doctrine.skill_cost:
        print(f"潮令不够：潮技需要 {state.doctrine.skill_cost}，你现在只有 {state.tide}。")
        return False
    if state.doctrine.key == "crusher":
        options = [unit for unit in deployed_units(state) if unit.slot_key and state.stage.slots[unit.slot_key].is_path]
        if not options:
            print("前排现在没人，碎壳顶潮没地方交。")
            return False
        print("把碎壳顶潮交给谁：")
        valid = []
        ordered = sorted(options, key=lambda item: state.stage.slot_order.index(item.slot_key or state.stage.slot_order[0]))
        for index, unit in enumerate(ordered, start=1):
            print(f"{index}. {unit.template.title} @ {unit.slot_key}")
            valid.append(str(index))
        choice = prompt_choice(provider, "潮技目标> ", valid)
        unit = ordered[int(choice) - 1]
        target_name = f"{unit.template.title}@{unit.slot_key}"
        activate_crusher_skill(state, unit.slot_key or "")
    elif state.doctrine.key == "oracle":
        print("给哪条 lane 做预警：")
        for index, lane in enumerate(state.stage.lanes, start=1):
            print(f"{index}. {state.stage.lane_titles[lane]}")
        valid = [str(index) for index in range(1, len(state.stage.lanes) + 1)]
        choice = prompt_choice(provider, "潮技目标> ", valid)
        lane = state.stage.lanes[int(choice) - 1]
        target_name = state.stage.lane_titles[lane]
        activate_oracle_skill(state, lane)
    else:
        movers = [unit for unit in deployed_units(state)]
        if not movers:
            print("场上没人，脱壳换线交不出去。")
            return False
        print("先选要换线的单位：")
        valid = []
        movers = sorted(movers, key=lambda item: state.stage.slot_order.index(item.slot_key or state.stage.slot_order[0]))
        for index, unit in enumerate(movers, start=1):
            print(f"{index}. {unit.template.title} @ {unit.slot_key} | 壳 {unit.current_hp}")
            valid.append(str(index))
        choice = prompt_choice(provider, "换谁> ", valid)
        unit = movers[int(choice) - 1]
        free_slots = [
            slot
            for slot in unit.template.allowed_slots
            if slot in state.stage.slots and state.roster_by_slot(slot) is None
        ]
        if not free_slots:
            print("没有可换去的空位。")
            return False
        print("换到哪里：")
        valid_slots = []
        for index, slot_key in enumerate(free_slots, start=1):
            print(f"{index}. {slot_key} · {state.stage.slots[slot_key].title}")
            valid_slots.append(str(index))
        slot_choice = prompt_choice(provider, "换到> ", valid_slots)
        new_slot = free_slots[int(slot_choice) - 1]
        target_name = f"{unit.template.title} -> {new_slot}"
        activate_gambler_skill(state, unit.slot_key or "", new_slot)
    print(f"你发动了【{state.doctrine.skill_name}】，目标：{target_name}。")
    return True


def show_unit_reference(verbose_text: bool = False) -> None:
    print("单位说明：")
    for key in UNIT_ORDER:
        unit = UNITS[key]
        print(f"- {unit.title} | cost {unit.cost} | 壳 {unit.max_hp} | 攻 {unit.attack} | 拦 {unit.block}")
        if verbose_text:
            print(f"  {wrap(unit.blurb)}")


def setup_phase(state: GameState, provider: InputProvider, *, verbose_text: bool = False) -> None:
    print(wrap(state.stage.blurb))
    print(wrap(f"这张图的目标很直接：守住 {len(state.wave_plan)} 个 pulse。现在先布防，再决定什么时候放敌潮进来。"))
    while True:
        print()
        print(render_state_screen(state, phase="Setup"))
        print("动作：0 开始敌潮 | 1 新部署 | 2 撤回再编 | 3 查看单位说明")
        choice = prompt_choice(provider, "Setup> ", ["0", "1", "2", "3"])
        if choice == "0":
            return
        if choice == "1":
            deploy_unit(state, provider, verbose_text=verbose_text)
        elif choice == "2":
            recall_unit(state, provider)
        else:
            show_unit_reference(verbose_text=verbose_text)


def pulse_action_phase(state: GameState, provider: InputProvider, *, verbose_text: bool = False) -> None:
    while True:
        print()
        print(render_state_screen(state, phase="战斗"))
        print(
            "动作：0 保持阵线 | 1 新部署 | 2 撤回再编 | "
            f"3 发动潮技（{state.doctrine.skill_name}） | 4 查看单位说明"
        )
        choice = prompt_choice(provider, "Pulse> ", ["0", "1", "2", "3", "4"])
        if choice == "0":
            return
        if choice == "1" and deploy_unit(state, provider, verbose_text=verbose_text):
            return
        if choice == "2" and recall_unit(state, provider):
            return
        if choice == "3" and use_doctrine_skill(state, provider):
            return
        if choice == "4":
            show_unit_reference(verbose_text=verbose_text)


def finalize_run_report(state: GameState, *, ending: str, cause: str) -> SettlementReport:
    title = {
        "won": "龙虾防线成功结算",
        "lost": "龙虾防线失守结算",
        "aborted": "龙虾防线中止结算",
    }[ending]
    pulse_reached = min(state.pulse, len(state.wave_plan))
    return SettlementReport(
        ending=ending,
        title=title,
        seed=state.seed,
        doctrine_name=state.doctrine.title,
        stage_name=state.stage.title,
        pulse_reached=pulse_reached,
        integrity=max(state.integrity, 0),
        max_integrity=state.max_integrity,
        leaks=state.leaks,
        score=build_score(state),
        status_line=build_status_line(state),
        cause=cause,
        final_notes=build_final_notes(state, ending=ending),
        report_path=settlement_report_path(
            state.doctrine.key,
            state.seed,
            ending=ending,
            pulse_reached=pulse_reached,
        ),
    )


def print_settlement_report_notice(report: SettlementReport) -> None:
    print(f"HTML 结算报告已生成：{report.report_path}")
    print("如果你是 agent 玩家，可以把这份报告发给主人 review。")


def conclude_run(state: GameState, *, ending: str, cause: str, settlement_report: bool) -> int:
    print()
    print(wrap(cause))
    report = finalize_run_report(state, ending=ending, cause=cause)
    print("本局观察摘记：")
    for note in report.final_notes:
        print(f"- {note}")
    if settlement_report:
        path = write_settlement_report(report)
        report.report_path = path
        print_settlement_report_notice(report)
    return 0


def conclude_input_exhaustion(state: GameState, *, reason: str, settlement_report: bool) -> int:
    cause = f"{reason} 本轮先在这里收壳：这不算胜利，也不假装你已经守住了。"
    return conclude_run(state, ending="aborted", cause=cause, settlement_report=settlement_report)


def play_run(
    seed: int | None,
    provider: InputProvider,
    doctrine_index: int | None,
    *,
    verbose_text: bool = False,
    settlement_report: bool = True,
) -> int:
    actual_seed = seed if seed is not None else random.randint(1, 999_999_999)
    print_title(verbose_text=verbose_text)
    doctrine = choose_doctrine(provider, doctrine_index, verbose_text=verbose_text)
    state = build_game_state(actual_seed, doctrine)
    try:
        setup_phase(state, provider, verbose_text=verbose_text)
        while state.pulse <= len(state.wave_plan) or state.enemies:
            pulse_action_phase(state, provider, verbose_text=verbose_text)
            events = resolve_pulse(state)
            footer = f"Pulse {state.pulse} 后：归海线 {state.integrity}/{state.max_integrity} | 潮令 {state.tide} | 漏 {state.leaks}"
            print()
            print(render_resolution(title=f"Pulse {state.pulse} 结果", events=events, footer=footer))
            if state.integrity <= 0:
                fallback_lane = state.stage.lanes[min(1, len(state.stage.lanes) - 1)]
                lane = state.last_break_lane or fallback_lane
                cause = f"归海线被打穿了。最后压垮你的是 {state.stage.lane_titles.get(lane, '中排缝')} 的【{state.last_break_enemy or '漏怪'}】。"
                return conclude_run(state, ending="lost", cause=cause, settlement_report=settlement_report)
            if state.pulse >= len(state.wave_plan) and not state.enemies:
                cause = "你把这条归海侧排线守到了最后一 pulse。剩下的龙虾，今晚有路横着回海。"
                return conclude_run(state, ending="won", cause=cause, settlement_report=settlement_report)
            state.pulse += 1
            state.tide += state.doctrine.tide_per_pulse
    except InputExhausted as exc:
        return conclude_input_exhaustion(state, reason=str(exc), settlement_report=settlement_report)


def menu_loop(args: argparse.Namespace) -> int:
    provider = InputProvider(args.script.split(",") if args.script else None)
    if args.quick_start:
        return play_run(
            args.seed,
            provider,
            args.doctrine,
            verbose_text=args.verbose_text,
            settlement_report=args.settlement_report,
        )
    while True:
        print_title(verbose_text=args.verbose_text)
        print("1. 守这一关")
        print("2. 查看规则")
        print("3. 退出")
        try:
            choice = prompt_choice(provider, "菜单> ", ["1", "2", "3"])
        except InputExhausted as exc:
            print(wrap(f"{exc} 菜单没有更多输入了，这次就先收壳退出。"))
            return 0
        if choice == "1":
            play_run(
                args.seed,
                provider,
                None,
                verbose_text=args.verbose_text,
                settlement_report=args.settlement_report,
            )
        elif choice == "2":
            print_rules()
        else:
            print("愿你的壳比抽水泵更有耐心。")
            return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lobster-cli-tower-defense",
        description="横着守：只给龙虾玩的 CLI 塔防。以 pulse 为单位推进，适合 agent 玩家直接布防、复盘，并在需要时把本局 HTML 结算报告发给主人 review。",
        epilog=(
            "常用示例：\n"
            "  lobster-cli-tower-defense --quick-start\n"
            "  lobster-cli-tower-defense --quick-start --doctrine 2 --seed 7\n"
            "  lobster-cli-tower-defense --quick-start --lineage 3 --script 1,1,4,0\n"
            "  lobster-cli-tower-defense --quick-start --no-settlement-report\n"
            "\n"
            "结算报告说明：默认开启可视化 HTML 结算报告，文件会写到当前目录下的 settlement_reports/ 中。\n"
            "CLI 终端会主动提示 agent 玩家：报告已生成在哪个路径，以及可以把它发给主人 review。"
        ),
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument("--seed", type=int, help="固定随机种子，方便 agent / 人类复现同一条侧排线。")
    parser.add_argument("--quick-start", action="store_true", help="直接开始一轮，跳过主菜单。")
    parser.add_argument("--doctrine", "--lineage", dest="doctrine", type=int, choices=[1, 2, 3], help="预选 doctrine：1~3 分别对应 3 条龙虾谱系。")
    parser.add_argument("--script", help="逗号分隔的脚本化输入，例如 1,2,1,3；脚本耗尽时会按中止结算收尾，而不是抛 EOFError。")
    parser.add_argument("--verbose-text", action="store_true", help="切回更长说明文案；默认使用节省 token 的紧凑模式。")
    parser.add_argument("--no-settlement-report", dest="settlement_report", action="store_false", help="关闭每局结束后自动生成的 HTML 结算报告。")
    parser.add_argument("--settlement-report", dest="settlement_report", action="store_true", help="显式开启 HTML 结算报告（默认开启）。")
    parser.set_defaults(settlement_report=True)
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return menu_loop(args)


if __name__ == "__main__":
    raise SystemExit(main())
