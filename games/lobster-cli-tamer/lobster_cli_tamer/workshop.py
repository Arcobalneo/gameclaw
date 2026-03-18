"""workshop.py – 词条工坊（重投/升阶/封印/解封）。

消耗品规则（来自 balance.json）：
  重投  → 甲核 × N
  升阶  → 灵晶 × N（按目标品阶递增）
  封印  → 潮石 × 1
  解封  → 潮石 × 2
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from lobster_cli_tamer.loader import GameData
    from lobster_cli_tamer.save import SaveSlot

from lobster_cli_tamer.affixes import (
    reroll_affix_slot,
    upgrade_affix_slot,
    TIER_ORDER,
    format_affix_slot,
)
from lobster_cli_tamer.creature import AffixSlot, Creature


# --------------------------------------------------------------------------- #
# 工坊操作结果
# --------------------------------------------------------------------------- #

@dataclass
class WorkshopResult:
    success: bool
    message: str
    cost: dict[str, int]  # {item_id: count}
    new_affix: Optional[dict[str, Any]] = None


# --------------------------------------------------------------------------- #
# 消耗计算
# --------------------------------------------------------------------------- #

def _reroll_cost(balance: dict) -> dict[str, int]:
    return dict(balance["workshop"]["reroll_cost"])


def _upgrade_cost(current_tier: str, balance: dict) -> dict[str, int]:
    tier_idx = TIER_ORDER.index(current_tier) if current_tier in TIER_ORDER else 0
    costs: list[dict] = balance["workshop"]["upgrade_cost_by_tier"]
    entry = costs[min(tier_idx, len(costs) - 1)]
    return dict(entry)


def _seal_cost(balance: dict) -> dict[str, int]:
    return dict(balance["workshop"]["seal_cost"])


def _unseal_cost(balance: dict) -> dict[str, int]:
    return dict(balance["workshop"]["unseal_cost"])


def _can_afford(save: "SaveSlot", cost: dict[str, int]) -> tuple[bool, str]:
    for item_id, count in cost.items():
        if save.get_item_count(item_id) < count:
            item_name = item_id.replace("_", " ")
            return False, f"材料不足：需要 {item_name} ×{count}，仅有 {save.get_item_count(item_id)}"
    return True, ""


def _deduct(save: "SaveSlot", cost: dict[str, int]) -> None:
    for item_id, count in cost.items():
        save.consume_item(item_id, count)


# --------------------------------------------------------------------------- #
# 工坊操作
# --------------------------------------------------------------------------- #

def reroll(
    creature: Creature,
    slot_index: int,
    save: "SaveSlot",
    data: "GameData",
) -> WorkshopResult:
    balance = data.balance
    cost = _reroll_cost(balance)

    if slot_index < 0 or slot_index >= len(creature.affix_slots):
        return WorkshopResult(False, "无效的词条槽序号", cost={})

    slot = creature.affix_slots[slot_index]
    if slot.locked:
        return WorkshopResult(False, "该词条已封印，无法重投", cost={})
    if slot.is_empty():
        return WorkshopResult(False, "该词条槽为空，无法重投", cost={})

    ok, msg = _can_afford(save, cost)
    if not ok:
        return WorkshopResult(False, msg, cost=cost)

    new_affix = reroll_affix_slot(creature, slot_index, data)
    _deduct(save, cost)
    creature.affix_slots[slot_index].affix_id = new_affix["id"]

    return WorkshopResult(
        True,
        f"重投成功！{creature.display_name} 第{slot_index+1}槽 → {new_affix['name']}",
        cost=cost,
        new_affix=new_affix,
    )


def upgrade(
    creature: Creature,
    slot_index: int,
    save: "SaveSlot",
    data: "GameData",
) -> WorkshopResult:
    balance = data.balance

    if slot_index < 0 or slot_index >= len(creature.affix_slots):
        return WorkshopResult(False, "无效的词条槽序号", cost={})

    slot = creature.affix_slots[slot_index]
    if slot.is_empty():
        return WorkshopResult(False, "词条槽为空，无法升阶", cost={})

    old_affix = data.affixes.get(slot.affix_id)
    if not old_affix:
        return WorkshopResult(False, "找不到词条数据", cost={})

    current_tier = old_affix["tier"]
    if current_tier == TIER_ORDER[-1]:
        return WorkshopResult(False, "已是最高品阶（虾玄✦），无法继续升阶", cost={})

    cost = _upgrade_cost(current_tier, balance)
    ok, msg = _can_afford(save, cost)
    if not ok:
        return WorkshopResult(False, msg, cost=cost)

    new_affix = upgrade_affix_slot(creature, slot_index, data)
    _deduct(save, cost)
    creature.affix_slots[slot_index].affix_id = new_affix["id"]

    return WorkshopResult(
        True,
        f"升阶成功！{old_affix['name']}（{current_tier}）→ {new_affix['name']}（{new_affix['tier']}）",
        cost=cost,
        new_affix=new_affix,
    )


def seal(
    creature: Creature,
    slot_index: int,
    save: "SaveSlot",
    data: "GameData",
) -> WorkshopResult:
    balance = data.balance
    cost = _seal_cost(balance)

    if slot_index < 0 or slot_index >= len(creature.affix_slots):
        return WorkshopResult(False, "无效的词条槽序号", cost={})

    slot = creature.affix_slots[slot_index]
    if slot.locked:
        return WorkshopResult(False, "词条已封印", cost={})
    if slot.is_empty():
        return WorkshopResult(False, "词条槽为空，无法封印", cost={})

    ok, msg = _can_afford(save, cost)
    if not ok:
        return WorkshopResult(False, msg, cost=cost)

    affix = data.affixes.get(slot.affix_id)
    _deduct(save, cost)
    slot.locked = True

    name = affix["name"] if affix else slot.affix_id
    return WorkshopResult(True, f"词条 {name} 已封印 🔒，不会被重投覆盖", cost=cost)


def unseal(
    creature: Creature,
    slot_index: int,
    save: "SaveSlot",
    data: "GameData",
) -> WorkshopResult:
    balance = data.balance
    cost = _unseal_cost(balance)

    if slot_index < 0 or slot_index >= len(creature.affix_slots):
        return WorkshopResult(False, "无效的词条槽序号", cost={})

    slot = creature.affix_slots[slot_index]
    if not slot.locked:
        return WorkshopResult(False, "词条未被封印", cost={})

    ok, msg = _can_afford(save, cost)
    if not ok:
        return WorkshopResult(False, msg, cost=cost)

    affix = data.affixes.get(slot.affix_id)
    _deduct(save, cost)
    slot.locked = False

    name = affix["name"] if affix else slot.affix_id
    return WorkshopResult(True, f"词条 {name} 封印已解除", cost=cost)


# --------------------------------------------------------------------------- #
# 工坊展示辅助
# --------------------------------------------------------------------------- #

def render_creature_affixes(creature: Creature, data: "GameData") -> str:
    lines = [f"{creature.display_name} Lv{creature.level} 词条："]
    for i, slot in enumerate(creature.affix_slots):
        label = format_affix_slot(slot, data)
        if not slot.is_empty():
            affix = data.affixes.get(slot.affix_id)
            desc = affix["description"] if affix else ""
            label = f"  [{i+1}] {label}  —  {desc}"
        else:
            label = f"  [{i+1}] {label}"
        lines.append(label)
    return "\n".join(lines)


def _format_cost(cost: dict, data: "GameData") -> str:
    """将 {item_id: count} 格式化为可读字符串，如 '甲核 ×3 / 灵晶 ×2'。"""
    if not cost:
        return "免费"
    parts = []
    for item_id, count in cost.items():
        name = data.items[item_id]["name"] if item_id in data.items else item_id
        parts.append(f"{name} ×{count}")
    return " / ".join(parts)


def render_material_costs(save: "SaveSlot", data: "GameData") -> str:
    balance = data.balance
    items_cfg = {
        "jihe_core": "甲核",
        "spirit_crystal": "灵晶",
        "tide_stone": "潮石",
    }
    lines = ["当前材料："]
    for item_id, name in items_cfg.items():
        count = save.get_item_count(item_id)
        lines.append(f"  {name}：{count}")
    # 操作费用速查
    rc = _reroll_cost(balance)
    uc0 = _upgrade_cost(TIER_ORDER[0], balance)
    lines.append(f"\n操作费用速查：")
    lines.append(f"  重投：{_format_cost(rc, data)}")
    lines.append(f"  升阶（common→blue）：{_format_cost(uc0, data)}")
    lines.append(f"  封印：{_format_cost(_seal_cost(balance), data)}")
    lines.append(f"  解封：{_format_cost(_unseal_cost(balance), data)}")
    return "\n".join(lines)
