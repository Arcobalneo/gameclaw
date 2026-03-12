from __future__ import annotations

import argparse
import random
import textwrap

from dataclasses import dataclass, field
from typing import Sequence

from lobster_cli_tower_defense import __version__
from lobster_cli_tower_defense.content import (
    DOCTRINES,
    ENEMIES,
    LANE_SHORT,
    LANE_TITLES,
    LANES,
    NODE_TITLES,
    PATHS,
    SLOT_ORDER,
    SLOTS,
    STAGE_BLURB,
    STAGE_TITLE,
    UNITS,
    UNIT_ORDER,
    Doctrine,
    EnemyType,
    Slot,
    UnitType,
    build_wave_plan,
)
from lobster_cli_tower_defense.render import render_compact_view, render_resolution
from lobster_cli_tower_defense.report import (
    SettlementReport,
    settlement_report_path,
    write_settlement_report,
)

WRAP = 78


@dataclass
class Enemy:
    uid: int
    enemy_key: str
    lane: str
    position_index: int
    current_hp: int
    slowed: int = 0
    exposed: int = 0

    @property
    def kind(self) -> EnemyType:
        return ENEMIES[self.enemy_key]

    @property
    def node_id(self) -> str:
        return PATHS[self.lane][self.position_index]


@dataclass
class UnitState:
    unit_key: str
    current_hp: int
    slot_key: str | None = None
    ready_pulse: int = 1
    duration_left: int | None = None
    damage_done: int = 0
    kills: int = 0
    deployments: int = 0
    recalls: int = 0
    defeats: int = 0
    last_slot: str | None = None

    @property
    def template(self) -> UnitType:
        return UNITS[self.unit_key]


@dataclass
class GameState:
    seed: int
    doctrine: Doctrine
    wave_plan: list[tuple]
    pulse: int
    tide: int
    integrity: int
    max_integrity: int
    roster: dict[str, UnitState]
    enemies: list[Enemy] = field(default_factory=list)
    leaks: int = 0
    total_kills: int = 0
    next_enemy_uid: int = 1
    lane_leaks: dict[str, int] = field(default_factory=dict)
    first_leak: dict[str, tuple[int, str] | None] = field(default_factory=dict)
    run_notes: list[str] = field(default_factory=list)
    skill_ready_pulse: int = 1
    skill_uses: int = 0
    crusher_skill_slot: str | None = None
    oracle_skill_lane: str | None = None
    last_break_lane: str | None = None
    last_break_enemy: str | None = None


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


def push_run_note(notes: list[str], note: str, *, limit: int = 6) -> None:
    if note in notes:
        notes.remove(note)
    notes.append(note)
    if len(notes) > limit:
        del notes[:-limit]


def prompt_choice(provider: InputProvider, prompt: str, valid: Sequence[str]) -> str:
    while True:
        choice = provider.get(prompt)
        if choice in valid:
            return choice
        print(f"只认这些选项：{' / '.join(valid)}")


def doctrine_by_index(index: int) -> Doctrine:
    return DOCTRINES[index - 1]


def skill_cooldown_remaining(state: GameState) -> int:
    return max(0, state.skill_ready_pulse - state.pulse)


def unit_cost(doctrine: Doctrine, unit_key: str) -> int:
    template = UNITS[unit_key]
    return max(1, template.cost - doctrine.discounts.get(unit_key, 0))


def unit_max_hp(doctrine: Doctrine, unit_key: str) -> int:
    template = UNITS[unit_key]
    hp = template.max_hp
    if template.block > 0:
        hp += doctrine.blocker_hp_bonus
    return hp


def unit_attack(doctrine: Doctrine, unit_key: str) -> int:
    template = UNITS[unit_key]
    attack = template.attack
    if unit_key in {"whisker-scout", "salt-spray"}:
        attack += doctrine.support_attack_bonus
    return attack


def unit_duration(doctrine: Doctrine, unit_key: str) -> int | None:
    template = UNITS[unit_key]
    if template.duration is None:
        return None
    return template.duration + doctrine.decoy_duration_bonus


