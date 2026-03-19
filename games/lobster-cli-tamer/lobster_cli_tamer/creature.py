"""creature.py – 虾米实体类。

一只虾米 = 物种模板 × 等级 × 词条 × 已学技能 × 状态。
不依赖任何 IO，可序列化成 dict 用于存档。
"""
from __future__ import annotations

import math
import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from lobster_cli_tamer.loader import GameData

# --------------------------------------------------------------------------- #
# 状态异常常量
# --------------------------------------------------------------------------- #

STATUS_NONE = "无"
STATUS_POISON = "中毒"
STATUS_PARALYZE = "麻痹"
STATUS_BURN = "灼烧"
STATUS_FREEZE = "冰封"
STATUS_CONFUSE = "困惑"
ALL_STATUSES = {STATUS_POISON, STATUS_PARALYZE, STATUS_BURN, STATUS_FREEZE, STATUS_CONFUSE}

# --------------------------------------------------------------------------- #
# 词条槽
# --------------------------------------------------------------------------- #

@dataclass
class AffixSlot:
    affix_id: str          # '' = 空槽
    locked: bool = False

    def is_empty(self) -> bool:
        return not self.affix_id

    def to_dict(self) -> dict[str, Any]:
        return {"affix_id": self.affix_id, "locked": self.locked}

    @staticmethod
    def from_dict(d: dict[str, Any]) -> "AffixSlot":
        return AffixSlot(affix_id=d["affix_id"], locked=d.get("locked", False))


# --------------------------------------------------------------------------- #
# 虾米实体
# --------------------------------------------------------------------------- #

