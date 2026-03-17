"""skills.py – 技能效果执行器 + 升级选技能逻辑。"""
from __future__ import annotations

import random
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from lobster_cli_tamer.creature import Creature
    from lobster_cli_tamer.loader import GameData


# --------------------------------------------------------------------------- #
# 技能效果执行结果
# --------------------------------------------------------------------------- #

@dataclass
class SkillResult:
    skill_name: str
    damage: float = 0.0
    heal: float = 0.0
    status_applied: Optional[str] = None
    stat_changes: list[dict[str, Any]] = None  # {target, stat, value, duration}
    shield: Optional[float] = None
    priority: int = 0
    terrain: Optional[str] = None
    multi_hit: Optional[int] = None
    messages: list[str] = None

    def __post_init__(self) -> None:
        if self.stat_changes is None:
            self.stat_changes = []
        if self.messages is None:
            self.messages = []


# --------------------------------------------------------------------------- #
# 技能效果执行器
# --------------------------------------------------------------------------- #

def execute_skill(
    skill: dict[str, Any],
    attacker: "Creature",
    defender: "Creature",
    type_effectiveness: float,
    stage_atk: float = 1.0,
    stage_def: float = 1.0,
    random_factor: Optional[float] = None,
) -> SkillResult:
    """执行单次技能，返回 SkillResult。不修改任何实体状态（由 combat.py 应用）。"""
    result = SkillResult(skill_name=skill["name"])

    base_power = skill.get("power", 0)

    # 先处理效果列表
    effects: list[dict[str, Any]] = list(skill.get("effects", []))

    # priority
    for fx in effects:
        if fx["type"] == "priority":
            result.priority = fx.get("value", 1)

    if base_power > 0:
        atk_stat = attacker.effective_stat("atk", {"atk": stage_atk})
        def_stat = max(1.0, defender.effective_stat("def", {"def": stage_def}))
        rf = random_factor if random_factor is not None else random.uniform(0.85, 1.0)
        crit_roll = random.random() < 0.0625
        crit_mult = 1.5 if crit_roll else 1.0

        # conditional 效果（施加者 HP 低时额外倍率）
        cond_bonus = 1.0
        for fx in effects:
            if fx["type"] == "conditional":
                cond = fx.get("condition", "")
                if cond == "hp_below_half" and attacker.hp_pct < 0.5:
                    cond_bonus += fx.get("power_bonus", 0)
                elif cond == "target_low_hp" and defender.hp_pct < 0.3:
                    cond_bonus += fx.get("power_bonus", 0)

        # multi_hit
        hits = 1
        for fx in effects:
            if fx["type"] == "multi_hit":
                hits = random.randint(fx["hits"][0], fx["hits"][1])

        dmg_per_hit = (base_power * atk_stat / max(1.0, def_stat)) * type_effectiveness * rf * crit_mult * cond_bonus / 4.0
        result.damage = round(dmg_per_hit * hits, 2)
        result.multi_hit = hits if hits > 1 else None
        if crit_roll:
            result.messages.append("会心一击！")

    # 其他效果
    for fx in effects:
        t = fx["type"]
        if t == "heal":
            result.heal = fx.get("value", 0) * attacker.stats["hp"]
        elif t == "shield":
            result.shield = fx.get("value", 0) * attacker.stats["hp"]
        elif t == "status_apply":
            if random.random() < fx.get("chance", 0):
                result.status_applied = fx["status"]
        elif t == "stat_change":
            result.stat_changes.append({
                "target": fx.get("target", "self"),
                "stat": fx["stat"],
                "value": fx["value"],
                "duration": fx.get("duration_turns", 2),
            })
        elif t == "terrain":
            result.terrain = fx.get("name")
        elif t == "recoil":
            # recoil 存储为负 heal（由 combat.py 扣到施技者）
            result.heal -= fx.get("value", 0) * attacker.stats["hp"]
    return result


# --------------------------------------------------------------------------- #
# 升级选技能
# --------------------------------------------------------------------------- #

def build_skill_pool(
    creature: "Creature",
    data: "GameData",
) -> list[dict[str, Any]]:
    """构建加权技能池（排除已有技能，按属性 + 词条协同加权）。"""
    balance = data.balance["skill"]
    own_type_mult = balance.get("own_type_weight_multiplier", 2.0)
    synergy_mult = balance.get("affix_synergy_weight_multiplier", 1.5)

    species = data.species[creature.species_id]
    species_type = species["type"]
    skill_pool_tags = set(species.get("skill_pool_tags", []))

    # 收集词条协同 tag
    affix_synergy_tags: set[str] = set()
    for slot in creature.affix_slots:
        if slot.is_empty():
            continue
        affix = data.affixes.get(slot.affix_id)
        if affix:
            for t in affix.get("synergy_tags", []):
                affix_synergy_tags.add(t)

    current_moves = set(creature.moves)

    pool: list[tuple[dict[str, Any], float]] = []
    for skill in data.skills.values():
        skill_name = skill["name"]
        if skill_name in current_moves:
            continue
        w = 1.0
        # 物种类型加权
        if skill.get("type") == species_type:
            w *= own_type_mult
        # 物种 skill_pool_tags 匹配
        skill_tags = set(skill.get("tags", []))
        if skill_tags & skill_pool_tags:
            w *= 1.3
        # 词条协同
        if skill_tags & affix_synergy_tags:
            w *= synergy_mult
        # 特招：只对绑定物种
        if "signature" in skill_tags:
            bound = skill.get("id", "").startswith("signature_")
            # 粗略：signature 技能全局加权降低，避免和物种无关的特招出现
            w *= 0.05
        pool.append((skill, w))

    return pool


def pick_level_up_choices(
    creature: "Creature",
    data: "GameData",
    count: int = 3,
) -> list[dict[str, Any]]:
    """升级时从加权池抽 count 个不重复的技能供选择。"""
    pool = build_skill_pool(creature, data)
    if not pool:
        return []
    skills_list, weights = zip(*pool) if pool else ([], [])
    n = min(count, len(skills_list))
    chosen = random.choices(list(skills_list), weights=list(weights), k=n * 5)
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for s in chosen:
        if s["name"] not in seen:
            seen.add(s["name"])
            result.append(s)
        if len(result) >= n:
            break
    return result


# --------------------------------------------------------------------------- #
# 类型克制查询
# --------------------------------------------------------------------------- #

def get_type_effectiveness(attacker_type: str, defender_type: str, balance: dict) -> float:
    chart = balance["combat"]["type_effectiveness"]
    entry = chart.get(attacker_type)
    if entry and entry.get("克制") == defender_type:
        return entry.get("克制倍率", 1.5)
    return 1.0
