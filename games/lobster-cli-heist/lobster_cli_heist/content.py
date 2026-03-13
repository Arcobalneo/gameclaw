from __future__ import annotations

import random

from dataclasses import dataclass

Pos = tuple[int, int]


@dataclass(frozen=True)
class Profile:
    key: str
    title: str
    subtitle: str
    blurb: str
    gear_name: str
    gear_summary: str
    gear_charges: int
    extraction_bonus: int
    passive_summary: str


@dataclass(frozen=True)
class FacilityFrame:
    key: str
    title: str
    subtitle: str
    brief: str
    terrain_rows: tuple[tuple[str, ...], tuple[str, ...]]
    entry: Pos
    exit: Pos
    console: Pos
    cache: Pos
    candidates: tuple[Pos, ...]
    vent_pair: tuple[Pos, Pos]
    climb_columns: tuple[int, ...]
    steam_cell: Pos
    responder_entry: Pos


@dataclass(frozen=True)
class PatrollerSpec:
    title: str
    path: tuple[Pos, ...]


@dataclass(frozen=True)
class WatcherSpec:
    title: str
    position: Pos
    facing: str
    view_range: int


@dataclass(frozen=True)
class CameraSpec:
    title: str
    position: Pos
    patterns: tuple[tuple[Pos, ...], ...]


@dataclass(frozen=True)
class SecurityPackage:
    key: str
    title: str
    brief: str
    patroller: PatrollerSpec
    watcher: WatcherSpec | None
    camera: CameraSpec | None
    sensors: tuple[Pos, ...]
    responder_delay: int


@dataclass(frozen=True)
class ObjectivePackage:
    key: str
    title: str
    brief: str
    clue_text: str
    selection_rule: str
    extraction_window: int
    carry_noise: int
    false_alert: int
    console_reveals: bool
    cache_reward: str
    score: int


@dataclass(frozen=True)
class ComplicationPackage:
    key: str
    title: str
    brief: str
    mode: str
    carry_noise_bonus: int = 0


@dataclass(frozen=True)
class Mission:
    seed: int
    facility: FacilityFrame
    security: SecurityPackage
    objective: ObjectivePackage
    complication: ComplicationPackage
    title: str
    true_objective_site: Pos
    briefing_lines: tuple[str, ...]


PROFILES: tuple[Profile, ...] = (
    Profile(
        key="shade",
        title="藻披影行者",
        subtitle="更会贴着 shadow 读时机",
        blurb="更适合把曝光压在低线，用墨幕把一个本来会崩的转角拖成能过的节奏。",
        gear_name="墨幕壳",
        gear_summary="在自己脚下甩出短时墨幕，立刻压低 exposure，并让摄像头 / watcher 更难锁死这一格。",
        gear_charges=2,
        extraction_bonus=0,
        passive_summary="处于 shadow / 蒸汽里时更容易把曝光压回去；观察拿到的 forecast 也更完整。",
    ),
    Profile(
        key="breaker",
        title="断钳拆闸手",
        subtitle="更会拆 console、闸门和安保件",
        blurb="擅长让门、sensor 和扫镜头临时闭嘴，适合对抗麻烦的 security package。",
        gear_name="干扰钉",
        gear_summary="临时钉死摄像头、sensor 或卡住的快门闸；重点不是更快，而是把关键一格从必崩改成能赌。",
        gear_charges=2,
        extraction_bonus=1,
        passive_summary="操作 console / 出口快门更稳，默认不会额外制造杂音。",
    ),
    Profile(
        key="runner",
        title="脱壳快撤者",
        subtitle="更会把取物后的残局硬撤出去",
        blurb="平时风险不一定最低，但真到了 carry state，它能把一次失衡的线扯回到还能撤离。",
        gear_name="空壳冲刺",
        gear_summary="做一次 2 格短冲刺，略过 carry 的沉重脚步，把最关键的一次 reposition 留到高警戒时用。",
        gear_charges=2,
        extraction_bonus=1,
        passive_summary="取物后的封锁计时更宽一拍，而且第一次带货位移的噪音更轻。",
    ),
)


