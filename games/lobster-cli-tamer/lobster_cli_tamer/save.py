"""save.py – 3槽 JSON 本地存档系统。

存档路径：~/.lobster-cli-tamer/save_{slot}.json（slot = 0/1/2）
自动创建目录；存档完整序列化 / 反序列化，支持版本迁移。
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from lobster_cli_tamer.loader import GameData

from lobster_cli_tamer.creature import Creature

SAVE_DIR = Path.home() / ".lobster-cli-tamer"
SAVE_VERSION = 1
NUM_SLOTS = 3


# --------------------------------------------------------------------------- #
# 存档数据结构
# --------------------------------------------------------------------------- #

@dataclass
class SaveSlot:
    slot: int
    version: int = SAVE_VERSION
    player_name: str = "甲录师"
    playtime_seconds: int = 0

    # party: 最多 6 个，None=空槽
    party: list[Optional[Creature]] = field(default_factory=list)
    # box: 无限存储
    box: list[Creature] = field(default_factory=list)
    # memorial: 永久死亡的虾米（仅记录信息）
    memorial: list[dict[str, Any]] = field(default_factory=list)

    # 图鉴
    dex_seen: set[str] = field(default_factory=set)
    dex_caught: set[str] = field(default_factory=set)
    shiny_encountered: set[str] = field(default_factory=set)
    shiny_caught: set[str] = field(default_factory=set)

    # 解锁进度
    unlocked_zones: set[str] = field(default_factory=lambda: {"reef_zone"})
    current_zone_id: str = "reef_zone"
    current_sub_area_id: str = ""

    # 深渊进度
    deepest_abyss_floor: int = 0
    total_abyss_runs: int = 0

    # 材料仓库 {item_id: count}
    items: dict[str, int] = field(default_factory=lambda: {"net_basic": 5, "potion_minor": 3, "cure_plague": 1})

    # 统计
    total_battles: int = 0
    total_captures: int = 0
    total_deaths: int = 0  # 永久死亡数

    # ------------------------------------------------------------------ #
    # 序列化
    # ------------------------------------------------------------------ #

    def to_dict(self) -> dict[str, Any]:
        return {
            "slot": self.slot,
            "version": self.version,
            "player_name": self.player_name,
            "playtime_seconds": self.playtime_seconds,
            "party": [c.to_dict() if c else None for c in self.party],
            "box": [c.to_dict() for c in self.box],
            "memorial": self.memorial,
            "dex_seen": sorted(self.dex_seen),
            "dex_caught": sorted(self.dex_caught),
            "shiny_encountered": sorted(self.shiny_encountered),
            "shiny_caught": sorted(self.shiny_caught),
            "unlocked_zones": sorted(self.unlocked_zones),
            "current_zone_id": self.current_zone_id,
            "current_sub_area_id": self.current_sub_area_id,
            "deepest_abyss_floor": self.deepest_abyss_floor,
            "total_abyss_runs": self.total_abyss_runs,
            "items": self.items,
            "total_battles": self.total_battles,
            "total_captures": self.total_captures,
            "total_deaths": self.total_deaths,
        }

    @staticmethod
    def from_dict(d: dict[str, Any], data: "GameData") -> "SaveSlot":
        save = SaveSlot(slot=d["slot"])
        save.version = d.get("version", 1)
        save.player_name = d.get("player_name", "甲录师")
        save.playtime_seconds = d.get("playtime_seconds", 0)

        save.party = []
        for cd in d.get("party", []):
            if cd is None:
                save.party.append(None)
            else:
                try:
                    save.party.append(Creature.from_dict(cd, data))
                except Exception:
                    save.party.append(None)

        save.box = []
        for cd in d.get("box", []):
            try:
                save.box.append(Creature.from_dict(cd, data))
            except Exception:
                pass

        save.memorial = d.get("memorial", [])
        save.dex_seen = set(d.get("dex_seen", []))
        save.dex_caught = set(d.get("dex_caught", []))
        save.shiny_encountered = set(d.get("shiny_encountered", []))
        save.shiny_caught = set(d.get("shiny_caught", []))
        save.unlocked_zones = set(d.get("unlocked_zones", ["reef_zone"]))
        save.current_zone_id = d.get("current_zone_id", "reef_zone")
        save.current_sub_area_id = d.get("current_sub_area_id", "")
        save.deepest_abyss_floor = d.get("deepest_abyss_floor", 0)
        save.total_abyss_runs = d.get("total_abyss_runs", 0)
        save.items = d.get("items", {"net_basic": 5, "potion_minor": 3, "cure_plague": 1})
        save.total_battles = d.get("total_battles", 0)
        save.total_captures = d.get("total_captures", 0)
        save.total_deaths = d.get("total_deaths", 0)
        return save

    # ------------------------------------------------------------------ #
    # 快捷属性
    # ------------------------------------------------------------------ #

    @property
    def active_party(self) -> list[Creature]:
        return [c for c in self.party if c is not None and c.is_alive]

    @property
    def all_creatures(self) -> list[Creature]:
        party = [c for c in self.party if c is not None]
        return party + self.box

    def get_item_count(self, item_id: str) -> int:
        return self.items.get(item_id, 0)

    def consume_item(self, item_id: str, count: int = 1) -> bool:
        have = self.items.get(item_id, 0)
        if have < count:
            return False
        self.items[item_id] = have - count
        if self.items[item_id] == 0:
            del self.items[item_id]
        return True

    def add_item(self, item_id: str, count: int = 1) -> None:
        self.items[item_id] = self.items.get(item_id, 0) + count

    def add_to_memorial(self, creature: Creature, cause: str) -> None:
        self.memorial.append({
            "uid": creature.uid,
            "name": creature.display_name,
            "species_id": creature.species_id,
            "level": creature.level,
            "is_shiny": creature.is_shiny,
            "cause": cause,
        })
        self.total_deaths += 1

    def unlock_zone(self, zone_id: str) -> None:
        self.unlocked_zones.add(zone_id)


# --------------------------------------------------------------------------- #
# 存档 IO
# --------------------------------------------------------------------------- #

def _slot_path(slot: int) -> Path:
    return SAVE_DIR / f"save_{slot}.json"


def save_exists(slot: int) -> bool:
    return _slot_path(slot).exists()


def write_save(save: "SaveSlot") -> None:
    SAVE_DIR.mkdir(parents=True, exist_ok=True)
    path = _slot_path(save.slot)
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(save.to_dict(), f, ensure_ascii=False, indent=2)
    tmp.replace(path)  # 原子写入


def load_save(slot: int, data: "GameData") -> "SaveSlot":
    path = _slot_path(slot)
    if not path.exists():
        raise FileNotFoundError(f"存档槽 {slot} 不存在")
    with path.open("r", encoding="utf-8") as f:
        d = json.load(f)
    save = SaveSlot.from_dict(d, data)
    _migrate(save)
    return save


def delete_save(slot: int) -> bool:
    path = _slot_path(slot)
    if path.exists():
        path.unlink()
        return True
    return False


def list_save_summaries() -> list[dict[str, Any]]:
    """列出所有存档槽摘要（用于开始菜单）。不需要 data，只读 JSON。"""
    result = []
    for slot in range(NUM_SLOTS):
        path = _slot_path(slot)
        if not path.exists():
            result.append({"slot": slot, "exists": False})
            continue
        try:
            with path.open("r", encoding="utf-8") as f:
                d = json.load(f)
            result.append({
                "slot": slot,
                "exists": True,
                "player_name": d.get("player_name", "未知"),
                "playtime_seconds": d.get("playtime_seconds", 0),
                "party_count": sum(1 for c in d.get("party", []) if c),
                "dex_caught": len(d.get("dex_caught", [])),
                "deepest_abyss_floor": d.get("deepest_abyss_floor", 0),
                "version": d.get("version", 1),
            })
        except Exception:
            result.append({"slot": slot, "exists": True, "corrupt": True})
    return result


def new_save(slot: int, player_name: str = "甲录师") -> "SaveSlot":
    save = SaveSlot(slot=slot, player_name=player_name)
    write_save(save)
    return save


# --------------------------------------------------------------------------- #
# last_slot 指针（agent 无人值守续档）
# --------------------------------------------------------------------------- #

_LAST_SLOT_FILE = SAVE_DIR / "last_slot"


def write_last_slot(slot: int) -> None:
    """记录上次使用的存档槽号，供下次启动自动续档。"""
    SAVE_DIR.mkdir(parents=True, exist_ok=True)
    _LAST_SLOT_FILE.write_text(str(slot), encoding="utf-8")


def read_last_slot() -> Optional[int]:
    """读取上次存档槽号；文件不存在或无效则返回 None。"""
    try:
        val = int(_LAST_SLOT_FILE.read_text(encoding="utf-8").strip())
        if val in range(NUM_SLOTS) and save_exists(val):
            return val
    except Exception:
        pass
    return None


# --------------------------------------------------------------------------- #
# 版本迁移（预留）
# --------------------------------------------------------------------------- #

def _migrate(save: "SaveSlot") -> None:
    if save.version < SAVE_VERSION:
        # 未来版本迁移逻辑在此添加
        save.version = SAVE_VERSION
