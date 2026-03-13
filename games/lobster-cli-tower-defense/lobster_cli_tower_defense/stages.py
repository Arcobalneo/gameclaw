from __future__ import annotations

import random

from dataclasses import dataclass

from lobster_cli_tower_defense.content import Slot, SpawnEntry, SpawnSpec


DEFAULT_FORECAST_LABELS = ("- 本 pulse 入潮：", "- 下 pulse：", "- 再下 pulse：")
DEFAULT_LANE_SYMBOLS = ("A", "B", "C")


@dataclass(frozen=True)
class StageDefinition:
    key: str
    title: str
    blurb: str
    lanes: tuple[str, ...]
    lane_symbols: tuple[str, ...]
    lane_titles: dict[str, str]
    lane_short: dict[str, str]
    paths: dict[str, tuple[str, ...]]
    node_titles: dict[str, str]
    slots: dict[str, Slot]
    slot_order: tuple[str, ...]
    wave_blueprints: tuple[tuple[tuple[SpawnSpec, ...], ...], ...]
    lane_block_slots: dict[str, tuple[str, ...]]
    support_slots: tuple[str, ...] = ()
    exit_label: str = "海"
    support_row_label: str = "高"
    forecast_labels: tuple[str, ...] = DEFAULT_FORECAST_LABELS


DEFAULT_STAGE = StageDefinition(
    key="side-drain-line-1",
    title="归海侧排一号线",
    blurb=(
        "这是一条贴着金属台沿、抽水泵偶尔回涌的侧排水线。"
        "左边是盆沿碎口，中间是狭窄排缝，右边卡着塑料环。"
        "你要在它们合流前，把归海线守到最后一 pulse。"
    ),
    lanes=("left", "mid", "right"),
    lane_symbols=DEFAULT_LANE_SYMBOLS,
    lane_titles={
        "left": "左盆沿",
        "mid": "中排缝",
        "right": "右塑圈",
    },
    lane_short={
        "left": "左",
        "mid": "中",
        "right": "右",
    },
    paths={
        "left": ("L0", "L1", "C", "SEA"),
        "mid": ("M0", "M1", "C", "SEA"),
        "right": ("R0", "R1", "C", "SEA"),
    },
    node_titles={
        "L0": "左入口",
        "L1": "左前拦口",
        "M0": "中入口",
        "M1": "中前拦口",
        "R0": "右入口",
        "R1": "右前拦口",
        "C": "闸前总卡口",
        "LP": "左高台",
        "RP": "右高台",
        "SEA": "归海线",
    },
    slots={
        "L1": Slot("L1", "左前拦口", "L1", True, ("L1", "C")),
        "M1": Slot("M1", "中前拦口", "M1", True, ("M1", "C")),
        "R1": Slot("R1", "右前拦口", "R1", True, ("R1", "C")),
        "C": Slot("C", "闸前总卡口", "C", True, ("C",)),
        "LP": Slot("LP", "左高台", "LP", False, ("L0", "L1", "M0", "C")),
        "RP": Slot("RP", "右高台", "RP", False, ("R0", "R1", "M0", "C")),
    },
    slot_order=("L1", "M1", "R1", "C", "LP", "RP"),
    lane_block_slots={
        "left": ("L1", "C"),
        "mid": ("M1", "C"),
        "right": ("R1", "C"),
    },
    support_slots=("LP", "RP"),
    wave_blueprints=(
        (
            (SpawnSpec("A", "pot-grunt", 2),),
            (SpawnSpec("B", "pump-runner", 1), SpawnSpec("C", "pot-grunt", 1)),
            (SpawnSpec("A", "ring-borer", 1),),
            (SpawnSpec("B", "eel-spark", 1), SpawnSpec("A", "pot-grunt", 1)),
            (SpawnSpec("C", "pump-runner", 2),),
            (SpawnSpec("A", "octopus-hauler", 1), SpawnSpec("B", "pot-grunt", 1)),
            (SpawnSpec("B", "ring-borer", 1), SpawnSpec("C", "pump-runner", 1)),
            (SpawnSpec("A", "pump-runner", 1), SpawnSpec("C", "eel-spark", 1)),
            (SpawnSpec("B", "octopus-hauler", 1), SpawnSpec("A", "ring-borer", 1)),
            (SpawnSpec("A", "pot-grunt", 2), SpawnSpec("B", "pump-runner", 1), SpawnSpec("C", "eel-spark", 1)),
        ),
        (
            (SpawnSpec("B", "pot-grunt", 2),),
            (SpawnSpec("C", "pump-runner", 1), SpawnSpec("A", "pot-grunt", 1)),
            (SpawnSpec("B", "ring-borer", 1),),
            (SpawnSpec("A", "eel-spark", 1), SpawnSpec("C", "pot-grunt", 1)),
            (SpawnSpec("B", "pump-runner", 1), SpawnSpec("C", "pump-runner", 1)),
            (SpawnSpec("A", "octopus-hauler", 1),),
            (SpawnSpec("C", "ring-borer", 1), SpawnSpec("B", "pot-grunt", 2)),
            (SpawnSpec("A", "pump-runner", 1), SpawnSpec("B", "eel-spark", 1)),
            (SpawnSpec("C", "octopus-hauler", 1), SpawnSpec("A", "ring-borer", 1)),
            (SpawnSpec("A", "pot-grunt", 1), SpawnSpec("B", "pump-runner", 1), SpawnSpec("C", "eel-spark", 1)),
        ),
    ),
)

DEFAULT_STAGE_KEY = DEFAULT_STAGE.key
DEFAULT_STAGE_TITLE = DEFAULT_STAGE.title
DEFAULT_STAGE_BLURB = DEFAULT_STAGE.blurb
LANES = DEFAULT_STAGE.lanes
LANE_TITLES = DEFAULT_STAGE.lane_titles
LANE_SHORT = DEFAULT_STAGE.lane_short
PATHS = DEFAULT_STAGE.paths
NODE_TITLES = DEFAULT_STAGE.node_titles
SLOTS = DEFAULT_STAGE.slots
SLOT_ORDER = DEFAULT_STAGE.slot_order
WAVE_BLUEPRINTS = DEFAULT_STAGE.wave_blueprints


def build_wave_plan(seed: int, *, stage: StageDefinition = DEFAULT_STAGE) -> list[tuple[SpawnEntry, ...]]:
    if len(stage.lane_symbols) != len(stage.lanes):
        raise ValueError("lane_symbols and lanes must stay aligned")
    rng = random.Random(seed)
    blueprint = stage.wave_blueprints[rng.randrange(len(stage.wave_blueprints))]
    lane_order = rng.sample(list(stage.lanes), k=len(stage.lanes))
    lane_map = {
        symbol: lane_order[index]
        for index, symbol in enumerate(stage.lane_symbols)
    }
    plan: list[tuple[SpawnEntry, ...]] = []
    for pulse in blueprint:
        entries = [
            SpawnEntry(lane=lane_map[item.lane_symbol], enemy_key=item.enemy_key, count=item.count)
            for item in pulse
        ]
        plan.append(tuple(entries))
    return plan
