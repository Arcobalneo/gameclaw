from __future__ import annotations

import random

from dataclasses import dataclass


LANES = ("left", "mid", "right")
LANE_TITLES = {
    "left": "左盆沿",
    "mid": "中排缝",
    "right": "右塑圈",
}
LANE_SHORT = {
    "left": "左",
    "mid": "中",
    "right": "右",
}

PATHS = {
    "left": ("L0", "L1", "C", "SEA"),
    "mid": ("M0", "M1", "C", "SEA"),
    "right": ("R0", "R1", "C", "SEA"),
}

NODE_TITLES = {
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
}

STAGE_KEY = "side-drain-line-1"
STAGE_TITLE = "归海侧排一号线"
STAGE_BLURB = (
    "这是一条贴着金属台沿、抽水泵偶尔回涌的侧排水线。"
    "左边是盆沿碎口，中间是狭窄排缝，右边卡着塑料环。"
    "你要在它们合流前，把归海线守到最后一 pulse。"
)


@dataclass(frozen=True)
class Doctrine:
    key: str
    title: str
    subtitle: str
    blurb: str
    starting_tide: int
    tide_per_pulse: int
    starting_integrity: int
    forecast_depth: int
    discounts: dict[str, int]
    blocker_hp_bonus: int = 0
    support_attack_bonus: int = 0
    decoy_duration_bonus: int = 0
    recall_refund_bonus: int = 0
    redeploy_cooldown_delta: int = 0
    skill_name: str = ""
    skill_cost: int = 0
    skill_cooldown: int = 0
    skill_blurb: str = ""


@dataclass(frozen=True)
class UnitType:
    key: str
    title: str
    short: str
    blurb: str
    cost: int
    max_hp: int
    attack: int
    block: int
    allowed_slots: tuple[str, ...]
    kind: str
    armor_pierce: int = 0
    slow: int = 0
    expose: int = 0
    push: int = 0
    duration: int | None = None
    redeploy_cooldown: int = 2


@dataclass(frozen=True)
class EnemyType:
    key: str
    title: str
    short: str
    blurb: str
    max_hp: int
    speed: int
    armor: int
    contact_damage: int
    leak: int
    weight: int
    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class Slot:
    key: str
    title: str
    node: str
    is_path: bool
    coverage: tuple[str, ...]


@dataclass(frozen=True)
class SpawnSpec:
    lane_symbol: str
    enemy_key: str
    count: int = 1


@dataclass(frozen=True)
class SpawnEntry:
    lane: str
    enemy_key: str
    count: int = 1


DOCTRINES = [
    Doctrine(
        key="crusher",
        title="沟壑碎壳者",
        subtitle="碎壳防线",
        blurb="把最窄的卡口变成最硬的壳。宁可前排磨碎，也不让归海线先碎。",
        starting_tide=8,
        tide_per_pulse=2,
        starting_integrity=8,
        forecast_depth=2,
        discounts={"reef-guard": 1, "gate-stake": 1},
        blocker_hp_bonus=2,
        skill_name="碎壳顶潮",
        skill_cost=2,
        skill_cooldown=2,
        skill_blurb="选择一个前排位，本 pulse 攻 +2、拦口 +1。",
    ),
    Doctrine(
        key="oracle",
        title="触须预言家",
        subtitle="潮图预警",
        blurb="比起多下一只虾，它更相信先把下一波坏消息闻明白。",
        starting_tide=7,
        tide_per_pulse=3,
        starting_integrity=7,
        forecast_depth=3,
        discounts={"whisker-scout": 1, "salt-spray": 1},
        support_attack_bonus=1,
        skill_name="触须预警",
        skill_cost=2,
        skill_cooldown=2,
        skill_blurb="指定一条 lane，本 pulse 该 lane 敌人更慢、更脆。",
    ),
    Doctrine(
        key="gambler",
        title="脱壳赌徒",
        subtitle="退潮再编",
        blurb="它不把阵线当城墙，而是当临时信用。能换线就换线，能晚死就晚死。",
        starting_tide=7,
        tide_per_pulse=3,
        starting_integrity=7,
        forecast_depth=2,
        discounts={"molt-decoy": 1, "ring-cutter": 1},
        decoy_duration_bonus=1,
        recall_refund_bonus=1,
        redeploy_cooldown_delta=-1,
        skill_name="脱壳换线",
        skill_cost=1,
        skill_cooldown=1,
        skill_blurb="把一个已部署单位立即挪去空位并回 2 点壳。",
    ),
]

SLOTS = {
    "L1": Slot("L1", "左前拦口", "L1", True, ("L1", "C")),
    "M1": Slot("M1", "中前拦口", "M1", True, ("M1", "C")),
    "R1": Slot("R1", "右前拦口", "R1", True, ("R1", "C")),
    "C": Slot("C", "闸前总卡口", "C", True, ("C",)),
    "LP": Slot("LP", "左高台", "LP", False, ("L0", "L1", "M0", "M1", "C")),
    "RP": Slot("RP", "右高台", "RP", False, ("R0", "R1", "M0", "M1", "C")),
}
SLOT_ORDER = ("L1", "M1", "R1", "C", "LP", "RP")