FACILITIES: tuple[FacilityFrame, ...] = (
    FacilityFrame(
        key="cold-rack",
        title="低温挂架 A-12",
        subtitle="冷库侧剖挂架线",
        brief="上层是开阔挂架，下层是排水沟和短 vent。你能潜得很安静，但带着货就别想再钻回去。",
        terrain_rows=(
            ("cover", "cover", "open", "cover", "cover", "cover", "cover"),
            ("cover", "shadow", "shadow", "cover", "cover", "shadow", "cover"),
        ),
        entry=(1, 0),
        exit=(0, 0),
        console=(1, 4),
        cache=(0, 4),
        candidates=((0, 5), (0, 6), (1, 6)),
        vent_pair=((1, 2), (1, 5)),
        climb_columns=(1, 4, 6),
        steam_cell=(1, 4),
        responder_entry=(0, 6),
    ),
    FacilityFrame(
        key="galley-backline",
        title="后厨背线 3 号灶后",
        subtitle="蒸汽、帘布和备货格挤在一起",
        brief="这条后厨背线比冷库吵。你会更常看见 cover，但也更容易因为一次贪 cache 被人盯上。",
        terrain_rows=(
            ("cover", "open", "cover", "cover", "cover", "cover", "cover"),
            ("cover", "shadow", "cover", "shadow", "open", "cover", "cover"),
        ),
        entry=(1, 0),
        exit=(0, 0),
        console=(0, 4),
        cache=(1, 5),
        candidates=((0, 5), (0, 6), (1, 6)),
        vent_pair=((1, 3), (0, 5)),
        climb_columns=(1, 3, 5),
        steam_cell=(0, 4),
        responder_entry=(0, 6),
    ),
    FacilityFrame(
        key="dock-drain",
        title="码头仓道 D-4",
        subtitle="上层仓道 + 下层排水回路",
        brief="上层仓道直、快、但暴露；下层排水回路安全，却只适合进，不适合带物后回头。",
        terrain_rows=(
            ("cover", "cover", "open", "cover", "cover", "cover", "cover"),
            ("cover", "shadow", "shadow", "open", "cover", "cover", "shadow"),
        ),
        entry=(1, 0),
        exit=(0, 0),
        console=(1, 4),
        cache=(0, 4),
        candidates=((0, 5), (0, 6), (1, 6)),
        vent_pair=((1, 2), (1, 6)),
        climb_columns=(2, 4, 6),
        steam_cell=(1, 3),
        responder_entry=(0, 6),
    ),
)


SECURITY_PACKAGES: tuple[SecurityPackage, ...] = (
    SecurityPackage(
        key="line-watch",
        title="直线盯守组",
        brief="一名守线员盯着上层回撤线，底层还有一只来回巡的搬运蟹。",
        patroller=PatrollerSpec("搬运蟹巡逻", ((1, 2), (1, 3), (1, 4), (1, 5), (1, 6))),
        watcher=WatcherSpec("冷架盯守员", (0, 6), "left", 4),
        camera=None,
        sensors=((1, 6),),
        responder_delay=2,
    ),
    SecurityPackage(
        key="servo-cam",
        title="摆扫镜头组",
        brief="主压力来自 ceiling camera 和终端附近的 sensor。路线没读对会被镜头节奏卡死。",
        patroller=PatrollerSpec("地沟巡逻蟹", ((1, 2), (1, 3), (1, 4), (1, 5))),
        watcher=None,
        camera=CameraSpec(
            "摆扫镜头",
            (0, 3),
            (
                ((0, 2), (0, 3), (0, 4)),
                ((0, 3), (0, 4), (0, 5)),
                ((0, 4), (0, 5), (0, 6)),
                ((0, 3), (0, 4), (0, 5)),
            ),
        ),
        sensors=((1, 4), (1, 6)),
        responder_delay=1,
    ),
    SecurityPackage(
        key="seal-crew",
        title="封锁响应组",
        brief="上层也有巡逻，取物后 responder 到得很快；你不是潜进去就赢了，是得真撤出去。",
        patroller=PatrollerSpec("仓道巡逻蟹", ((0, 2), (0, 3), (0, 4), (0, 5))),
        watcher=WatcherSpec("封锁看闸员", (1, 5), "left", 3),
        camera=CameraSpec(
            "门楣镜头",
            (0, 2),
            (
                ((0, 1), (0, 2), (0, 3)),
                ((0, 2), (0, 3), (0, 4)),
                ((0, 3), (0, 4), (0, 5)),
            ),
        ),
        sensors=((1, 5),),
        responder_delay=1,
    ),
)


