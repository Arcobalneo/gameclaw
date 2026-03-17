"""render.py – CLI 渲染层（纯文本输出，不依赖 curses）。

所有 print() 都经由此模块，方便后续换为 rich 或其他库。
"""
from __future__ import annotations

from typing import Any, Optional

from lobster_cli_tamer.creature import Creature
from lobster_cli_tamer.affixes import format_affix_slot, TIER_SYMBOLS

# --------------------------------------------------------------------------- #
# 颜色（ANSI，终端不支持时降级）
# --------------------------------------------------------------------------- #

_USE_COLOR = True

def _c(code: str, text: str) -> str:
    if not _USE_COLOR:
        return text
    return f"\033[{code}m{text}\033[0m"

RED    = lambda t: _c("31", t)
GREEN  = lambda t: _c("32", t)
YELLOW = lambda t: _c("33", t)
CYAN   = lambda t: _c("36", t)
BOLD   = lambda t: _c("1", t)
DIM    = lambda t: _c("2", t)
MAGENTA = lambda t: _c("35", t)


# --------------------------------------------------------------------------- #
# 基础 UI 块
# --------------------------------------------------------------------------- #

def hr(char: str = "─", width: int = 48) -> None:
    print(char * width)

def section(title: str) -> None:
    print()
    hr("═")
    print(f"  {BOLD(title)}")
    hr("═")

def info(msg: str) -> None:
    print(f"  {msg}")

def warn(msg: str) -> None:
    print(f"  {YELLOW('⚠')} {msg}")

def success(msg: str) -> None:
    print(f"  {GREEN('✓')} {msg}")

def error(msg: str) -> None:
    print(f"  {RED('✗')} {msg}")


# --------------------------------------------------------------------------- #
# 虾米展示
# --------------------------------------------------------------------------- #

def render_creature_brief(c: Creature, data: Any = None, index: Optional[int] = None) -> str:
    shiny = YELLOW("✦ ") if c.is_shiny else ""
    plague = RED(" 🦠") if c.has_plague else ""
    dead = DIM(" [已阵亡]") if c.dead else ""
    hp_bar = _hp_bar(c.hp_current, c.stats["hp"])
    name = c.display_name
    idx = f"[{index}] " if index is not None else ""
    return (f"{idx}{shiny}{BOLD(name)} Lv{c.level}  "
            f"{hp_bar} {c.hp_current:.0f}/{c.stats['hp']:.0f}{plague}{dead}")


def _hp_bar(current: float, maximum: float, width: int = 10) -> str:
    pct = max(0.0, min(1.0, current / max(1, maximum)))
    filled = round(pct * width)
    bar = "█" * filled + "░" * (width - filled)
    if pct > 0.5:
        color = GREEN
    elif pct > 0.25:
        color = YELLOW
    else:
        color = RED
    return f"[{color(bar)}]"


def render_creature_detail(c: Creature, data: Any) -> None:
    section(f"{c.display_name}（{data.species[c.species_id]['name']}）")
    sp = data.species[c.species_id]
    info(f"等级：Lv{c.level}  类型：{sp['type']}  捕捉地：{c.captured_zone or '未知'}")
    info(f"HP：{c.hp_current:.0f}/{c.stats['hp']:.0f}  "
         f"ATK：{c.stats['atk']:.0f}  DEF：{c.stats['def']:.0f}  "
         f"SPD：{c.stats['spd']:.0f}  END：{c.stats['end']:.0f}")
    info(f"技能：{' | '.join(c.moves) or '无'}")
    hr()
    info("词条槽：")
    for i, slot in enumerate(c.affix_slots):
        label = format_affix_slot(slot, data)
        if not slot.is_empty():
            aff = data.affixes.get(slot.affix_id)
            desc = aff["description"] if aff else ""
            info(f"  [{i+1}] {label} — {desc}")
        else:
            info(f"  [{i+1}] {label}")
    if c.has_plague:
        warn(f"携带深渊疫病（已历 {c.plague_floors} 层，死亡率 {c.plague_floors*5:.0f}%）")
    if c.is_shiny:
        info(YELLOW("✦ 灵光虾米"))


