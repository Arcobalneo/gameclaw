#!/usr/bin/env python3
"""Compile per-game loc modules + existing glossary into typed JSON catalogs."""
from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEV = ROOT.parent
SCRIPTS = Path(__file__).resolve().parent / "loc"
OUT = ROOT / "src" / "i18n" / "catalogs"
TERMS_PATH = SCRIPTS / "legacy-terms.json"

CJK = re.compile(r"[\u3400-\u9fff]")
SLOT = re.compile(r"\{(\d+)\}")

# Shared terms applied to every game, then overridden by the game glossary.
SHARED_TERMS = {
    "进行中": "In progress",
    "胜利": "Victory",
    "失败": "Defeat",
    "已中止": "Aborted",
    "中止": "Aborted",
    "放弃本局": "Abort run",
    "回合": "Turn",
    "种子": "Seed",
    "未知动作": "Unknown action",
    "合法动作": "Legal actions",
    "暂无": "none",
    "壳": "shell",
    "攻": "atk",
    "拦": "block",
    "拦口": "block",
    "再编": "reform",
    "视野": "vision",
    "压力": "pressure",
    "破甲": "sunder",
    "减速": "slow",
    "易伤": "vulnerable",
    "击退": "knockback",
    "返还": "refund",
    "冷却": "cooldown",
    "潮令": "orders",
    "完整度": "integrity",
    "第": "No.",
    "关": "Lv",
    "步": "step",
    "拍": "beat",
    "判定": "check",
    "成功": "success",
    "失败": "failure",
    "能": "energy",
    "盐": "salt",
    "名": "fame",
    "势": "momentum",
    "蜕": "molt",
    "基础": "base",
    "实际": "actual",
    "误差": "error",
}

SHARED_EXACT = {
    "放弃本局并诚实结算": "Abort this run and settle honestly",
    "运行 recap 查看结算。": "Run recap to read the settlement.",
    "运行 `actions` 查看当前合法动作。": "Run `actions` to see the legal moves.",
    "本局已经结束。": "This run is over.",
    "这一局还没有结束，以下只是当前局面。":
        "This run is still going; what follows is the current situation only.",
    "— 胜利 —": "— Victory —",
    "— 失败 —": "— Defeat —",
    "— 已中止 —": "— Aborted —",
    "— 胜利 WIN —": "— Victory —",
    "— 失败 LOST —": "— Defeat —",
    "— 已中止 ABORTED —": "— Aborted —",
}


def load_module(game: str):
    path = SCRIPTS / f"{game.replace('-', '_')}.py"
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location(game, path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


def infer_slots(zh: str, en: str) -> list[str]:
    kinds = []
    # Only inspect text immediately adjacent to THIS slot. A slash from a
    # previous `{0}/{1}` must not force a later name slot to be numeric.
    numeric_suffixes = (
        "壳", "攻", "拦", "潮令", "完整度", "漏", "cost ", "Pulse ", "pulse",
        "回合", "种子", "火候", "心情", "层", "关", "拍", "点", "次",
        "个常规", "返还", "冷却", "持续", "再编", "视野", "压力", "破甲", "减速",
        "易伤", "击退", "热度 ",
    )
    for m in SLOT.finditer(zh):
        start, end = m.span()
        left = zh[max(0, start - 8):start]
        right = zh[end:end + 6]
        adjacent = (
            left.endswith("/") or right.startswith("/")
            or left.endswith("%") or right.startswith("%")
            or left.endswith("°") or right.startswith("°")
            or left.endswith("+") or right.startswith("+")
        )
        if any(left.endswith(p) for p in numeric_suffixes) or adjacent:
            kinds.append("n")
        else:
            kinds.append("text")
    return kinds


def load_leftovers():
    path = SCRIPTS / "leftovers.py"
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location("leftovers", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


def merge_catalog(game: str, terms: dict, mod, extras=None) -> dict:
    exact = dict(SHARED_EXACT)
    pats: dict[str, str] = {}
    glossary = dict(SHARED_TERMS)
    glossary.update(terms)
    if mod:
        exact.update(getattr(mod, "EXACT", {}))
        pats.update(getattr(mod, "PATTERNS", {}))
        glossary.update(getattr(mod, "TERMS", {}))
        extra = SCRIPTS / ("catch_data.json" if game == "claw-catch" else "")
        if game == "claw-catch":
            extra = SCRIPTS / "catch_data.json"
            if extra.exists():
                glossary.update(json.loads(extra.read_text(encoding="utf-8")))
            lores = SCRIPTS / "catch_lores.json"
            if lores.exists():
                exact.update(json.loads(lores.read_text(encoding="utf-8")))
    if extras:
        exact.update(getattr(extras, "EXACT", {}).get(game, {}))
        pats.update(getattr(extras, "PATTERNS", {}).get(game, {}))
        glossary.update(getattr(extras, "TERMS", {}).get(game, {}))
    # Short exacts also become terms (names, labels).
    for k, v in list(exact.items()):
        if len(k) <= 12 and not SLOT.search(k):
            glossary.setdefault(k, v)
    patterns = []
    seen = set()
    for zh, en in pats.items():
        if zh in seen:
            continue
        seen.add(zh)
        if CJK.search(en):
            raise SystemExit(f"{game}: English pattern still has CJK: {en}")
        n_zh = len(SLOT.findall(zh))
        n_en = len(SLOT.findall(en))
        if n_zh != n_en:
            # allow unused slots? better to fail
            print(f"WARN {game}: slot count zh={n_zh} en={n_en} :: {zh}", file=sys.stderr)
        patterns.append({"zh": zh, "en": en, "slots": infer_slots(zh, en)})
    for k, v in exact.items():
        if CJK.search(v):
            raise SystemExit(f"{game}: English exact still has CJK: {k} -> {v}")
    return {"terms": glossary, "exact": exact, "patterns": patterns}


def main() -> None:
    terms_all = json.loads(TERMS_PATH.read_text()) if TERMS_PATH.exists() else {}
    OUT.mkdir(parents=True, exist_ok=True)
    games = sorted(set(terms_all) | {p.stem.replace("_", "-") for p in SCRIPTS.glob("claw_*.py")})
    index_imports = []
    index_regs = []
    extras = load_leftovers()
    for game in games:
        mod = load_module(game)
        cat = merge_catalog(game, terms_all.get(game, {}), mod, extras)
        dest = OUT / f"{game}.json"
        dest.write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        ident = game.replace("-", "_")
        index_imports.append(f"import {ident} from './{game}.json';")
        index_regs.append(f"registerCatalog('{game}', {ident} as GameCatalog);")
        print(f"{game:20s} terms={len(cat['terms']):4d} exact={len(cat['exact']):4d} patterns={len(cat['patterns']):3d}")

    index = Path(__file__).resolve().parents[1] / "src" / "i18n" / "catalogs" / "index.ts"
    body = """import type { GameCatalog } from './types';
""" + "\n".join(index_imports) + """

export type { GameCatalog, Pattern } from './types';

const EMPTY: GameCatalog = { terms: {}, exact: {}, patterns: [] };

const registry = new Map<string, GameCatalog>();

export function registerCatalog(id: string, catalog: GameCatalog): void {
  registry.set(id, catalog);
}

export function getCatalog(gameId: string): GameCatalog {
  return registry.get(gameId) ?? EMPTY;
}

export function allCatalogs(): ReadonlyMap<string, GameCatalog> {
  return registry;
}

""" + "\n".join(index_regs) + "\n"
    index.write_text(body, encoding="utf-8")
    print("wrote", index)


if __name__ == "__main__":
    main()