@dataclass
class Creature:
    uid: str                          # UUID，唯一标识一只虾米
    species_id: str
    nickname: Optional[str]
    level: int
    exp: int
    is_shiny: bool

    # 属性（由等级和物种成长率计算）
    stats: dict[str, float]           # hp / atk / def / spd / end
    hp_current: float

    # 词条槽
    affix_slots: list[AffixSlot]

    # 已学技能（最多 4 个）
    moves: list[str]                  # skill name 列表

    # 捕捉信息
    captured_zone: str = ""

    # 深渊风险
    has_plague: bool = False
    plague_floors: int = 0            # 带疫病已经历过的深渊层数
    abyss_taint: int = 0              # 深渊污染；达到阈值后会转化为疫病

    # 状态
    dead: bool = False                # 永久死亡（战斗内或疫病结算）

    # ------------------------------------------------------------------ #
    # 工厂方法
    # ------------------------------------------------------------------ #

    @staticmethod
    def from_species(
        species_id: str,
        data: "GameData",
        level: int = 1,
        is_shiny: bool = False,
        affix_slots: Optional[list[AffixSlot]] = None,
        moves: Optional[list[str]] = None,
        nickname: Optional[str] = None,
        captured_zone: str = "",
    ) -> "Creature":
        species = data.species[species_id]
        stats = compute_stats(species, level)
        default_slots = affix_slots if affix_slots is not None else [AffixSlot("") for _ in range(num_affix_slots(species, is_shiny))]
        default_moves = moves if moves is not None else [species["base_skill"]]
        return Creature(
            uid=str(uuid.uuid4()),
            species_id=species_id,
            nickname=nickname,
            level=level,
            exp=0,
            is_shiny=is_shiny,
            stats=stats,
            hp_current=stats["hp"],
            affix_slots=default_slots,
            moves=default_moves,
            captured_zone=captured_zone,
        )

    # ------------------------------------------------------------------ #
    # 属性工具
    # ------------------------------------------------------------------ #

    @property
    def display_name(self) -> str:
        return self.nickname or self.species_name

    @property
    def species_name(self) -> str:
        # caller must pass data; attribute set lazily at bind time
        return getattr(self, "_species_name", self.species_id)

    def bind_species_name(self, data: "GameData") -> None:
        self._species_name = data.species[self.species_id]["name"]

    @property
    def is_alive(self) -> bool:
        return not self.dead and self.hp_current > 0

    @property
    def hp_pct(self) -> float:
        return max(0.0, self.hp_current / self.stats["hp"])

    def effective_stat(self, stat: str, stage: dict[str, float] | None = None) -> float:
        """返回当前战斗属性（含临时倍率）。"""
        base = self.stats[stat]
        if stage and stat in stage:
            base *= stage[stat]
        return base

    # ------------------------------------------------------------------ #
    # 升级逻辑
    # ------------------------------------------------------------------ #

    def gain_exp(self, amount: int, balance: dict) -> bool:
        """返回是否升级。"""
        if self.dead:
            return False
        self.exp += amount
        threshold = exp_to_next_level(self.level, balance)
        if self.exp >= threshold:
            self.exp -= threshold
            self.level += 1
            old_hp_pct = self.hp_pct
            self.stats = compute_stats_with_species_id(self.species_id, self.level, getattr(self, "_species_data", None))
            self.hp_current = self.stats["hp"] * old_hp_pct
            return True
        return False

    def bind_species_data(self, data: "GameData") -> None:
        self._species_data = data.species[self.species_id]
        self._species_name = self._species_data["name"]

    def check_evolution(self, data: "GameData") -> Optional[str]:
        species = data.species[self.species_id]
        evo = species.get("evolution")
        if evo and evo.get("target") and self.level >= evo.get("min_level", 999):
            return evo["target"]
        return None

    def evolve(self, target_species_id: str, data: "GameData") -> None:
        old_hp_pct = self.hp_pct
        self.species_id = target_species_id
        self.bind_species_data(data)
        self.stats = compute_stats(data.species[target_species_id], self.level)
        self.hp_current = self.stats["hp"] * old_hp_pct

    def learn_skill(self, skill_name: str, replace_index: Optional[int] = None) -> None:
        if skill_name in self.moves:
            return
        if len(self.moves) < 4:
            self.moves.append(skill_name)
        elif replace_index is not None and 0 <= replace_index < len(self.moves):
            self.moves[replace_index] = skill_name

    # ------------------------------------------------------------------ #
    # 疫病
    # ------------------------------------------------------------------ #

    def apply_plague(self, floors: int = 0) -> None:
        self.has_plague = True
        if floors > 0:
            self.plague_floors += floors

    def increment_plague(self, floors: int = 1) -> None:
        if self.has_plague:
            self.plague_floors += floors

    def add_abyss_taint(self, amount: int = 1) -> None:
        if amount > 0:
            self.abyss_taint += amount

    def convert_taint_to_plague_if_needed(self, threshold: int) -> int:
        if self.has_plague or self.abyss_taint < threshold:
            return 0
        converted = self.abyss_taint
        self.abyss_taint = 0
        self.apply_plague(converted)
        return converted

    def plague_death_chance(self, balance: dict) -> float:
        if not self.has_plague:
            return 0.0
        rate = balance["tower"]["plague_rate_per_floor"]
        cap = balance["tower"]["plague_max_rate"]
        return min(self.plague_floors * rate, cap)

    def cure_plague(self) -> None:
        self.has_plague = False
        self.plague_floors = 0
        self.abyss_taint = 0

    # ------------------------------------------------------------------ #
    # 序列化
    # ------------------------------------------------------------------ #

    def to_dict(self) -> dict[str, Any]:
        return {
            "uid": self.uid,
            "species_id": self.species_id,
            "species_name": self.species_name,
            "nickname": self.nickname,
            "level": self.level,
            "exp": self.exp,
            "is_shiny": self.is_shiny,
            "stats": self.stats,
            "hp_current": round(self.hp_current, 2),
            "affix_slots": [s.to_dict() for s in self.affix_slots],
            "moves": self.moves,
            "captured_zone": self.captured_zone,
            "has_plague": self.has_plague,
            "plague_floors": self.plague_floors,
            "abyss_taint": self.abyss_taint,
            "dead": self.dead,
        }

    @staticmethod
    def from_dict(d: dict[str, Any], data: "GameData") -> "Creature":
        c = Creature(
            uid=d["uid"],
            species_id=d["species_id"],
            nickname=d.get("nickname"),
            level=d["level"],
            exp=d.get("exp", 0),
            is_shiny=d.get("is_shiny", False),
            stats=d["stats"],
            hp_current=d.get("hp_current", d["stats"]["hp"]),
            affix_slots=[AffixSlot.from_dict(s) for s in d.get("affix_slots", [])],
            moves=d.get("moves", []),
            captured_zone=d.get("captured_zone", ""),
            has_plague=d.get("has_plague", False),
            plague_floors=d.get("plague_floors", 0),
            abyss_taint=d.get("abyss_taint", 0),
            dead=d.get("dead", False),
        )
        c.bind_species_data(data)
        return c


# --------------------------------------------------------------------------- #
# 辅助函数（模块级，可复用）
# --------------------------------------------------------------------------- #

def num_affix_slots(species: dict[str, Any], is_shiny: bool) -> int:
    return species["affix_slots"] + (1 if is_shiny else 0)


def compute_stats(species: dict[str, Any], level: int) -> dict[str, float]:
    base = species["base_stats"]
    growth = species["stat_growth"]
    return {stat: base[stat] + growth[stat] * (level - 1) for stat in base}


def compute_stats_with_species_id(species_id: str, level: int, species_data: Optional[dict]) -> dict[str, float]:
    if species_data is None:
        raise ValueError(f"species_data not bound for {species_id}")
    return compute_stats(species_data, level)


def exp_to_next_level(level: int, balance: dict) -> int:
    base = balance["exp"]["base"]
    rate = balance["exp"]["growth_rate"]
    return math.ceil(base * (rate ** (level - 1)))