def unit_redeploy_cooldown(doctrine: Doctrine, unit_key: str) -> int:
    template = UNITS[unit_key]
    return max(1, template.redeploy_cooldown + doctrine.redeploy_cooldown_delta)


def build_game_state(seed: int, doctrine: Doctrine) -> GameState:
    roster = {
        unit_key: UnitState(unit_key=unit_key, current_hp=unit_max_hp(doctrine, unit_key))
        for unit_key in UNIT_ORDER
    }
    return GameState(
        seed=seed,
        doctrine=doctrine,
        wave_plan=build_wave_plan(seed),
        pulse=1,
        tide=doctrine.starting_tide,
        integrity=doctrine.starting_integrity,
        max_integrity=doctrine.starting_integrity,
        roster=roster,
        lane_leaks={lane: 0 for lane in LANES},
        first_leak={lane: None for lane in LANES},
    )


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


def slot_title(slot_key: str) -> str:
    return SLOTS[slot_key].title


def current_entries(state: GameState, offset: int) -> tuple:
    index = state.pulse - 1 + offset
    if 0 <= index < len(state.wave_plan):
        return state.wave_plan[index]
    return ()


def summarize_spawn_entries(entries: Sequence) -> str:
    if not entries:
        return "无新敌潮"
    parts: list[str] = []
    for entry in entries:
        enemy = ENEMIES[entry.enemy_key]
        parts.append(f"{LANE_SHORT[entry.lane]}【{enemy.title}】x{entry.count}")
    return "；".join(parts)


def build_forecast_lines(state: GameState) -> list[str]:
    labels = ["- 本 pulse 入潮：", "- 下 pulse：", "- 再下 pulse："]
    lines: list[str] = []
    for offset in range(state.doctrine.forecast_depth):
        entries = current_entries(state, offset)
        if not entries and state.pulse - 1 + offset >= len(state.wave_plan):
            continue
        lines.append(f"{labels[offset]}{summarize_spawn_entries(entries)}")
    if not lines and state.enemies:
        lines.append("- 新敌潮已尽，本 pulse 只清尾波。")
    return lines


def ready_units(state: GameState) -> list[UnitState]:
    return [
        state.roster[key]
        for key in UNIT_ORDER
        if state.roster[key].slot_key is None and state.roster[key].ready_pulse <= state.pulse
    ]


def deployed_units(state: GameState) -> list[UnitState]:
    return [
        state.roster[key]
        for key in UNIT_ORDER
        if state.roster[key].slot_key is not None
    ]


def lane_has_blocker(state: GameState, lane: str) -> bool:
    front_slot = {"left": "L1", "mid": "M1", "right": "R1"}[lane]
    front_unit = state.roster_by_slot(front_slot)
    choke_unit = state.roster_by_slot("C")
    return (front_unit is not None and effective_block(state, front_unit) > 0) or (
        choke_unit is not None and effective_block(state, choke_unit) > 0
    )


def build_note_lines(state: GameState) -> list[str]:
    notes: list[str] = []
    entries = current_entries(state, 0)
    runner_lanes = {entry.lane for entry in entries if "runner" in ENEMIES[entry.enemy_key].tags}
    heavy_lanes = {entry.lane for entry in entries if ENEMIES[entry.enemy_key].weight >= 2}
    for lane in sorted(runner_lanes | heavy_lanes, key=lambda value: list(LANES).index(value)):
        if not lane_has_blocker(state, lane):
            notes.append(f"- {LANE_TITLES[lane]}当前没稳卡口，这 pulse 更容易被快潮 / 重潮穿掉。")
    if not notes:
        notes.append("- 当前前排还算完整；更值得想的是潮技和再编要不要现在交。")
    return notes


def pulse_display_label(state: GameState) -> str:
    total = len(state.wave_plan)
    if state.pulse <= total:
        return f"{state.pulse}/{total}"
    return f"{total}+尾波"


def GameState_roster_by_slot(self: GameState, slot_key: str) -> UnitState | None:
    for unit in self.roster.values():
        if unit.slot_key == slot_key:
            return unit
    return None


GameState.roster_by_slot = GameState_roster_by_slot  # type: ignore[attr-defined]