UNITS = {
    "reef-guard": UnitType(
        key="reef-guard",
        title="礁口重钳",
        short="重钳",
        blurb="标准前排。站住、挡住、把冲到脸上的东西直接夹碎。",
        cost=4,
        max_hp=12,
        attack=3,
        block=2,
        allowed_slots=("L1", "M1", "R1", "C"),
        kind="melee",
        redeploy_cooldown=2,
    ),
    "ring-cutter": UnitType(
        key="ring-cutter",
        title="塑圈剪手",
        short="剪手",
        blurb="专门收甲壳和精英。站错位会脆，但剪对东西很值。",
        cost=3,
        max_hp=6,
        attack=3,
        block=0,
        allowed_slots=SLOT_ORDER,
        kind="ranged",
        armor_pierce=1,
        redeploy_cooldown=2,
    ),
    "whisker-scout": UnitType(
        key="whisker-scout",
        title="须探哨兵",
        short="须哨",
        blurb="低伤害、真有用。先减速、再做标记，让后续火力不白打。",
        cost=3,
        max_hp=5,
        attack=1,
        block=0,
        allowed_slots=SLOT_ORDER,
        kind="support",
        slow=1,
        expose=1,
        redeploy_cooldown=1,
    ),
    "salt-spray": UnitType(
        key="salt-spray",
        title="盐沫喷口",
        short="盐口",
        blurb="盯拥挤节点做小范围压制，适合补 runners 的节奏。",
        cost=2,
        max_hp=5,
        attack=1,
        block=0,
        allowed_slots=SLOT_ORDER,
        kind="splash",
        slow=1,
        redeploy_cooldown=1,
    ),
    "molt-decoy": UnitType(
        key="molt-decoy",
        title="蜕壳诱饵",
        short="诱饵",
        blurb="短命，但能把最危险的一波先钉住。",
        cost=2,
        max_hp=7,
        attack=0,
        block=3,
        allowed_slots=("L1", "M1", "R1", "C"),
        kind="decoy",
        duration=2,
        redeploy_cooldown=1,
    ),
    "gate-stake": UnitType(
        key="gate-stake",
        title="回涌闸桩",
        short="闸桩",
        blurb="守 choke 的硬桩。打得不算快，但会把目标往回推。",
        cost=4,
        max_hp=9,
        attack=2,
        block=1,
        allowed_slots=("L1", "M1", "R1", "C"),
        kind="control",
        push=1,
        redeploy_cooldown=2,
    ),
}
UNIT_ORDER = tuple(UNITS.keys())

ENEMIES = {
    "pot-grunt": EnemyType(
        key="pot-grunt",
        title="锅沿杂兵",
        short="杂",
        blurb="没什么花活，就是会把前排磨薄。",
        max_hp=5,
        speed=1,
        armor=0,
        contact_damage=1,
        leak=1,
        weight=1,
    ),
    "pump-runner": EnemyType(
        key="pump-runner",
        title="抽水跳虾",
        short="跳",
        blurb="速度快，前排空了就很容易直接穿线。",
        max_hp=4,
        speed=2,
        armor=0,
        contact_damage=1,
        leak=1,
        weight=1,
        tags=("runner",),
    ),
    "ring-borer": EnemyType(
        key="ring-borer",
        title="塑圈钻头",
        short="钻",
        blurb="带甲推进单位，适合让剪手和集火去处理。",
        max_hp=8,
        speed=1,
        armor=1,
        contact_damage=2,
        leak=1,
        weight=1,
        tags=("armored",),
    ),
    "eel-spark": EnemyType(
        key="eel-spark",
        title="电鳗借火体",
        short="鳗",
        blurb="推进不快，但接触伤害高，会把薄位电穿。",
        max_hp=7,
        speed=1,
        armor=0,
        contact_damage=3,
        leak=1,
        weight=1,
        tags=("shock",),
    ),
    "octopus-hauler": EnemyType(
        key="octopus-hauler",
        title="章鱼搬运手",
        short="章",
        blurb="重型精英，既吃拦口又会对完整度造成更重创伤。",
        max_hp=14,
        speed=1,
        armor=0,
        contact_damage=3,
        leak=2,
        weight=2,
        tags=("elite", "heavy"),
    ),
}

WAVE_BLUEPRINTS = (
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
)


def build_wave_plan(seed: int) -> list[tuple[SpawnEntry, ...]]:
    rng = random.Random(seed)
    blueprint = WAVE_BLUEPRINTS[rng.randrange(len(WAVE_BLUEPRINTS))]
    lane_order = rng.sample(list(LANES), k=3)
    lane_map = {"A": lane_order[0], "B": lane_order[1], "C": lane_order[2]}
    plan: list[tuple[SpawnEntry, ...]] = []
    for pulse in blueprint:
        entries = [
            SpawnEntry(lane=lane_map[item.lane_symbol], enemy_key=item.enemy_key, count=item.count)
            for item in pulse
        ]
        plan.append(tuple(entries))
    return plan
