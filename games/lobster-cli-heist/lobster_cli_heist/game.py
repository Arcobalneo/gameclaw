from __future__ import annotations

import argparse
import random
import textwrap

from typing import Sequence

from lobster_cli_heist import __version__
from lobster_cli_heist.content import PROFILES, profile_by_index
from lobster_cli_heist.observer import ObserverServer
from lobster_cli_heist.render import render_compact_view, render_resolution
from lobster_cli_heist.report import ObserverPage, SettlementReport, render_observer_html, settlement_report_path, write_settlement_report
from lobster_cli_heist.simulation import (
    GameState,
    available_actions,
    build_final_notes,
    build_forecast_lines,
    build_note_lines,
    build_score,
    build_status_lines,
    build_threat_lines,
    build_game_state,
    gear_options,
    interact_options,
    render_map_rows,
    shift_options,
    take_action,
)

WRAP = 82


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


def print_title(verbose_text: bool = False) -> None:
    print("横着潜：只给龙虾玩的 CLI 潜行渗透")
    if verbose_text:
        print(wrap("你不是来清图的。你是一个龙虾渗透手，要读懂视线、操纵噪音、拿到目标，再在设施彻底锁死前横着撤出去。"))


def print_rules() -> None:
    print(wrap("每回合你通常只做 1 个主动作：Shift、Observe、Hide / Wait、Interact 或 Gear。潜入段和带货撤离段是两套不同节奏。"))
    print(wrap("默认会启动一个本地 localhost observer 页面，供人类旁观 agent 进度；游戏结束后会把最终局面写成静态 HTML 结算页。"))


def choose_profile(provider: InputProvider, scripted_index: int | None = None, *, verbose_text: bool = False):
    if scripted_index is not None:
        profile = profile_by_index(scripted_index)
        print(f"Profile> {scripted_index} [preset]")
        print(f"你直接带着【{profile.title}】入场。")
        return profile
    print("请选择 profile：")
    for index, profile in enumerate(PROFILES, start=1):
        print(f"{index}. {profile.title} · {profile.subtitle}")
        if verbose_text:
            print(f"   {wrap(profile.blurb)}")
    choice = prompt_choice(provider, "Profile> ", ["1", "2", "3"])
    profile = profile_by_index(int(choice))
    print(f"你这轮带的是【{profile.title}】。")
    return profile


def parse_script(script: str | None) -> list[str] | None:
    if script is None:
        return None
    return [item.strip() for item in script.split(",") if item.strip()]


def pick_seed(requested: int | None) -> int:
    if requested is not None:
        return requested
    return random.randint(1, 999_999)


def build_observer_page(state: GameState) -> ObserverPage:
    package_line = (
        f"{state.mission.facility.title} / {state.mission.security.title} / "
        f"{state.mission.objective.title} / {state.mission.complication.title}"
    )
    events = state.recent_events[-8:] or list(state.mission.briefing_lines[-2:])
    return ObserverPage(
        title="横着潜：只给龙虾玩的 CLI 潜行渗透",
        subtitle=f"当前任务：{state.mission.title}",
        package_line=package_line,
        status_lines=build_status_lines(state),
        board_rows=render_map_rows(state),
        threat_lines=build_threat_lines(state),
        forecast_lines=build_forecast_lines(state),
        recent_events=events,
        footer="Local observer only. CLI remains canonical. Refreshes every second.",
    )


def print_snapshot(state: GameState, observer_url: str) -> None:
    title = "横着潜：只给龙虾玩的 CLI 潜行渗透"
    subtitle = f"Observer：{observer_url}"
    header_lines = build_status_lines(state) + [
        f"Package：{state.mission.facility.title} / {state.mission.security.title} / {state.mission.objective.title} / {state.mission.complication.title}",
        f"Profile 被动：{state.profile.passive_summary}",
    ]
    snapshot = render_compact_view(
        title=title,
        subtitle=subtitle,
        header_lines=header_lines,
        map_rows=render_map_rows(state),
        threat_lines=build_threat_lines(state),
        forecast_lines=build_forecast_lines(state),
        note_lines=build_note_lines(state),
    )
    print(snapshot)


def prompt_option(provider: InputProvider, prompt: str, options: Sequence) -> str:
    if not options:
        raise ValueError("no options available")
    valid = [str(index) for index in range(1, len(options) + 1)]
    while True:
        for index, option in enumerate(options, start=1):
            print(f"{index}. {option.label} · {option.summary}")
        choice = prompt_choice(provider, prompt, valid)
        return options[int(choice) - 1].code


def conclude_run(state: GameState, *, ending: str, cause: str, settlement_report: bool) -> int:
    score = build_score(state, ending)
    notes = build_final_notes(state, ending=ending, cause=cause)
    print("")
    print(f"结局：{cause}")
    print(f"战绩：{score}")
    for note in notes:
        print(f"- {note}")
    if settlement_report:
        report = SettlementReport(
            ending=ending,
            title=f"龙虾潜行{ '成功' if ending == 'won' else '结算' }",
            seed=state.seed,
            profile_name=state.profile.title,
            mission_name=state.mission.title,
            package_line=f"{state.mission.facility.title} / {state.mission.security.title} / {state.mission.objective.title} / {state.mission.complication.title}",
            turns=state.turns,
            alert=state.alert,
            exposure_peak=state.exposure_peak,
            score=score,
            cause=cause,
            final_notes=notes,
            board_rows=render_map_rows(state),
            status_lines=build_status_lines(state),
            key_events=state.history[-12:],
            report_path=settlement_report_path(state.profile.key, state.seed, ending=ending, turns=state.turns),
        )
        path = write_settlement_report(report)
        print(f"HTML 结算页：{path}")
    return 0


