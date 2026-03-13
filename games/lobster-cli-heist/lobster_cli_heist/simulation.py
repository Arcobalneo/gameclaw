from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Iterable, Sequence

from lobster_cli_heist.content import Mission, Pos, Profile, SecurityPackage, WatcherSpec, build_mission


@dataclass(frozen=True)
class Option:
    code: str
    label: str
    summary: str


@dataclass
class PatrollerState:
    index: int
    direction: int = 1


@dataclass
class TurnResult:
    ended: bool
    ending: str | None
    cause: str | None
    events: list[str]


@dataclass
class GameState:
    mission: Mission
    seed: int
    profile: Profile
    position: Pos
    turns: int = 0
    alert: int = 0
    exposure: int = 0
    exposure_peak: int = 0
    quiet_turns: int = 0
    carrying: bool = False
    objective_retrieved: bool = False
    objective_identified: bool = False
    inspected_sites: set[Pos] = field(default_factory=set)
    cache_opened: bool = False
    console_used: bool = False
    exit_unjammed: bool = False
    lockdown_timer: int | None = None
    gear_charges: int = 0
    smoke_turns: dict[Pos, int] = field(default_factory=dict)
    noise_marker: tuple[Pos, int, str] | None = None
    camera_disabled_turns: int = 0
    sensors_disabled_turns: int = 0
    observed_turns: int = 0
    responder_countdown: int | None = None
    responder_position: Pos | None = None
    patroller: PatrollerState | None = None
    watcher_facing: str | None = None
    camera_phase: int = 0
    cache_reward_applied: str | None = None
    carry_noise_discount: int = 0
    extraction_buffer: int = 0
    runner_quiet_move_ready: bool = False
    dash_guard: bool = False
    last_action: str = ""
    score: int = 0
    recent_events: list[str] = field(default_factory=list)
    history: list[str] = field(default_factory=list)


ROW_NAMES = {0: "上", 1: "下"}
FEATURE_LABELS = {
    "entry": "入水缝",
    "exit": "撤离快门",
    "console": "终端",
    "cache": "侧 stash",
    "candidate": "候选货格",
    "vent": "vent",
}


def build_game_state(seed: int, profile: Profile) -> GameState:
    mission = build_mission(seed)
    security = mission.security
    patroller = PatrollerState(index=seed % len(security.patroller.path))
    watcher_facing = security.watcher.facing if security.watcher else None
    camera_phase = seed % len(security.camera.patterns) if security.camera else 0
    objective_identified = False
    return GameState(
        mission=mission,
        seed=seed,
        profile=profile,
        position=mission.facility.entry,
        gear_charges=profile.gear_charges,
        patroller=patroller,
        watcher_facing=watcher_facing,
        camera_phase=camera_phase,
        responder_countdown=security.responder_delay,
        objective_identified=objective_identified,
        runner_quiet_move_ready=profile.key == "runner",
    )


def terrain_at(state: GameState, pos: Pos) -> str:
    return state.mission.facility.terrain_rows[pos[0]][pos[1]]


def is_within_map(pos: Pos) -> bool:
    return 0 <= pos[0] < 2 and 0 <= pos[1] < 7


def position_label(pos: Pos) -> str:
    return f"{ROW_NAMES[pos[0]]}{pos[1] + 1}"


def feature_at(state: GameState, pos: Pos) -> str | None:
    facility = state.mission.facility
    if pos == facility.entry:
        return "entry"
    if pos == facility.exit:
        return "exit"
    if pos == facility.console:
        return "console"
    if pos == facility.cache:
        return "cache"
    if pos in facility.candidates:
        return "candidate"
    if pos in facility.vent_pair:
        return "vent"
    return None


def position_title(state: GameState, pos: Pos) -> str:
    feature = feature_at(state, pos)
    if feature:
        return f"{position_label(pos)} {FEATURE_LABELS[feature]}"
    terrain = terrain_at(state, pos)
    terrain_name = {"open": "开阔格", "cover": "掩体格", "shadow": "暗格"}[terrain]
    return f"{position_label(pos)} {terrain_name}"


