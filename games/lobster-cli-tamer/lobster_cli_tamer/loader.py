from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class GameData:
    balance: dict[str, Any]
    species: dict[str, dict[str, Any]]
    skills: dict[str, dict[str, Any]]
    affixes: dict[str, dict[str, Any]]
    zones: dict[str, dict[str, Any]]
    enemies: dict[str, dict[str, Any]]
    items: dict[str, dict[str, Any]]
    tower_config: dict[str, Any]


PACKAGE_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = PACKAGE_ROOT / "data"


class DataValidationError(RuntimeError):
    pass


def _read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _require_keys(obj: dict[str, Any], keys: list[str], ctx: str) -> None:
    missing = [k for k in keys if k not in obj]
    if missing:
        raise DataValidationError(f"{ctx} 缺少字段: {', '.join(missing)}")


def _load_species() -> dict[str, dict[str, Any]]:
    species_dir = DATA_ROOT / "species"
    result: dict[str, dict[str, Any]] = {}
    for path in sorted(species_dir.glob("*.json")):
        rows = _read_json(path)
        if not isinstance(rows, list):
            raise DataValidationError(f"{path.name} 必须是数组")
        for row in rows:
            _require_keys(
                row,
                [
                    "id",
                    "name",
                    "type",
                    "rarity",
                    "base_stats",
                    "stat_growth",
                    "base_skill",
                    "skill_pool_tags",
                    "affix_slots",
                    "capture_base_rate",
                    "habitat",
                    "lore",
                ],
                f"species:{path.name}",
            )
            sid = row["id"]
            if sid in result:
                raise DataValidationError(f"重复 species id: {sid}")
            result[sid] = row
    return result


def _load_skill_files() -> dict[str, dict[str, Any]]:
    skill_dir = DATA_ROOT / "skills"
    result: dict[str, dict[str, Any]] = {}
    for path in sorted(skill_dir.glob("*.json")):
        rows = _read_json(path)
        if not isinstance(rows, list):
            raise DataValidationError(f"{path.name} 必须是数组")
        for row in rows:
            _require_keys(
                row,
                ["id", "name", "type", "category", "power", "accuracy", "effects", "tags", "description"],
                f"skills:{path.name}",
            )
            sid = row["id"]
            if sid in result:
                raise DataValidationError(f"重复 skill id: {sid}")
            result[sid] = row
    return result


def _load_indexed_array(path: Path, required_keys: list[str], name: str) -> dict[str, dict[str, Any]]:
    rows = _read_json(path)
    if not isinstance(rows, list):
        raise DataValidationError(f"{path.name} 必须是数组")
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        _require_keys(row, required_keys, f"{name}:{path.name}")
        rid = row["id"]
        if rid in result:
            raise DataValidationError(f"重复 {name} id: {rid}")
        result[rid] = row
    return result


def _load_zones() -> dict[str, dict[str, Any]]:
    rows = _read_json(DATA_ROOT / "zones.json")
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        _require_keys(row, ["id", "name", "unlock_condition", "sub_areas"], "zones")
        rid = row["id"]
        if rid in result:
            raise DataValidationError(f"重复 zone id: {rid}")
        result[rid] = row
    return result


def _validate_cross_refs(data: GameData) -> None:
    for sid, species in data.species.items():
        base_skill = species["base_skill"]
        if base_skill not in data.skills_by_name:
            raise DataValidationError(f"species {sid} 的 base_skill 未在技能库中定义: {base_skill}")
        evo = species.get("evolution")
        if evo and evo.get("target") and evo["target"] not in data.species:
            raise DataValidationError(f"species {sid} 的 evolution target 不存在: {evo['target']}")

    for zone_id, zone in data.zones.items():
        for sub in zone["sub_areas"]:
            _require_keys(sub, ["id", "name", "level_range", "encounter_table"], f"zone:{zone_id}")
            for entry in sub["encounter_table"]:
                _require_keys(entry, ["species_id", "weight"], f"zone:{zone_id}:encounter")
                if entry["species_id"] not in data.species:
                    raise DataValidationError(f"zone {zone_id} 引用了不存在的 species: {entry['species_id']}")

    bands = data.tower_config.get("enemy_pool_by_band", [])
    for band in bands:
        for species_id in band.get("species_ids", []):
            if species_id not in data.species:
                raise DataValidationError(f"tower_config 引用了不存在的 species: {species_id}")

    for boss in data.tower_config.get("bosses", []):
        if boss.get("species_id") not in data.species:
            raise DataValidationError(f"boss 引用了不存在的 species: {boss.get('species_id')}")


@property
def skills_by_name(self) -> dict[str, dict[str, Any]]:  # type: ignore[misc]
    return {row["name"]: row for row in self.skills.values()}


GameData.skills_by_name = skills_by_name  # type: ignore[attr-defined]


def load_game_data() -> GameData:
    balance = _read_json(DATA_ROOT / "balance.json")
    species = _load_species()
    skills = _load_skill_files()
    affixes = _load_indexed_array(DATA_ROOT / "affixes.json", ["id", "name", "tier", "trigger", "effect", "description"], "affix")
    zones = _load_zones()
    enemies = _load_indexed_array(DATA_ROOT / "enemies.json", ["id"], "enemy") if (DATA_ROOT / "enemies.json").stat().st_size > 3 else {}
    items = _load_indexed_array(DATA_ROOT / "items.json", ["id", "name", "type", "description"], "item")
    tower_config = _read_json(DATA_ROOT / "tower_config.json")

    data = GameData(
        balance=balance,
        species=species,
        skills=skills,
        affixes=affixes,
        zones=zones,
        enemies=enemies,
        items=items,
        tower_config=tower_config,
    )
    _validate_cross_refs(data)
    return data


def summarize_game_data() -> dict[str, int]:
    data = load_game_data()
    return {
        "species": len(data.species),
        "skills": len(data.skills),
        "affixes": len(data.affixes),
        "zones": len(data.zones),
        "items": len(data.items),
        "bosses": len(data.tower_config.get("bosses", [])),
    }