OBJECTIVE_PACKAGES: tuple[ObjectivePackage, ...] = (
    ObjectivePackage(
        key="salt-ledger",
        title="盐账账本",
        brief="一本记着塑料环去向的账本，不算重，但拿到手后设施还是会立刻紧起来。",
        clue_text="简报线索：目标在高位货格里，而且不是最外侧那格。",
        selection_rule="upper_inner",
        extraction_window=6,
        carry_noise=1,
        false_alert=1,
        console_reveals=False,
        cache_reward="intel",
        score=7,
    ),
    ObjectivePackage(
        key="live-sample",
        title="活体样本罐",
        brief="拿到样本之后脚步会更沉，终端能明确告诉你哪格是真的，不看也能赌，但赌错会很伤。",
        clue_text="简报线索：终端能锁定最低温那格；不看终端也能赌，但会很吵。",
        selection_rule="farthest_exit",
        extraction_window=5,
        carry_noise=2,
        false_alert=2,
        console_reveals=True,
        cache_reward="cold_sleeve",
        score=9,
    ),
    ObjectivePackage(
        key="brass-key",
        title="黄铜钥环",
        brief="不是最重的货，但它触发的封锁最快。路线要先想好，不然拿到也未必带得走。",
        clue_text="简报线索：目标压在最深、而且偏低的那格。",
        selection_rule="lower_deep",
        extraction_window=4,
        carry_noise=1,
        false_alert=1,
        console_reveals=False,
        cache_reward="exit_pass",
        score=8,
    ),
)


COMPLICATION_PACKAGES: tuple[ComplicationPackage, ...] = (
    ComplicationPackage(
        key="steam-backflow",
        title="蒸汽倒灌",
        brief="固定一格会周期性冒蒸汽。它能帮你遮视线，也会让这一格更容易发出动静。",
        mode="steam",
    ),
    ComplicationPackage(
        key="jammed-shutter",
        title="快门闸卡涩",
        brief="拿到目标后，出口快门不会老老实实自己开。终端或硬拆路线都得提前想。",
        mode="jammed_exit",
    ),
    ComplicationPackage(
        key="overtime-sorter",
        title="临时加班看线",
        brief="设施里多了一双盯线的眼睛，尤其容易惩罚去摸 side cache 的贪心路线。",
        mode="extra_watcher",
    ),
    ComplicationPackage(
        key="slick-floor",
        title="湿滑地面",
        brief="带物后脚步更容易发响。你仍然能赢，但会更依赖 profile 和预留 gear。",
        mode="carry_noise",
        carry_noise_bonus=1,
    ),
)


def profile_by_index(index: int) -> Profile:
    return PROFILES[index - 1]


def select_objective_site(rule: str, candidates: tuple[Pos, ...], exit_pos: Pos) -> Pos:
    ordered = list(candidates)
    if rule == "upper_inner":
        upper = sorted((pos for pos in ordered if pos[0] == 0), key=lambda pos: pos[1])
        if upper:
            return upper[0]
        return sorted(ordered, key=lambda pos: (pos[1], pos[0]))[0]
    if rule == "farthest_exit":
        return max(ordered, key=lambda pos: (abs(pos[0] - exit_pos[0]) + abs(pos[1] - exit_pos[1]), pos[1], pos[0]))
    if rule == "lower_deep":
        return max(ordered, key=lambda pos: (pos[1], pos[0]))
    raise ValueError(f"unknown objective rule: {rule}")


def build_mission(seed: int) -> Mission:
    rng = random.Random(seed)
    facility = FACILITIES[rng.randrange(len(FACILITIES))]
    security = SECURITY_PACKAGES[rng.randrange(len(SECURITY_PACKAGES))]
    objective = OBJECTIVE_PACKAGES[rng.randrange(len(OBJECTIVE_PACKAGES))]
    complication = COMPLICATION_PACKAGES[rng.randrange(len(COMPLICATION_PACKAGES))]
    true_site = select_objective_site(objective.selection_rule, facility.candidates, facility.exit)
    briefing = (
        f"设施骨架：{facility.title} · {facility.subtitle}",
        f"安保包：{security.title} —— {security.brief}",
        f"目标包：{objective.title} —— {objective.brief}",
        f"并发麻烦：{complication.title} —— {complication.brief}",
        objective.clue_text,
        "提醒：vent 线适合进，不适合带着货回。先想撤离，再伸手。",
    )
    return Mission(
        seed=seed,
        facility=facility,
        security=security,
        objective=objective,
        complication=complication,
        title=f"{facility.title} · {objective.title}",
        true_objective_site=true_site,
        briefing_lines=briefing,
    )