def enemies_at_node(state: GameState, node_id: str) -> list[Enemy]:
    return [enemy for enemy in state.enemies if enemy.node_id == node_id]


def short_enemy_stack(enemies: Sequence[Enemy]) -> str:
    counts: dict[str, int] = {}
    for enemy in enemies:
        counts[enemy.kind.short] = counts.get(enemy.kind.short, 0) + 1
    parts = [f"{name}{count}" for name, count in sorted(counts.items())]
    return "/".join(parts)


def node_cell(state: GameState, node_id: str) -> str:
    unit = None
    for item in state.roster.values():
        if item.slot_key and SLOTS[item.slot_key].node == node_id:
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
    rows = []
    rows.append(f"左  L0[{node_cell(state, 'L0')}] -> L1[{node_cell(state, 'L1')}] -> C[{node_cell(state, 'C')}] -> 海")
    rows.append(f"中  M0[{node_cell(state, 'M0')}] -> M1[{node_cell(state, 'M1')}] -> C[{node_cell(state, 'C')}] -> 海")
    rows.append(f"右  R0[{node_cell(state, 'R0')}] -> R1[{node_cell(state, 'R1')}] -> C[{node_cell(state, 'C')}] -> 海")
    rows.append(f"高  LP[{state.roster_by_slot('LP').template.short + str(state.roster_by_slot('LP').current_hp) if state.roster_by_slot('LP') else '.'}] | RP[{state.roster_by_slot('RP').template.short + str(state.roster_by_slot('RP').current_hp) if state.roster_by_slot('RP') else '.'}]")
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
        f"关卡：{STAGE_TITLE} | Doctrine：{state.doctrine.title} | seed {state.seed}",
        f"{phase} | Pulse {pulse_display_label(state)} | 归海线 {state.integrity}/{state.max_integrity} | 潮令 {state.tide} | 漏 {state.leaks}",
        f"潮技：{state.doctrine.skill_name} (cost {state.doctrine.skill_cost}, {skill_state})",
    ]


def render_state_screen(state: GameState, *, phase: str) -> str:
    return render_compact_view(
        title="横着守：只给龙虾玩的 CLI 塔防",
        subtitle=f"{STAGE_TITLE} · {state.doctrine.subtitle}",
        header_lines=state_header_lines(state, phase),
        map_rows=map_rows(state),
        reserve_lines=reserve_lines(state),
        forecast_lines=build_forecast_lines(state),
        note_lines=build_note_lines(state),
    )


def effective_attack(state: GameState, unit: UnitState) -> int:
    attack = unit_attack(state.doctrine, unit.unit_key)
    if state.crusher_skill_slot and unit.slot_key == state.crusher_skill_slot:
        attack += 2
    return attack


def effective_block(state: GameState, unit: UnitState) -> int:
    block = unit.template.block
    if state.crusher_skill_slot and unit.slot_key == state.crusher_skill_slot:
        block += 1
    return block


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
    free_slots = [slot for slot in selected.template.allowed_slots if state.roster_by_slot(slot) is None]
    if not free_slots:
        print("没有可放的空位了。")
        return False
    print("可放位置：")
    valid_slots = []
    for index, slot_key in enumerate(free_slots, start=1):
        slot = SLOTS[slot_key]
        print(f"{index}. {slot.key} · {slot.title}")
        valid_slots.append(str(index))
    slot_choice = prompt_choice(provider, "放到哪里> ", valid_slots)
    slot_key = free_slots[int(slot_choice) - 1]
    selected.slot_key = slot_key
    selected.current_hp = unit_max_hp(state.doctrine, selected.unit_key)
    selected.duration_left = unit_duration(state.doctrine, selected.unit_key)
    selected.last_slot = slot_key
    selected.deployments += 1
    state.tide -= cost
    print(f"【{selected.template.title}】入位 {slot_key}。")
    return True