def render_party(party: list, data: Any) -> None:
    section("当前队伍")
    alive = [c for c in party if c]
    if not alive:
        warn("队伍为空")
        return
    for i, c in enumerate(party):
        if c is None:
            info(f"[{i}] — 空槽")
        else:
            info(render_creature_brief(c, data, index=i))


# --------------------------------------------------------------------------- #
# 战斗渲染
# --------------------------------------------------------------------------- #

def render_battle_log(lines: list[str], max_lines: int = 12) -> None:
    for line in lines[-max_lines:]:
        if "造成" in line or "伤害" in line:
            print(f"  {RED(line.strip())}")
        elif "回复" in line or "护盾" in line:
            print(f"  {GREEN(line.strip())}")
        elif "✦" in line or "词条" in line:
            print(f"  {YELLOW(line.strip())}")
        elif "会心" in line:
            print(f"  {MAGENTA(line.strip())}")
        elif "──" in line:
            print(DIM(line))
        else:
            print(f"  {line.strip()}")


def render_battle_status(status_bar: str) -> None:
    for line in status_bar.splitlines():
        if "[我方]" in line:
            print(f"  {CYAN(line)}")
        elif "[对手]" in line:
            print(f"  {RED(line)}")
        else:
            print(f"  {line}")


# --------------------------------------------------------------------------- #
# 菜单渲染
# --------------------------------------------------------------------------- #

def render_menu(title: str, options: list[tuple[str, str]], prompt: str = "选择：") -> None:
    """渲染编号菜单，options = [(key, label), ...]"""
    print()
    print(f"  {BOLD(title)}")
    hr("─", 40)
    for key, label in options:
        print(f"  {CYAN(f'[{key}]')} {label}")
    hr("─", 40)
    print(f"  {prompt}", end="", flush=True)


def prompt_input(label: str = "") -> str:
    if label:
        print(f"  {label}", end="", flush=True)
    return input()


# --------------------------------------------------------------------------- #
# 存档菜单
# --------------------------------------------------------------------------- #

def render_save_summaries(summaries: list[dict]) -> None:
    section("存档选择")
    for s in summaries:
        slot = s["slot"]
        if not s.get("exists"):
            info(f"  [槽{slot}] — 空档")
        elif s.get("corrupt"):
            warn(f"  [槽{slot}] ⚠ 存档损坏")
        else:
            pt = s.get("playtime_seconds", 0)
            h, m = divmod(pt // 60, 60)
            info(f"  [槽{slot}] {s.get('player_name','?')}  "
                 f"队伍{s.get('party_count',0)}只  "
                 f"图鉴{s.get('dex_caught',0)}种  "
                 f"深渊第{s.get('deepest_abyss_floor',0)}层  "
                 f"游戏时长{h}h{m:02d}m")


# --------------------------------------------------------------------------- #
# Observer URL 横幅（游戏启动时调用）
# --------------------------------------------------------------------------- #

def print_observer_banner(url: str) -> None:
    line = f"  实时观战看板：{url}  "
    border = "═" * len(line)
    print(f"\n{CYAN('╔' + border + '╗')}")
    print(f"{CYAN('║')}{line}{CYAN('║')}")
    print(f"{CYAN('╚' + border + '╝')}\n")


# --------------------------------------------------------------------------- #
# 捕捉滚球动画（简单文字版）
# --------------------------------------------------------------------------- #

def render_capture_ball_animation(captured: bool, rate: float) -> None:
    import time
    frames = ["○", "◐", "●", "◑", "●", "◑", "●"]
    for f in frames:
        print(f"\r  捕捉球 {YELLOW(f)} 摇晃中…", end="", flush=True)
        time.sleep(0.15)
    print()
    if captured:
        globals()["success"]("捕捉成功！🎉")
    else:
        error(f"失败，虾米挣脱了！（捕捉率 {rate*100:.1f}%）")


# --------------------------------------------------------------------------- #
# 灵光特效
# --------------------------------------------------------------------------- #

def render_shiny_effect(species_name: str) -> None:
    print()
    print(YELLOW("  ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦"))
    print(YELLOW(f"      灵光！{species_name} 闪闪发光！"))
    print(YELLOW("  ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦"))
    print()