def candidate_display(state: GameState, pos: Pos) -> str:
    if pos == state.mission.true_objective_site and (state.objective_identified or pos in state.inspected_sites):
        return "Obj"
    if pos in state.inspected_sites and pos != state.mission.true_objective_site:
        return "Emp"
    return " ? "


def map_cell(state: GameState, pos: Pos) -> str:
    player = "L" if state.position == pos else " "
    if pos == state.mission.facility.exit:
        code = "Ex "
    elif pos == state.mission.facility.console:
        code = "Con"
    elif pos == state.mission.facility.cache:
        code = "Cac"
    elif pos in state.mission.facility.candidates:
        code = candidate_display(state, pos)
    elif pos in state.mission.facility.vent_pair:
        code = "Vnt"
    elif steam_is_active(state) and pos == state.mission.facility.steam_cell:
        code = "Stm"
    else:
        code = {"open": ".. ", "cover": "Cov", "shadow": "Shd"}[terrain_at(state, pos)]
    return f"[{player}{code}]"


def render_map_rows(state: GameState) -> list[str]:
    rows: list[str] = []
    for row in range(2):
        row_cells = " ".join(map_cell(state, (row, col)) for col in range(7))
        rows.append(f"{ROW_NAMES[row]} {row_cells}")
    return rows


def neighbors(state: GameState, pos: Pos, *, allow_vent: bool = True) -> list[Pos]:
    row, col = pos
    adjacent: list[Pos] = []
    for delta_col in (-1, 1):
        nxt = (row, col + delta_col)
        if is_within_map(nxt):
            adjacent.append(nxt)
    if col in state.mission.facility.climb_columns:
        adjacent.append((1 - row, col))
    if allow_vent and not state.carrying and pos in state.mission.facility.vent_pair:
        a, b = state.mission.facility.vent_pair
        adjacent.append(b if pos == a else a)
    return [candidate for candidate in adjacent if candidate != pos]


def occupied_threat_positions(state: GameState) -> set[Pos]:
    positions: set[Pos] = {patroller_position(state)}
    if state.responder_position is not None:
        positions.add(state.responder_position)
    return positions


def patroller_position(state: GameState) -> Pos:
    return state.mission.security.patroller.path[state.patroller.index]


def available_actions(state: GameState) -> list[Option]:
    actions = [
        Option("shift", "Shift", "推进、换线、上梯或钻 vent。"),
        Option("observe", "Observe", "看 patrol / camera 的节奏，少一点盲推。"),
        Option("wait", "Hide / Wait", "在当前格稳一拍，试着把 exposure 压回来。"),
    ]
    if interact_options(state):
        actions.append(Option("interact", "Interact", "操作终端、摸 stash、开目标或撤离。"))
    if gear_options(state):
        actions.append(Option("gear", "Gear", f"动用 {state.profile.gear_name}。"))
    return actions


def shift_options(state: GameState) -> list[Option]:
    options: list[Option] = []
    for pos in neighbors(state, state.position):
        if pos in occupied_threat_positions(state):
            continue
        move_kind = "vent 滑潜" if state.position in state.mission.facility.vent_pair and pos in state.mission.facility.vent_pair and state.position != pos else "位移"
        options.append(Option(position_label(pos), position_title(state, pos), move_kind))
    return options


def interact_options(state: GameState) -> list[Option]:
    options: list[Option] = []
    if state.position == state.mission.facility.console and not state.console_used:
        options.append(Option("console", "使用终端", "识别目标 / 压镜头 / 预开快门。"))
    if state.position == state.mission.facility.cache and not state.cache_opened:
        options.append(Option("cache", "摸侧 stash", "可能拿到更稳的路线信息，也可能拖慢节奏。"))
    if state.position in state.mission.facility.candidates and not state.objective_retrieved:
        options.append(Option("candidate", f"检查 {position_title(state, state.position)}", "真假只会有一个。赌错会推高警戒。"))
    if state.position == state.mission.facility.exit and state.carrying:
        summary = "带着目标撤离。"
        if exit_is_blocked(state):
            summary = "快门还没给你开。先想办法解闸。"
        options.append(Option("extract", "尝试撤离", summary))
    return options