def recall_unit(state: GameState, provider: InputProvider) -> bool:
    options = [unit for unit in deployed_units(state)]
    if not options:
        print("场上没有可撤回单位。")
        return False
    print("可撤回单位：")
    valid = []
    for index, unit in enumerate(sorted(options, key=lambda item: SLOT_ORDER.index(item.slot_key or "L1")), start=1):
        print(f"{index}. {unit.template.title} @ {unit.slot_key} | 壳 {unit.current_hp}")
        valid.append(str(index))
    choice = prompt_choice(provider, "撤回哪一项> ", valid)
    unit = sorted(options, key=lambda item: SLOT_ORDER.index(item.slot_key or "L1"))[int(choice) - 1]
    slot_key = unit.slot_key or "?"
    refund = 1 + state.doctrine.recall_refund_bonus
    state.tide += refund
    send_unit_to_cooldown(state, unit, defeated=False)
    unit.recalls += 1
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
        options = [unit for unit in deployed_units(state) if unit.slot_key in {"L1", "M1", "R1", "C"}]
        if not options:
            print("前排现在没人，碎壳顶潮没地方交。")
            return False
        print("把碎壳顶潮交给谁：")
        valid = []
        for index, unit in enumerate(sorted(options, key=lambda item: SLOT_ORDER.index(item.slot_key or "L1")), start=1):
            print(f"{index}. {unit.template.title} @ {unit.slot_key}")
            valid.append(str(index))
        choice = prompt_choice(provider, "潮技目标> ", valid)
        unit = sorted(options, key=lambda item: SLOT_ORDER.index(item.slot_key or "L1"))[int(choice) - 1]
        state.crusher_skill_slot = unit.slot_key
        target_name = f"{unit.template.title}@{unit.slot_key}"
    elif state.doctrine.key == "oracle":
        print("给哪条 lane 做预警：")
        print("1. 左盆沿")
        print("2. 中排缝")
        print("3. 右塑圈")
        choice = prompt_choice(provider, "潮技目标> ", ["1", "2", "3"])
        lane = LANES[int(choice) - 1]
        state.oracle_skill_lane = lane
        target_name = LANE_TITLES[lane]
    else:
        movers = [unit for unit in deployed_units(state)]
        if not movers:
            print("场上没人，脱壳换线交不出去。")
            return False
        print("先选要换线的单位：")
        valid = []
        movers = sorted(movers, key=lambda item: SLOT_ORDER.index(item.slot_key or "L1"))
        for index, unit in enumerate(movers, start=1):
            print(f"{index}. {unit.template.title} @ {unit.slot_key} | 壳 {unit.current_hp}")
            valid.append(str(index))
        choice = prompt_choice(provider, "换谁> ", valid)
        unit = movers[int(choice) - 1]
        free_slots = [slot for slot in unit.template.allowed_slots if state.roster_by_slot(slot) is None]
        if not free_slots:
            print("没有可换去的空位。")
            return False
        print("换到哪里：")
        valid_slots = []
        for index, slot_key in enumerate(free_slots, start=1):
            print(f"{index}. {slot_key} · {slot_title(slot_key)}")
            valid_slots.append(str(index))
        slot_choice = prompt_choice(provider, "换到> ", valid_slots)
        new_slot = free_slots[int(slot_choice) - 1]
        unit.slot_key = new_slot
        unit.last_slot = new_slot
        unit.current_hp = min(unit_max_hp(state.doctrine, unit.unit_key), unit.current_hp + 2)
        target_name = f"{unit.template.title} -> {new_slot}"
    state.tide -= state.doctrine.skill_cost
    state.skill_ready_pulse = state.pulse + state.doctrine.skill_cooldown + 1
    state.skill_uses += 1
    push_run_note(state.run_notes, f"记进 memory 的本局观察：这次把【{state.doctrine.skill_name}】交给了 {target_name}；它像翻盘窗，不等于每个 pulse 都该提前白交。")
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
    print(wrap(STAGE_BLURB))
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


def spawn_enemies(state: GameState) -> list[str]:
    entries = current_entries(state, 0)
    if not entries:
        return ["本 pulse 没有新敌潮入场。"]
    events = [f"入潮：{summarize_spawn_entries(entries)}。"]
    for entry in entries:
        for _ in range(entry.count):
            kind = ENEMIES[entry.enemy_key]
            state.enemies.append(
                Enemy(
                    uid=state.next_enemy_uid,
                    enemy_key=entry.enemy_key,
                    lane=entry.lane,
                    position_index=0,
                    current_hp=kind.max_hp,
                )
            )
            state.next_enemy_uid += 1
    return events


