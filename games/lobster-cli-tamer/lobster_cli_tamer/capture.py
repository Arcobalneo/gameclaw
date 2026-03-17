"""capture.py – 野外遭遇 + 捕捉系统。

流程：
  1. encounter()       → 从区域遭遇表按权重抽出野生虾米
  2. check_shiny()     → 1/128 概率判定灵光
  3. capture_attempt() → 投掷捕捉球，返回是否成功
  4. apply_capture()   → 写入捕捉结果（词条 roll、加入 party / box）
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from lobster_cli_tamer.loader import GameData
    from lobster_cli_tamer.save import SaveSlot

from lobster_cli_tamer.creature import Creature
from lobster_cli_tamer.creature import AffixSlot
from lobster_cli_tamer.affixes import roll_affix_slots


# --------------------------------------------------------------------------- #
# 遭遇结果
# --------------------------------------------------------------------------- #

@dataclass
class EncounterResult:
    species_id: str
    level: int
    is_shiny: bool
    creature: Creature       # 已实例化，词条空（捕捉成功前不 roll）


# --------------------------------------------------------------------------- #
# 遭遇抽取
# --------------------------------------------------------------------------- #

def encounter(
    sub_area: dict[str, Any],
    data: "GameData",
) -> Optional[EncounterResult]:
    """从子区域遭遇表抽取一只野生虾米。返回 None 表示本次无遭遇。"""
    encounter_table = sub_area.get("encounter_table", [])
    if not encounter_table:
        return None

    balance = data.balance["capture"]
    no_encounter_weight = balance.get("no_encounter_weight", 0.4)

    species_ids = [e["species_id"] for e in encounter_table]
    weights = [float(e["weight"]) for e in encounter_table]

    # 加入"无遭遇"选项
    all_choices = ["__none__"] + species_ids
    all_weights = [no_encounter_weight * sum(weights)] + weights

    chosen = random.choices(all_choices, weights=all_weights, k=1)[0]
    if chosen == "__none__":
        return None

    level_range = sub_area.get("level_range", [1, 5])
    level = random.randint(level_range[0], level_range[1])
    is_shiny = check_shiny(data)

    creature = Creature.from_species(chosen, data, level=level, is_shiny=is_shiny)
    creature.bind_species_data(data)

    return EncounterResult(
        species_id=chosen,
        level=level,
        is_shiny=is_shiny,
        creature=creature,
    )


def check_shiny(data: "GameData") -> bool:
    rate = data.balance["capture"].get("shiny_rate", 0.0078125)  # 1/128
    return random.random() < rate


# --------------------------------------------------------------------------- #
# 捕捉成功率
# --------------------------------------------------------------------------- #

def capture_attempt(
    wild: Creature,
    item_id: str,
    data: "GameData",
    weakened: bool = False,
    status: Optional[str] = None,
) -> tuple[bool, float]:
    """
    返回 (成功, 最终概率)。
    weakened: 野生虾米 HP < 30% 时为 True
    status:   野生虾米当前状态异常
    """
    balance = data.balance["capture"]
    species = data.species[wild.species_id]
    base_rate = float(species["capture_base_rate"])

    # 道具加成
    item = data.items.get(item_id)
    item_bonus = 1.0
    if item and item.get("type") == "capture":
        item_bonus = float(item.get("capture_rate_multiplier", item.get("multiplier", 1.0)))

    # HP 惩罚/奖励
    hp_pct = wild.hp_current / wild.stats["hp"]
    if hp_pct < 0.3:
        hp_factor = balance.get("weakened_bonus", 1.5)
    elif hp_pct < 0.6:
        hp_factor = balance.get("half_hp_bonus", 1.2)
    else:
        hp_factor = 1.0

    # 状态加成
    status_bonus = 1.0
    if status in ("中毒", "灼烧"):
        status_bonus = balance.get("status_poison_burn_bonus", 1.2)
    elif status in ("麻痹", "冰封", "困惑"):
        status_bonus = balance.get("status_para_freeze_bonus", 1.5)

    # 灵光虾米额外降低捕捉率（灵光虾米不好抓）
    shiny_penalty = balance.get("shiny_capture_penalty", 0.7) if wild.is_shiny else 1.0

    final_rate = min(0.95, base_rate * item_bonus * hp_factor * status_bonus * shiny_penalty)
    success = random.random() < final_rate
    return success, final_rate


# --------------------------------------------------------------------------- #
# 捕捉后处理
# --------------------------------------------------------------------------- #

def apply_capture(
    enc: EncounterResult,
    save: "SaveSlot",
    data: "GameData",
    nickname: Optional[str] = None,
    captured_zone: str = "",
) -> Creature:
    """
    捕捉成功后：
    1. 给虾米 roll 词条
    2. 记录捕捉区域、nickname
    3. 加入 party（未满 6 只）或 box
    4. 更新图鉴（dex 标记见过 + 捕捉）
    返回捕捉后的 Creature。
    """
    c = enc.creature
    c.nickname = nickname
    c.captured_zone = captured_zone

    # roll 词条
    num_slots = len(c.affix_slots)
    rolled = roll_affix_slots(num_slots, data, is_shiny=c.is_shiny)
    for i, aff in enumerate(rolled):
        c.affix_slots[i] = AffixSlot(affix_id=aff["id"])

    # 更新图鉴
    save.dex_seen.add(c.species_id)
    save.dex_caught.add(c.species_id)

    # 加入 party 或 box
    active = [cr for cr in save.party if cr is not None]
    if len(active) < 6:
        # 找第一个空槽
        for i, slot in enumerate(save.party):
            if slot is None:
                save.party[i] = c
                break
        else:
            save.party.append(c)
    else:
        save.box.append(c)

    return c


# --------------------------------------------------------------------------- #
# 图鉴 / 灵光追踪
# --------------------------------------------------------------------------- #

def mark_seen(save: "SaveSlot", species_id: str) -> None:
    save.dex_seen.add(species_id)


def encounter_shiny_log(save: "SaveSlot", species_id: str) -> None:
    save.shiny_encountered.add(species_id)