def dash_destinations(state: GameState) -> list[Pos]:
    frontier = deque([(state.position, 0)])
    seen = {state.position}
    results: list[Pos] = []
    while frontier:
        pos, depth = frontier.popleft()
        if depth == 2:
            continue
        for nxt in neighbors(state, pos, allow_vent=False):
            if nxt in seen or nxt in occupied_threat_positions(state):
                continue
            seen.add(nxt)
            frontier.append((nxt, depth + 1))
            if nxt != state.position and depth + 1 <= 2:
                results.append(nxt)
    return results


def gear_options(state: GameState) -> list[Option]:
    if state.gear_charges <= 0:
        return []
    profile = state.profile.key
    if profile == "shade":
        return [Option("ink", "甩出墨幕", "原地遮一下线，顺手压低 exposure。")]
    if profile == "breaker":
        options: list[Option] = []
        if state.mission.security.camera and state.camera_disabled_turns <= 0:
            options.append(Option("camera", "钉死摄像头", "让镜头短时停摆。"))
        if state.mission.security.sensors and state.sensors_disabled_turns <= 0:
            options.append(Option("sensor", "钉死 sensor", "让压力板 / 光束先闭嘴。"))
        if exit_is_blocked(state):
            options.append(Option("shutter", "硬拆快门闸", "把卡住的撤离快门掰开。"))
        return options
    if profile == "runner":
        return [Option(position_label(pos), f"冲到 {position_title(state, pos)}", "2 格短冲刺；最适合拿完目标后硬换线。") for pos in dash_destinations(state)]
    return []


def watchers_for_state(state: GameState) -> list[WatcherSpec]:
    watchers: list[WatcherSpec] = []
    if state.mission.security.watcher:
        watchers.append(
            WatcherSpec(
                state.mission.security.watcher.title,
                state.mission.security.watcher.position,
                state.watcher_facing or state.mission.security.watcher.facing,
                state.mission.security.watcher.view_range,
            )
        )
    if state.mission.complication.mode == "extra_watcher":
        watchers.append(WatcherSpec("临时加班员", (0, 3), "right", 3))
    return watchers


def camera_cells(state: GameState) -> tuple[Pos, ...]:
    camera = state.mission.security.camera
    if not camera or state.camera_disabled_turns > 0:
        return ()
    return camera.patterns[state.camera_phase]


def sensor_cells(state: GameState) -> tuple[Pos, ...]:
    if state.sensors_disabled_turns > 0:
        return ()
    return state.mission.security.sensors


def steam_is_active(state: GameState) -> bool:
    return state.mission.complication.mode == "steam" and state.turns > 0 and state.turns % 3 == 0


def concealment_value(state: GameState, pos: Pos) -> int:
    if pos in state.smoke_turns:
        return 3
    if steam_is_active(state) and pos == state.mission.facility.steam_cell:
        return 2
    terrain = terrain_at(state, pos)
    if terrain == "shadow":
        return 1
    if terrain == "cover":
        return 1
    return 0


def exit_is_blocked(state: GameState) -> bool:
    if state.profile.key == "breaker":
        return False
    if state.mission.complication.mode != "jammed_exit":
        return False
    if not state.carrying:
        return False
    return not state.exit_unjammed


def move_noise(state: GameState, dest: Pos, *, via_dash: bool = False) -> int:
    noise = 0 if terrain_at(state, dest) == "shadow" else 1
    if steam_is_active(state) and dest == state.mission.facility.steam_cell:
        noise += 1
    if state.carrying:
        extra = state.mission.objective.carry_noise + state.mission.complication.carry_noise_bonus - state.carry_noise_discount
        if state.profile.key == "runner" and state.runner_quiet_move_ready:
            extra = max(0, extra - 1)
        noise += max(0, extra)
    if via_dash:
        noise = max(0, noise - 1)
    return noise