def apply_oracle_skill(state: GameState) -> list[str]:
    if not state.oracle_skill_lane:
        return []
    lane = state.oracle_skill_lane
    affected = 0
    for enemy in state.enemies:
        if enemy.lane == lane:
            enemy.slowed = max(enemy.slowed, 1)
            enemy.exposed += 1
            affected += 1
    return [f"{LANE_TITLES[lane]}被【{state.doctrine.skill_name}】点亮：{affected} 个目标更慢、更脆。"]


def unit_priority(unit: UnitState) -> tuple[int, int]:
    order = {
        "support": 0,
        "splash": 0,
        "ranged": 1,
        "control": 2,
        "melee": 3,
        "decoy": 4,
    }[unit.template.kind]
    return (order, SLOT_ORDER.index(unit.slot_key or "L1"))


def covered_enemies(state: GameState, unit: UnitState) -> list[Enemy]:
    if not unit.slot_key:
        return []
    slot = SLOTS[unit.slot_key]
    enemies = [enemy for enemy in state.enemies if enemy.node_id in slot.coverage]
    if unit.template.kind in {"melee", "control", "decoy"}:
        enemies = [enemy for enemy in enemies if enemy.node_id == slot.node]
    return enemies


def target_rank(enemy: Enemy) -> tuple[int, int, int]:
    return (enemy.position_index, enemy.current_hp, -enemy.uid)


def choose_target(unit: UnitState, enemies: list[Enemy]) -> Enemy | None:
    if not enemies:
        return None
    if unit.unit_key == "ring-cutter":
        armored = [enemy for enemy in enemies if "armored" in enemy.kind.tags or "elite" in enemy.kind.tags]
        if armored:
            enemies = armored
    elif unit.unit_key == "whisker-scout":
        fast = [enemy for enemy in enemies if "runner" in enemy.kind.tags or "shock" in enemy.kind.tags]
        if fast:
            enemies = fast
    return max(enemies, key=target_rank)


def damage_enemy(unit: UnitState, enemy: Enemy, amount: int, *, armor_pierce: int = 0) -> int:
    reduction = max(0, enemy.kind.armor - armor_pierce)
    actual = max(0, amount + enemy.exposed - reduction)
    enemy.current_hp -= actual
    unit.damage_done += actual
    return actual


def cleanup_dead(state: GameState, source: UnitState, events: list[str]) -> None:
    alive: list[Enemy] = []
    for enemy in state.enemies:
        if enemy.current_hp > 0:
            alive.append(enemy)
            continue
        state.total_kills += 1
        source.kills += 1
        events.append(f"{source.slot_key} {source.template.short} 收壳了【{enemy.kind.title}】。")
    state.enemies = alive


def resolve_unit_actions(state: GameState) -> list[str]:
    events: list[str] = []
    for unit in sorted(deployed_units(state), key=unit_priority):
        if not unit.slot_key:
            continue
        if unit.current_hp <= 0:
            continue
        candidates = covered_enemies(state, unit)
        if unit.unit_key == "molt-decoy" or not candidates:
            continue
        if unit.unit_key == "salt-spray":
            slot = SLOTS[unit.slot_key]
            best_node = None
            best_size = -1
            for node_id in slot.coverage:
                size = len(enemies_at_node(state, node_id))
                if size > best_size:
                    best_node = node_id
                    best_size = size
            if not best_node or best_size <= 0:
                continue
            targets = enemies_at_node(state, best_node)
            total = 0
            for enemy in targets:
                total += damage_enemy(unit, enemy, effective_attack(state, unit))
                enemy.slowed = max(enemy.slowed, unit.template.slow)
            events.append(f"{unit.slot_key} {unit.template.short} 在 {best_node} 喷出盐沫，压了 {len(targets)} 个目标。")
            cleanup_dead(state, unit, events)
            continue
        target = choose_target(unit, candidates)
        if target is None:
            continue
        dealt = damage_enemy(
            unit,
            target,
            effective_attack(state, unit),
            armor_pierce=unit.template.armor_pierce,
        )
        if unit.template.slow:
            target.slowed = max(target.slowed, unit.template.slow)
        if unit.template.expose:
            target.exposed += unit.template.expose
        if unit.template.push:
            target.position_index = max(0, target.position_index - unit.template.push)
        events.append(f"{unit.slot_key} {unit.template.short} -> 【{target.kind.title}】 {dealt}。")
        cleanup_dead(state, unit, events)
    return events