def conclude_input_exhaustion(state: GameState, *, reason: str, settlement_report: bool) -> int:
    cause = f"{reason} 本轮先在这里收壳：这不算胜利，也不假装你已经潜出去了。"
    return conclude_run(state, ending="aborted", cause=cause, settlement_report=settlement_report)


def run_mission(
    *,
    seed: int,
    profile_index: int | None,
    provider: InputProvider,
    verbose_text: bool = False,
    settlement_report: bool = True,
    observer_port_start: int = 8000,
) -> int:
    profile = choose_profile(provider, profile_index, verbose_text=verbose_text)
    state = build_game_state(seed, profile)
    print(f"Seed> {seed}")
    if verbose_text:
        print(wrap(state.mission.facility.brief))
    print(wrap("Mission brief:"))
    for line in state.mission.briefing_lines:
        print(f"- {line}")
    observer: ObserverServer | None = None
    try:
        observer = ObserverServer(port_start=observer_port_start)
        observer.start(render_observer_html(build_observer_page(state)))
    except RuntimeError as exc:
        print(f"Observer 启动失败：{exc}")
        return 1

    print(f"Live observer: {observer.url}")

    try:
        while True:
            print("")
            print_snapshot(state, observer.url)
            observer.publish(render_observer_html(build_observer_page(state)))

            actions = available_actions(state)
            print("")
            print("可选动作：")
            for index, action in enumerate(actions, start=1):
                print(f"{index}. {action.label} · {action.summary}")
            action_choice = prompt_choice(provider, "Action> ", [str(index) for index in range(1, len(actions) + 1)])
            action = actions[int(action_choice) - 1]
            option_code: str | None = None
            if action.code == "shift":
                option_code = prompt_option(provider, "Shift> ", shift_options(state))
            elif action.code == "interact":
                option_code = prompt_option(provider, "Interact> ", interact_options(state))
            elif action.code == "gear":
                option_code = prompt_option(provider, "Gear> ", gear_options(state))

            result = take_action(state, action.code, option_code)
            observer.publish(render_observer_html(build_observer_page(state)))
            print("")
            print(render_resolution(title=f"Turn {state.turns} 结果", events=result.events, footer=build_status_lines(state)[2]))
            if result.ended:
                return conclude_run(state, ending=result.ending or "lost", cause=result.cause or "设施把你收掉了。", settlement_report=settlement_report)
    except InputExhausted as exc:
        return conclude_input_exhaustion(state, reason=str(exc), settlement_report=settlement_report)
    finally:
        if observer is not None:
            observer.stop()


def menu_loop(args: argparse.Namespace) -> int:
    provider = InputProvider(parse_script(args.script))
    seed = pick_seed(args.seed)
    if args.quick_start:
        return run_mission(
            seed=seed,
            profile_index=args.profile,
            provider=provider,
            verbose_text=args.verbose_text,
            settlement_report=args.settlement_report,
            observer_port_start=args.observer_port_start,
        )

    print_title(verbose_text=args.verbose_text)
    while True:
        print("")
        print("1. 开始一轮")
        print("2. 看规则")
        print("0. 收壳")
        choice = prompt_choice(provider, "Menu> ", ["1", "2", "0"])
        if choice == "0":
            print("先收壳，下回再潜。")
            return 0
        if choice == "2":
            print_rules()
            continue
        return run_mission(
            seed=seed,
            profile_index=args.profile,
            provider=provider,
            verbose_text=args.verbose_text,
            settlement_report=args.settlement_report,
            observer_port_start=args.observer_port_start,
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lobster-cli-heist",
        description=(
            "一款 compact-first、CLI-first、只给龙虾玩的潜行渗透。\n\n"
            "示例：\n"
            "  lobster-cli-heist --quick-start\n"
            "  lobster-cli-heist --quick-start --profile 2 --seed 7\n"
            "  lobster-cli-heist --quick-start --profile 3 --script 1,1,4,1,1,2\n"
            "  lobster-cli-heist --quick-start --no-settlement-report\n\n"
            "Observer 说明：默认会从 localhost:8000 起自动寻找空闲端口，启动实时 HTML observer 页面；局结束后 server 会停止，并留下静态 HTML 结算页。"
        ),
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument("--seed", type=int, help="固定随机种子。")
    parser.add_argument("--quick-start", action="store_true", help="直接开始一轮，跳过主菜单。")
    parser.add_argument("--profile", type=int, choices=[1, 2, 3], help="预选 profile（1~3）。")
    parser.add_argument("--script", help="逗号分隔的脚本化输入，例如 1,2,1,3；脚本耗尽时会按中止结算收尾。")
    parser.add_argument("--verbose-text", action="store_true", help="切回更长说明文案；默认使用节省 token 的紧凑模式。")
    parser.add_argument("--no-settlement-report", dest="settlement_report", action="store_false", help="关闭每局结束后自动生成的 HTML 结算报告。")
    parser.add_argument("--settlement-report", dest="settlement_report", action="store_true", help="显式开启 HTML 结算报告（默认开启）。")
    parser.add_argument("--observer-port-start", type=int, default=8000, help="从这个端口开始寻找 observer 页可用端口（默认 8000）。")
    parser.set_defaults(settlement_report=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return menu_loop(args)


if __name__ == "__main__":
    raise SystemExit(main())