def watcher_sees_player(watcher: WatcherSpec, state: GameState) -> bool:
    if state.position[0] != watcher.position[0]:
        return False
    delta = state.position[1] - watcher.position[1]
    if watcher.facing == "left" and not delta < 0:
        return False
    if watcher.facing == "right" and not delta > 0:
        return False
    return abs(delta) <= watcher.view_range


def detection_pass(state: GameState) -> tuple[int, list[str]]:
    exposure_gain = 0
    events: list[str] = []
    concealment = concealment_value(state, state.position)
    dash_guard = 1 if state.dash_guard else 0
    for watcher in watchers_for_state(state):
        if watcher_sees_player(watcher, state) and concealment < 2:
            gain = max(0, 1 + (1 if state.alert >= 2 else 0) - concealment - dash_guard)
            if gain:
                exposure_gain += gain
                events.append(f"{watcher.title} 压住了 {position_label(state.position)} 的线。")
    if state.position in camera_cells(state) and concealment < 2:
        gain = max(0, 1 + (1 if state.alert >= 2 else 0) - concealment - dash_guard)
        if gain:
            exposure_gain += gain
            events.append("镜头扫过了你现在这格。")
    patrol_pos = patroller_position(state)
    if state.position[0] == patrol_pos[0] and abs(state.position[1] - patrol_pos[1]) <= 1 and concealment < 2:
        gain = max(1, 3 - concealment - dash_guard)
        exposure_gain += gain
        events.append(f"{state.mission.security.patroller.title} 从近线压了上来。")
    if state.responder_position is not None and manhattan(state.responder_position, state.position) <= 1 and concealment < 3:
        exposure_gain += 3
        events.append("快速响应者已经贴到你身边。")
    return exposure_gain, events


def shortest_step(state: GameState, start: Pos, goal: Pos) -> Pos:
    frontier = deque([start])
    prev: dict[Pos, Pos | None] = {start: None}
    while frontier:
        current = frontier.popleft()
        if current == goal:
            break
        for nxt in neighbors(state, current, allow_vent=False):
            if nxt not in prev:
                prev[nxt] = current
                frontier.append(nxt)
    if goal not in prev:
        return start
    step = goal
    while prev[step] != start and prev[step] is not None:
        step = prev[step]
    return step


def apply_noise_reaction(state: GameState, noise_pos: Pos | None, intensity: int) -> None:
    if noise_pos is None:
        return
    if state.mission.security.watcher and state.watcher_facing is not None and noise_pos[0] == state.mission.security.watcher.position[0]:
        state.watcher_facing = "left" if noise_pos[1] < state.mission.security.watcher.position[1] else "right"


def move_patroller(state: GameState) -> None:
    patrol = state.patroller
    path = state.mission.security.patroller.path
    if patrol is None:
        return
    noise = state.noise_marker
    if noise and noise[1] >= 2:
        noise_pos = noise[0]
        best_index = min(range(len(path)), key=lambda idx: manhattan(path[idx], noise_pos))
        if best_index != patrol.index:
            patrol.index += 1 if best_index > patrol.index else -1
            return
    if patrol.index + patrol.direction >= len(path) or patrol.index + patrol.direction < 0:
        patrol.direction *= -1
    patrol.index += patrol.direction


def move_responder(state: GameState) -> None:
    should_pressure = state.carrying or state.alert >= 2
    if not should_pressure:
        return
    if state.responder_position is None:
        if state.responder_countdown is None:
            state.responder_countdown = state.mission.security.responder_delay
        if state.responder_countdown > 0:
            state.responder_countdown -= 1
            return
        state.responder_position = state.mission.facility.responder_entry
        state.recent_events.append("快速响应者已经从最深处切入。")
        return
    state.responder_position = shortest_step(state, state.responder_position, state.position)