def send_unit_to_cooldown(state: GameState, unit: UnitState, *, defeated: bool) -> None:
    unit.slot_key = None
    unit.duration_left = None
    unit.current_hp = unit_max_hp(state.doctrine, unit.unit_key)
    unit.ready_pulse = state.pulse + unit_redeploy_cooldown(state.doctrine, unit.unit_key)
    if defeated:
        unit.defeats += 1


def resolve_enemy_strikes(state: GameState) -> list[str]:
    events: list[str] = []
    for slot_key in ("L1", "M1", "R1", "C"):
        unit = state.roster_by_slot(slot_key)
        if unit is None:
            continue
        node_enemies = enemies_at_node(state, SLOTS[slot_key].node)
        if not node_enemies:
            continue
        total = sum(enemy.kind.contact_damage for enemy in node_enemies)
        unit.current_hp -= total
        events.append(f"{slot_key} {unit.template.short} 吃到 {len(node_enemies)} 个目标合计 {total} 点冲击。")
        if unit.current_hp <= 0:
            threat = max(node_enemies, key=lambda enemy: (enemy.kind.contact_damage, enemy.kind.leak)).kind.title
            push_run_note(state.run_notes, f"记进 memory 的本局观察：{slot_key} 的【{unit.template.title}】被【{threat}】打穿过一次；这说明这里只靠薄前排容易崩。")
            send_unit_to_cooldown(state, unit, defeated=True)
            events.append(f"{slot_key} 的【{unit.template.title}】被拆掉，进入再编冷却。")
    return events


def is_blocked_now(state: GameState, enemy: Enemy) -> bool:
    node_id = enemy.node_id
    unit = None
    for item in deployed_units(state):
        if item.slot_key and SLOTS[item.slot_key].node == node_id and SLOTS[item.slot_key].is_path:
            unit = item
            break
    if unit is None:
        return False
    capacity = effective_block(state, unit)
    if capacity <= 0:
        return False
    occupants = sorted(
        [item for item in state.enemies if item.node_id == node_id],
        key=lambda item: item.uid,
    )
    used = 0
    for occupant in occupants:
        if used + occupant.kind.weight <= capacity:
            if occupant.uid == enemy.uid:
                return True
            used += occupant.kind.weight
            continue
        return False if occupant.uid == enemy.uid else False
    return False


def resolve_enemy_movement(state: GameState) -> list[str]:
    events: list[str] = []
    active: list[Enemy] = []
    for enemy in sorted(state.enemies, key=lambda item: (-item.position_index, item.uid)):
        escaped = False
        steps = max(0, enemy.kind.speed - enemy.slowed)
        enemy.slowed = 0
        while steps > 0:
            if is_blocked_now(state, enemy):
                break
            enemy.position_index += 1
            if enemy.position_index >= 3:
                state.integrity -= enemy.kind.leak
                state.leaks += enemy.kind.leak
                state.lane_leaks[enemy.lane] += enemy.kind.leak
                state.last_break_lane = enemy.lane
                state.last_break_enemy = enemy.kind.title
                if state.first_leak[enemy.lane] is None:
                    state.first_leak[enemy.lane] = (state.pulse, enemy.kind.title)
                    push_run_note(
                        state.run_notes,
                        f"记进 memory 的本局观察：{LANE_TITLES[enemy.lane]}在 pulse {state.pulse} 第一次漏了【{enemy.kind.title}】；下局要再验证这里是缺前排，还是只是太贪着省潮令。",
                    )
                events.append(f"【{enemy.kind.title}】从 {LANE_TITLES[enemy.lane]}漏过，归海线 -{enemy.kind.leak}。")
                escaped = True
                break
            steps -= 1
        enemy.exposed = 0
        if not escaped:
            active.append(enemy)
    state.enemies = active
    return events


