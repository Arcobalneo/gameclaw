"""affixes.py – 词条 roll 引擎 + 战斗触发系统。

触发系统：游戏各模块在关键时机调用 AffixTrigger.process(event, context)。
context 是一个轻量 dict，包含当前战斗状态快照，返回 list[AffixEffect]。
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from lobster_cli_tamer.creature import Creature
    from lobster_cli_tamer.loader import GameData

# --------------------------------------------------------------------------- #
# 品阶常量
# --------------------------------------------------------------------------- #

TIER_COMMON = "common"
TIER_BLUE = "blue"
TIER_PURPLE = "purple"
TIER_GOLD = "gold"
TIER_ORDER = [TIER_COMMON, TIER_BLUE, TIER_PURPLE, TIER_GOLD]


# --------------------------------------------------------------------------- #
# Roll 逻辑
# --------------------------------------------------------------------------- #

def roll_affix(data: "GameData", is_shiny: bool = False) -> dict[str, Any]:
    """从词条库随机抽取一个词条（返回词条 dict 副本）。"""
    balance = data.balance
    weights_cfg = balance["affix"]["roll_weights"]
    bonus_cfg = balance["affix"].get("shiny_roll_bonus", {})

    weights: dict[str, float] = {
        TIER_COMMON: weights_cfg["common"],
        TIER_BLUE: weights_cfg["blue"],
        TIER_PURPLE: weights_cfg["purple"],
        TIER_GOLD: weights_cfg["gold"],
    }
    if is_shiny:
        for tier, delta in bonus_cfg.items():
            weights[tier] = max(0.0, weights.get(tier, 0) + delta)

    tiers = list(weights.keys())
    tier_weights = list(weights.values())
    chosen_tier = random.choices(tiers, weights=tier_weights, k=1)[0]

    pool = [a for a in data.affixes.values() if a["tier"] == chosen_tier]
    if not pool:
        pool = list(data.affixes.values())
    chosen = dict(random.choice(pool))
    return chosen


def roll_affix_slots(
    num_slots: int,
    data: "GameData",
    is_shiny: bool = False,
) -> list[dict[str, Any]]:
    """为一只新捕捉的虾米 roll 所有词条槽。"""
    return [roll_affix(data, is_shiny=is_shiny) for _ in range(num_slots)]


def reroll_affix_slot(
    creature: "Creature",
    slot_index: int,
    data: "GameData",
) -> dict[str, Any]:
    """重投词条（保持品阶不变，随机换内容）。消耗由 workshop.py 处理。"""
    current = creature.affix_slots[slot_index]
    if current.locked:
        raise ValueError("词条已封印，无法重投。")
    old_affix = data.affixes.get(current.affix_id)
    old_tier = old_affix["tier"] if old_affix else TIER_COMMON
    pool = [a for a in data.affixes.values() if a["tier"] == old_tier and a["id"] != current.affix_id]
    if not pool:
        pool = [a for a in data.affixes.values() if a["tier"] == old_tier]
    return dict(random.choice(pool)) if pool else dict(old_affix or list(data.affixes.values())[0])


def upgrade_affix_slot(
    creature: "Creature",
    slot_index: int,
    data: "GameData",
) -> dict[str, Any]:
    """升阶词条（品阶+1，内容随机从新品阶选）。消耗由 workshop.py 处理。"""
    current = creature.affix_slots[slot_index]
    old_affix = data.affixes.get(current.affix_id)
    if not old_affix:
        raise ValueError("当前词条槽为空，无法升阶。")
    old_tier = old_affix["tier"]
    if old_tier not in TIER_ORDER:
        raise ValueError(f"未知词条品阶: {old_tier}")
    tier_idx = TIER_ORDER.index(old_tier)
    if tier_idx >= len(TIER_ORDER) - 1:
        raise ValueError("已是最高品阶（虾玄），无法继续升阶。")
    new_tier = TIER_ORDER[tier_idx + 1]
    pool = [a for a in data.affixes.values() if a["tier"] == new_tier]
    if not pool:
        pool = list(data.affixes.values())
    return dict(random.choice(pool))


# --------------------------------------------------------------------------- #
# 词条效果应用到战斗（触发系统）
# --------------------------------------------------------------------------- #

@dataclass
class AffixEffect:
    """一次词条触发产生的效果快照，由战斗引擎执行。"""
    source_affix_name: str
    effect: dict[str, Any]
    target: str  # 'self' | 'enemy' | 'team'

    def describe(self) -> str:
        return f"✦ {self.source_affix_name} 触发"


class AffixTriggerState:
    """追踪单场战斗内词条触发次数。"""

    def __init__(self) -> None:
        self._counts: dict[str, int] = {}  # affix_id -> count

    def can_trigger(self, affix: dict[str, Any]) -> bool:
        limit = affix.get("trigger_limit_per_battle", 99)
        return self._counts.get(affix["id"], 0) < limit

    def record(self, affix_id: str) -> None:
        self._counts[affix_id] = self._counts.get(affix_id, 0) + 1

    def reset(self) -> None:
        self._counts.clear()


def process_affix_event(
    creature: "Creature",
    event: str,
    context: dict[str, Any],
    data: "GameData",
    trigger_state: AffixTriggerState,
) -> list[AffixEffect]:
    """在指定事件时，处理虾米所有有效词条，返回触发的效果列表。"""
    effects: list[AffixEffect] = []
    for slot in creature.affix_slots:
        if slot.is_empty():
            continue
        affix = data.affixes.get(slot.affix_id)
        if affix is None:
            continue
        if affix["trigger"] != event:
            continue
        if not trigger_state.can_trigger(affix):
            continue
        # 特殊条件检查
        if event == "on_hp_threshold":
            threshold = affix.get("trigger_threshold", 0.25)
            if context.get("hp_pct", 1.0) > threshold:
                continue
        # 被动队伍词条（passive_team）无事件触发，由 combat setup 时读取
        if affix["trigger"] == "passive_team":
            continue
        trigger_state.record(affix["id"])
        effects.append(AffixEffect(
            source_affix_name=affix["name"],
            effect=affix["effect"],
            target=affix["effect"].get("target", "self"),
        ))
    return effects


def collect_passive_team_affixes(
    party: list["Creature"],
    data: "GameData",
) -> list[dict[str, Any]]:
    """收集 party 中所有 passive_team 词条（用于战斗开始时应用全队加成）。"""
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    for creature in party:
        if not creature.is_alive:
            continue
        for slot in creature.affix_slots:
            if slot.is_empty():
                continue
            affix = data.affixes.get(slot.affix_id)
            if affix and affix["trigger"] == "passive_team":
                if affix["id"] not in seen:
                    seen.add(affix["id"])
                    result.append(affix)
    return result


# --------------------------------------------------------------------------- #
# 词条展示辅助
# --------------------------------------------------------------------------- #

TIER_SYMBOLS = {
    TIER_COMMON: "○",
    TIER_BLUE: "◑",
    TIER_PURPLE: "●",
    TIER_GOLD: "✦",
}


def format_affix_slot(slot: "Any", data: "GameData") -> str:  # AffixSlot
    if slot.is_empty():
        return "[空槽]"
    affix = data.affixes.get(slot.affix_id)
    if not affix:
        return f"[未知:{slot.affix_id}]"
    sym = TIER_SYMBOLS.get(affix["tier"], "?")
    lock = " 🔒" if slot.locked else ""
    return f"{sym}{affix['name']}{lock}"