def tick_transient_effects(state: GameState) -> None:
    for pos in list(state.smoke_turns):
        state.smoke_turns[pos] -= 1
        if state.smoke_turns[pos] <= 0:
            del state.smoke_turns[pos]
    if state.camera_disabled_turns > 0:
        state.camera_disabled_turns -= 1
    if state.sensors_disabled_turns > 0:
        state.sensors_disabled_turns -= 1
    if state.observed_turns > 0:
        state.observed_turns -= 1
    if state.mission.security.camera:
        state.camera_phase = (state.camera_phase + 1) % len(state.mission.security.camera.patterns)
    state.dash_guard = False


def note_noise(state: GameState, pos: Pos | None, intensity: int, source: str) -> None:
    if pos is None or intensity <= 0:
        state.noise_marker = None
        return
    state.noise_marker = (pos, intensity, source)


def handle_sensor_trigger(state: GameState, events: list[str]) -> int:
    if state.position not in sensor_cells(state):
        return 0
    events.append("你踩到了 sensor 线，设施开始收紧。")
    state.alert = min(3, state.alert + 1)
    return 2


def take_action(state: GameState, action_code: str, option_code: str | None = None) -> TurnResult:
    state.turns += 1
    state.recent_events = []
    state.last_action = action_code
    action_noise = 0
    noise_source = ""
    fresh_pickup = False
    if action_code == "shift":
        options = {item.code: item for item in shift_options(state)}
        if option_code not in options:
            raise ValueError("invalid shift option")
        destination = decode_position(option_code)
        via_dash = False
        state.position = destination
        action_noise = move_noise(state, destination)
        noise_source = "位移"
        state.recent_events.append(f"你挪到了 {position_title(state, destination)}。")
        if state.profile.key == "runner" and state.runner_quiet_move_ready:
            state.runner_quiet_move_ready = False
    elif action_code == "observe":
        state.observed_turns = 3 if state.profile.key == "shade" else 2
        if terrain_at(state, state.position) in {"shadow", "cover"}:
            state.exposure = max(0, state.exposure - 1)
        state.recent_events.append("你停下来重新读 patrol / camera / 出口的节奏。")
    elif action_code == "wait":
        reduction = 2 if terrain_at(state, state.position) == "shadow" or state.position in state.smoke_turns else 1
        if steam_is_active(state) and state.position == state.mission.facility.steam_cell:
            reduction += 1
            action_noise += 1
            noise_source = "蒸汽"
            state.recent_events.append("蒸汽替你遮了一下线，但也嘶了一声。")
        state.exposure = max(0, state.exposure - reduction)
        state.recent_events.append("你把节奏压慢了一拍。")
    elif action_code == "interact":
        interact = {item.code: item for item in interact_options(state)}
        if option_code not in interact:
            raise ValueError("invalid interact option")
        if option_code == "console":
            state.console_used = True
            state.exit_unjammed = state.exit_unjammed or state.mission.complication.mode == "jammed_exit"
            state.objective_identified = state.objective_identified or state.mission.objective.console_reveals
            if state.mission.security.camera:
                state.camera_disabled_turns = max(state.camera_disabled_turns, 1)
            if state.profile.key != "breaker":
                action_noise = 1
                noise_source = "终端"
            state.recent_events.append("终端把目标情报和安保节奏吐给了你一部分。")
        elif option_code == "cache":
            state.cache_opened = True
            state.cache_reward_applied = state.mission.objective.cache_reward
            if state.cache_reward_applied == "intel":
                state.objective_identified = True
                state.recent_events.append("stash 里有路线纸条：你现在能直接认出真目标。")
            elif state.cache_reward_applied == "cold_sleeve":
                state.carry_noise_discount += 1
                state.recent_events.append("stash 里翻出了一截冷袖：带物脚步会轻一点。")
            elif state.cache_reward_applied == "exit_pass":
                state.extraction_buffer += 2
                if state.lockdown_timer is not None:
                    state.lockdown_timer += 2
                state.exit_unjammed = True
                state.recent_events.append("stash 里有旧通行环：撤离快门更容易打开。")
            action_noise = 1
            noise_source = "摸 stash"
        elif option_code == "candidate":
            if state.position == state.mission.true_objective_site:
                state.objective_identified = True
                state.objective_retrieved = True
                state.carrying = True
                state.lockdown_timer = state.mission.objective.extraction_window + state.profile.extraction_bonus + state.extraction_buffer
                fresh_pickup = True
                state.alert = max(state.alert, 2)
                state.recent_events.append(f"你拿到了【{state.mission.objective.title}】。现在真正的游戏才开始。")
                if state.mission.objective.console_reveals and not state.console_used:
                    action_noise += 2
                    noise_source = "硬撬冷锁"
                    state.alert = min(3, state.alert + 1)
                    state.recent_events.append("你没先过终端，冷锁直接把设施吵醒了一截。")
                if state.mission.complication.mode == "jammed_exit":
                    state.exit_unjammed = False
                    state.recent_events.append("取物后快门闸没有乖乖自己开。")
                state.runner_quiet_move_ready = state.profile.key == "runner"
                state.score += state.mission.objective.score
            else:
                state.inspected_sites.add(state.position)
                state.alert = min(3, state.alert + state.mission.objective.false_alert)
                action_noise += 2
                noise_source = "误开空格"
                state.recent_events.append("这格是空的，只留下了足够让设施收紧的动静。")
                remaining = [candidate for candidate in state.mission.facility.candidates if candidate not in state.inspected_sites]
                if len(remaining) == 1:
                    state.objective_identified = True
                    state.recent_events.append("剩下那格基本就是唯一合理的真目标了。")
        elif option_code == "extract":
            if exit_is_blocked(state):
                state.recent_events.append("你摸到了快门，但它还卡着。")
            else:
                state.score += 10
                state.recent_events.append("你带着目标横着撤出去了。")
                state.history.extend(state.recent_events)
                return TurnResult(True, "won", "你带着目标在快门彻底锁死前撤了出去。", list(state.recent_events))
    elif action_code == "gear":
        gear = {item.code: item for item in gear_options(state)}
        if option_code not in gear:
            raise ValueError("invalid gear option")
        state.gear_charges -= 1
        if state.profile.key == "shade":
            state.smoke_turns[state.position] = 2
            state.exposure = max(0, state.exposure - 2)
            state.recent_events.append("墨幕在你脚下炸开，这格短时更难被看死。")
        elif state.profile.key == "breaker":
            if option_code == "camera":
                state.camera_disabled_turns = max(state.camera_disabled_turns, 2)
                state.recent_events.append("你把摄像头钉住了两拍。")
            elif option_code == "sensor":
                state.sensors_disabled_turns = max(state.sensors_disabled_turns, 2)
                state.recent_events.append("sensor 线被你暂时钉哑了。")
            elif option_code == "shutter":
                state.exit_unjammed = True
                state.recent_events.append("你把卡涩的快门闸硬掰出了一条口。")
        elif state.profile.key == "runner":
            destination = decode_position(option_code)
            if destination not in dash_destinations(state):
                raise ValueError("invalid dash destination")
            state.position = destination
            action_noise = move_noise(state, destination, via_dash=True)
            noise_source = "冲刺"
            state.dash_guard = True
            state.runner_quiet_move_ready = False
            state.recent_events.append(f"你脱壳一冲，直接换到 {position_title(state, destination)}。")
    else:
        raise ValueError(f"unknown action: {action_code}")

    action_noise += handle_sensor_trigger(state, state.recent_events)
    note_noise(state, state.position if action_noise else None, action_noise, noise_source or action_code)

    exposure_gain, detection_events = detection_pass(state)
    state.recent_events.extend(detection_events)
    if exposure_gain:
        state.exposure += exposure_gain
        state.exposure_peak = max(state.exposure_peak, state.exposure)
        state.alert = max(state.alert, 1 if state.exposure >= 3 else state.alert)
        state.quiet_turns = 0
    elif action_noise == 0:
        state.quiet_turns += 1
    else:
        state.quiet_turns = 0

    if action_noise >= 2:
        state.alert = min(3, state.alert + 1)

    apply_noise_reaction(state, state.noise_marker[0] if state.noise_marker else None, state.noise_marker[1] if state.noise_marker else 0)
    move_patroller(state)
    move_responder(state)

    if state.responder_position is not None and manhattan(state.responder_position, state.position) == 0:
        state.recent_events.append("快速响应者直接撞上了你。")
        state.history.extend(state.recent_events)
        return TurnResult(True, "lost", "快速响应者在近线把你装箱了。", list(state.recent_events))

    if state.exposure >= 9:
        state.recent_events.append("曝光已经堆满，设施再也不需要猜你在哪。")
        state.history.extend(state.recent_events)
        return TurnResult(True, "lost", "曝光堆满后，你被设施彻底锁定。", list(state.recent_events))

    if state.alert == 1 and state.quiet_turns >= 2 and not state.carrying:
        state.alert = 0
        state.recent_events.append("你把低警戒又压回了静默线。")

    if state.lockdown_timer is not None and not fresh_pickup:
        state.lockdown_timer -= 1
        if state.lockdown_timer <= 0:
            state.recent_events.append("设施已经彻底锁死，撤离线没了。")
            state.history.extend(state.recent_events)
            return TurnResult(True, "lost", "你拿到目标了，但没能在设施锁死前撤出去。", list(state.recent_events))

    tick_transient_effects(state)
    state.history.extend(state.recent_events)
    return TurnResult(False, None, None, list(state.recent_events))