def expire_duration_units(state: GameState) -> list[str]:
    events: list[str] = []
    for unit in deployed_units(state):
        if unit.duration_left is None:
            continue
        unit.duration_left -= 1
        if unit.duration_left <= 0:
            slot_key = unit.slot_key or "?"
            send_unit_to_cooldown(state, unit, defeated=False)
            events.append(f"{slot_key} 的【{unit.template.title}】撑完了这波，自动退回再编。")
    return events


def resolve_pulse(state: GameState) -> list[str]:
    events: list[str] = []
    events.extend(spawn_enemies(state))
    events.extend(apply_oracle_skill(state))
    events.extend(resolve_unit_actions(state))
    events.extend(resolve_enemy_strikes(state))
    events.extend(resolve_enemy_movement(state))
    events.extend(expire_duration_units(state))
    state.crusher_skill_slot = None
    state.oracle_skill_lane = None
    return events


def build_status_line(state: GameState) -> str:
    return (
        f"归海线 {state.integrity}/{state.max_integrity} | 潮令 {state.tide} | 漏 {state.leaks} | "
        f"Pulse {pulse_display_label(state)} | 收壳 {build_score(state)}"
    )


def build_score(state: GameState) -> int:
    return state.total_kills * 2 + state.integrity * 3 - state.leaks


def build_final_notes(state: GameState, *, ending: str) -> list[str]:
    notes = list(state.run_notes)
    if any(state.lane_leaks.values()):
        lane = max(LANES, key=lambda item: state.lane_leaks[item])
        leaked = state.lane_leaks[lane]
        if leaked > 0:
            push_run_note(
                notes,
                f"记进 memory 的本局观察：{LANE_TITLES[lane]}总共漏了 {leaked} 点完整度；如果这条线又要吃快潮又要吃精英，C 位最好别空太久。",
            )
    best_unit = max(state.roster.values(), key=lambda item: (item.damage_done, item.kills))
    if best_unit.damage_done > 0:
        push_run_note(
            notes,
            f"记进 memory 的本局观察：本局输出最高的是【{best_unit.template.title}】（{best_unit.damage_done} 伤 / {best_unit.kills} 收壳）；它更像补关键 threat 的位子，不该随手乱摆。",
        )
    if state.skill_uses > 0:
        push_run_note(
            notes,
            f"记进 memory 的本局观察：这轮【{state.doctrine.skill_name}】共用了 {state.skill_uses} 次；它更像救节奏的窗，而不是一冷却好就必须交的按钮。",
        )
    if ending == "won":
        push_run_note(notes, "记进 memory 的本局观察：这次守住了，不等于这条图已经被你解完；下局最好再换 seed 验证是不是同一套 opener 仍然稳。")
    elif ending == "lost" and state.last_break_lane and state.last_break_enemy:
        push_run_note(notes, f"记进 memory 的本局观察：最后打穿你的是 {LANE_TITLES[state.last_break_lane]}的【{state.last_break_enemy}】；下局优先验证那里是缺拦口、缺减速，还是潮技交晚了。")
    if not notes:
        notes.append("记进 memory 的本局观察：这轮还没提炼出稳定结论，下局最好先盯最先崩掉的 lane。")
    return notes[-5:]


def finalize_run_report(state: GameState, *, ending: str, cause: str) -> SettlementReport:
    title = {
        "won": "龙虾防线成功结算",
        "lost": "龙虾防线失守结算",
        "aborted": "龙虾防线中止结算",
    }[ending]
    return SettlementReport(
        ending=ending,
        title=title,
        seed=state.seed,
        doctrine_name=state.doctrine.title,
        stage_name=STAGE_TITLE,
        pulse_reached=min(state.pulse, len(state.wave_plan)),
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
            pulse_reached=min(state.pulse, len(state.wave_plan)),
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
                cause = f"归海线被打穿了。最后压垮你的是 {LANE_TITLES.get(state.last_break_lane or 'mid', '中排缝')} 的【{state.last_break_enemy or '漏怪'}】。"
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