def decode_position(code: str) -> Pos:
    row_char = code[0]
    col = int(code[1:]) - 1
    row = 0 if row_char == "上" else 1
    return (row, col)


def build_forecast_lines(state: GameState) -> list[str]:
    lines = [
        f"- 巡逻下一拍大概率到 {position_label(next_patrol_position(state))}。",
    ]
    if state.mission.security.camera:
        current = ", ".join(position_label(pos) for pos in camera_cells(state)) or "停摆"
        next_phase = (state.camera_phase + 1) % len(state.mission.security.camera.patterns)
        next_cells = ", ".join(position_label(pos) for pos in state.mission.security.camera.patterns[next_phase])
        lines.append(f"- 镜头本拍扫 {current}；再下一拍扫 {next_cells}。")
    if state.lockdown_timer is not None:
        lines.append(f"- 封锁倒计时：{state.lockdown_timer} 回合。")
    elif state.observed_turns <= 0 and state.profile.key != "shade":
        lines.append("- 这拍没额外 observe 缓冲；别把 forecast 当真理。")
    return lines


def next_patrol_position(state: GameState) -> Pos:
    path = state.mission.security.patroller.path
    index = state.patroller.index + state.patroller.direction
    if index >= len(path) or index < 0:
        index = state.patroller.index - state.patroller.direction
    return path[index]


def build_threat_lines(state: GameState) -> list[str]:
    lines = [f"- {state.mission.security.patroller.title} @ {position_label(patroller_position(state))}。"]
    for watcher in watchers_for_state(state):
        arrow = "←" if watcher.facing == "left" else "→"
        lines.append(f"- {watcher.title} @ {position_label(watcher.position)} {arrow}。")
    if state.mission.security.camera:
        if state.camera_disabled_turns > 0:
            lines.append(f"- {state.mission.security.camera.title}：已停摆 {state.camera_disabled_turns} 回合。")
        else:
            cells = " / ".join(position_label(pos) for pos in camera_cells(state))
            lines.append(f"- {state.mission.security.camera.title} 当前扫线：{cells}。")
    if sensor_cells(state):
        cells = " / ".join(position_label(pos) for pos in sensor_cells(state))
        lines.append(f"- Sensor：{cells}。")
    if state.responder_position is not None:
        lines.append(f"- 快速响应者 @ {position_label(state.responder_position)}。")
    elif state.carrying or state.alert >= 2:
        lines.append(f"- 快速响应者预计 {max(0, state.responder_countdown or 0)} 回合后切入。")
    return lines


def build_status_lines(state: GameState) -> list[str]:
    objective_text = "已到手" if state.objective_retrieved else "未到手"
    return [
        f"Seed {state.seed} · {state.mission.title}",
        f"Profile：{state.profile.title} · Gear {state.profile.gear_name} {state.gear_charges}",
        f"警戒 {state.alert} | Exposure {state.exposure}/9 | 回合 {state.turns} | 目标 {objective_text}",
        f"Console：{'已用' if state.console_used else '未用'} | Cache：{'已开' if state.cache_opened else '未开'} | 快门：{'已开' if not exit_is_blocked(state) else '卡着'}",
        f"封锁：{state.lockdown_timer if state.lockdown_timer is not None else '--'} | 最近噪音：{current_noise_line(state)}",
    ]


def current_noise_line(state: GameState) -> str:
    if not state.noise_marker:
        return "没有确认的动静"
    pos, intensity, source = state.noise_marker
    return f"{position_label(pos)} · {source} · 强度 {intensity}"


def build_note_lines(state: GameState) -> list[str]:
    notes = [f"- {state.mission.objective.clue_text}"]
    if not state.objective_retrieved:
        notes.append("- vent 线大多适合进，不适合带货回。")
    else:
        notes.append("- 现在不是潜进去就算赢；倒计时会比你想的更快。")
    if state.cache_opened and state.cache_reward_applied == "cold_sleeve":
        notes.append("- 这轮已经摸到冷袖，带货脚步比平时轻。")
    elif state.cache_opened and state.cache_reward_applied == "exit_pass":
        notes.append("- 这轮已经摸到旧通行环，快门更容易开。")
    return notes


def build_score(state: GameState, ending: str) -> int:
    score = state.score
    score += 2 if state.cache_opened else 0
    score -= state.alert
    score -= max(0, state.turns - 8)
    score -= len([site for site in state.inspected_sites if site != state.mission.true_objective_site])
    if ending == "won":
        score += 4
    return max(0, score)


def build_final_notes(state: GameState, *, ending: str, cause: str) -> list[str]:
    notes: list[str] = []
    if state.cache_opened and ending != "won":
        notes.append("本局观察：你确实摸了 side stash，但它也占掉了取物前最贵的节奏；下局再验证这条 detour 值不值。")
    if state.mission.objective.console_reveals and not state.console_used:
        notes.append("本局观察：这个 objective package 不先过终端，拿货那拍会更吵；下局再验证是否值得先拐终端。")
    if state.exposure_peak >= 7:
        notes.append("本局观察：高 exposure 往往不是一回合炸出来的，而是连续两三拍都待在能被压线的位置。")
    if ending == "won" and state.alert >= 2:
        notes.append("本局观察：高警戒也能撤出去，但得把 gear 留到 carry state，而不是全花在进场。")
    if ending == "lost" and state.lockdown_timer is not None and state.lockdown_timer <= 0:
        notes.append("本局观察：这次不是没摸到目标，而是拿到后撤离线规划不够早。")
    if state.mission.complication.mode == "jammed_exit" and not state.console_used and state.profile.key != "breaker":
        notes.append("本局观察：快门闸卡涩的局，终端不是装饰；不提前处理，出口会把你活活卡住。")
    if not notes:
        notes.append("本局观察：先记录哪一格最容易把你暴露，再用下一局去验证它到底是 package 差异还是你自己的路线选择。")
    return notes[:3]


def manhattan(a: Pos, b: Pos) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])
