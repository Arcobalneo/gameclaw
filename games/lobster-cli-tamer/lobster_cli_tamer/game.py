"""game.py - 游戏主状态机 + CLI 主入口。

Game 类驱动：主菜单 → 野外探索 / 深渊 / 词条工坊 / 图鉴 / 存档管理
"""
from __future__ import annotations

import argparse
import sys
import time
from dataclasses import dataclass
from typing import Any, Optional

from lobster_cli_tamer.loader import load_game_data, GameData
from lobster_cli_tamer.save import (
    new_save, load_save, write_save, list_save_summaries, save_exists,
    SaveSlot, SAVE_DIR,
    write_last_slot, read_last_slot,
)
from lobster_cli_tamer.creature import Creature
from lobster_cli_tamer.world import (
    WorldSession, WorldEventType, WorldEvent, check_zone_unlock,
)
from lobster_cli_tamer.tower import TowerSession, TowerEventType
from lobster_cli_tamer.workshop import (
    reroll, upgrade, seal, unseal,
    render_creature_affixes, render_material_costs,
)
from lobster_cli_tamer.observer import ObserverServer
from lobster_cli_tamer.report import generate_session_report
from lobster_cli_tamer.render import (
    section, info, warn, success, error, hr,
    render_party, render_creature_detail, render_battle_log, render_battle_status,
    render_save_summaries, render_menu,
    print_observer_banner, render_shiny_effect, render_capture_ball_animation,
    set_use_color,
    GREEN, CYAN, BOLD, YELLOW, RED,
)
from lobster_cli_tamer.combat import BattleAction, ActionType


# --------------------------------------------------------------------------- #
# 启动配置 / 游戏类
# --------------------------------------------------------------------------- #

@dataclass
class GameOptions:
    terminal_native: bool = False
    no_color: bool = False
    no_banner: bool = False
    no_observer: bool = False
    save_slot: Optional[int] = None
    player_name: Optional[str] = None


class Game:
    def __init__(self, options: Optional[GameOptions] = None) -> None:
        self.options = options or GameOptions()
        self.data: Optional[GameData] = None
        self.save: Optional[SaveSlot] = None
        self.observer = ObserverServer()
        self._start_time = time.time()

    def _emit_state(self, state: str) -> None:
        if self.options.terminal_native:
            print(f"STATE: {state}")

    def _emit_actions(self, actions: list[tuple[str, str]]) -> None:
        if not self.options.terminal_native:
            return
        formatted = ",".join(f"{key}={label}" for key, label in actions)
        print(f"ACTIONS: {formatted}")

    def _emit_prompt(self, prompt_label: str = "INPUT_ACTION") -> None:
        if self.options.terminal_native:
            print(f"PROMPT: {prompt_label}")

    def _warn_invalid_input(self) -> None:
        if self.options.terminal_native:
            print("ERROR: INVALID_INPUT")
            return
        warn("输入无效")

    def _wait_for_enter(
        self,
        *,
        state: str,
        action: str,
        prompt: Optional[str] = None,
    ) -> None:
        message = prompt or ("  按 Enter 返回…" if action == "返回" else "  按 Enter 继续…")
        self._read_line(
            message,
            state=state,
            actions=[("enter", action)],
            prompt_label="PRESS_ENTER",
        )

    def _read_line(
        self,
        prompt: str = "",
        *,
        state: Optional[str] = None,
        actions: Optional[list[tuple[str, str]]] = None,
        prompt_label: str = "INPUT_ACTION",
    ) -> str:
        if state is not None:
            self._emit_state(state)
        if actions is not None:
            self._emit_actions(actions)
        if prompt_label:
            self._emit_prompt(prompt_label)
        return input(prompt)

    def _read_menu_choice(
        self,
        state: str,
        title: str,
        options: list[tuple[str, str]],
        *,
        prompt: str = "选择：",
        action_summary: Optional[list[tuple[str, str]]] = None,
        prompt_label: str = "INPUT_ACTION",
    ) -> str:
        render_menu(
            title,
            options,
            prompt=None if self.options.terminal_native else prompt,
            compact=self.options.terminal_native,
        )
        if self.options.terminal_native:
            self._emit_state(state)
            self._emit_actions(action_summary if action_summary is not None else options)
            self._emit_prompt(prompt_label)
        return input()

    # ------------------------------------------------------------------ #
    # 启动
    # ------------------------------------------------------------------ #

    def run(self) -> None:
        set_use_color(not self.options.no_color)
        self._print_title()
        self._start_observer()

        print("  正在加载游戏数据…", end="", flush=True)
        self.data = load_game_data()
        print(" 完成")

        self._select_save()
        if not self.save:
            print("未选择存档，退出")
            return

        self._main_menu()
        self._on_exit()

    def _print_title(self) -> None:
        if self.options.no_banner:
            return
        print()
        print(CYAN("  ╔═══════════════════════════════════════╗"))
        print(CYAN("  ║") + BOLD("   🦞  横着抓：只给龙虾玩的 CLI 捕兽养成   ") + CYAN("║"))
        print(CYAN("  ╚═══════════════════════════════════════╝"))
        print()

    def _start_observer(self) -> None:
        if self.options.no_observer:
            return
        ok = self.observer.start(8000)
        if ok:
            print_observer_banner(self.observer.url)
        else:
            warn("无法启动实时看板（端口占用），继续游戏")

    # ------------------------------------------------------------------ #
    # 存档选择
    # ------------------------------------------------------------------ #

    def _select_save(self) -> None:
        # ── 显式指定槽位优先 ───────────────────────────────────
        if self.options.save_slot is not None:
            slot = self.options.save_slot
            if slot not in (0, 1, 2):
                warn("--save-slot 仅支持 0/1/2，已忽略")
            else:
                summaries = list_save_summaries()
                if summaries[slot].get("exists"):
                    self.save = load_save(slot, self.data)
                    write_last_slot(slot)
                    check_zone_unlock(self.save, self.data)
                    self._grant_emergency_net_if_needed()
                    self._push_party()
                    return
                player_name = self.options.player_name or "甲录师"
                self.save = new_save(slot, player_name)
                write_save(self.save)
                write_last_slot(slot)
                check_zone_unlock(self.save, self.data)
                self._grant_starter_if_needed()
                self._grant_emergency_net_if_needed()
                self._push_party()
                return

        # ── last_slot 快速续档 ──────────────────────────────────
        last = read_last_slot()
        if last is not None:
            summaries = list_save_summaries()
            s = summaries[last]
            pt = s.get("playtime_seconds", 0)
            h, m = divmod(pt // 60, 60)
            info(f"上次存档：槽{last} · {s.get('player_name','?')} · "
                 f"队伍{s.get('party_count',0)}只 · 深渊第{s.get('deepest_abyss_floor',0)}层 · {h}h{m:02d}m")
            ans = self._read_line(
                "  继续上次存档？(Enter=yes / n=选其他槽) ",
                state="SAVE_CONTINUE",
                actions=[("enter", "继续"), ("n", "选槽")],
            ).strip().lower()
            if ans != "n":
                self.save = load_save(last, self.data)
                write_last_slot(last)
                check_zone_unlock(self.save, self.data)
                self._grant_emergency_net_if_needed()
                self._push_party()
                return

        # ── 常规槽位选择 ───────────────────────────────────────
        summaries = list_save_summaries()
        render_save_summaries(summaries)
        save_options = [
            (str(i), f"槽{i}：{'新建' if not summaries[i].get('exists') else summaries[i].get('player_name','?')}")
            for i in range(3)
        ] + [("q", "退出")]
        choice = self._read_menu_choice(
            "SAVE_SELECT",
            "选择存档槽",
            save_options,
            action_summary=[("0", "槽0"), ("1", "槽1"), ("2", "槽2"), ("q", "退出")],
        ).strip().lower()
        if choice == "q":
            return
        try:
            slot = int(choice)
            if slot not in (0, 1, 2):
                raise ValueError
        except ValueError:
            self._warn_invalid_input(); return

        if save_exists(slot):
            self.save = load_save(slot, self.data)
        else:
            default_name = self.options.player_name or '甲录师'
            name = self._read_line(
                f'  新存档 — 输入你的名字（回车默认"{default_name}"）：',
                state="SAVE_NAME",
                actions=[("text", "玩家名"), ("enter", f"默认({default_name})")],
                prompt_label="INPUT_PLAYER_NAME",
            ).strip() or default_name
            self.save = new_save(slot, player_name=name)
            self._grant_starter_if_needed()

        write_last_slot(self.save.slot)
        check_zone_unlock(self.save, self.data)
        self._grant_starter_if_needed()
        self._grant_emergency_net_if_needed()
        self._push_party()

    # ------------------------------------------------------------------ #
    # 主菜单
    # ------------------------------------------------------------------ #

    def _grant_starter_if_needed(self) -> None:
        if not self.save or not self.data:
            return
        has_any = any(c is not None for c in self.save.party) or bool(self.save.box)
        if has_any:
            return
        starter = Creature.from_species("reef_shrimp", self.data, level=5)
        starter.bind_species_data(self.data)
        starter.moves = [self.data.species[starter.species_id]["base_skill"]]
        self.save.party = [starter, None, None, None, None, None]
        self.save.dex_seen.add(starter.species_id)
        self.save.dex_caught.add(starter.species_id)
        success("已发放起始虾米：礁虾 Lv5")
        write_save(self.save)

    def _grant_emergency_net_if_needed(self) -> None:
        if not self.save or not self.data:
            return
        capture_total = sum(
            count
            for item_id, count in self.save.items.items()
            if item_id.startswith("net_") or item_id == "shiny_trap"
        )
        if capture_total > 0:
            return
        self.save.add_item("net_basic", 1)
        self.save.capture_tool_pity = 0
        success("已触发保底补给：补发 甲网 ×1")
        write_save(self.save)

    def _main_menu(self) -> None:
        while True:
            section("主菜单")
            render_party(self.save.party, self.data)
            main_options = [
                ("1", "野外探索"),
                ("2", f"进入深渊（最深 {self.save.deepest_abyss_floor} 层）"),
                ("3", "词条工坊"),
                ("4", "查看图鉴"),
                ("5", "查看队伍详情"),
                ("6", "存档"),
                ("q", "退出"),
            ]
            choice = self._read_menu_choice(
                "MAIN_MENU",
                "选择行动",
                main_options,
                action_summary=[
                    ("1", "探索"),
                    ("2", "深渊"),
                    ("3", "工坊"),
                    ("4", "图鉴"),
                    ("5", "队伍"),
                    ("6", "存档"),
                    ("q", "退出"),
                ],
            ).strip().lower()
            if choice == "1":
                self._zone_select()
            elif choice == "2":
                self._abyss_loop()
            elif choice == "3":
                self._workshop_menu()
            elif choice == "4":
                self._dex_view()
            elif choice == "5":
                self._party_detail()
            elif choice == "6":
                write_save(self.save)
                success("存档已保存")
            elif choice == "q":
                write_save(self.save)
                break
            else:
                self._warn_invalid_input()

    # ------------------------------------------------------------------ #
    # 野外探索
    # ------------------------------------------------------------------ #

    def _zone_select(self) -> None:
        zones = [z for zid, z in self.data.zones.items() if zid in self.save.unlocked_zones]
        if not zones:
            warn("没有可进入的区域"); return
        opts = [(str(i+1), f"{z['name']} - {z.get('description','')}") for i, z in enumerate(zones)]
        opts.append(("0", "返回"))
        choice = self._read_menu_choice("ZONE_SELECT", "选择探索区域", opts).strip()
        if choice == "0": return
        try:
            z = zones[int(choice)-1]
        except (ValueError, IndexError):
            self._warn_invalid_input(); return

        # 子区域选择
        subs = z["sub_areas"]
        if len(subs) > 1:
            sub_opts = [(str(i+1), s["name"]) for i, s in enumerate(subs)]
            sub_opts.append(("0", "返回"))
            sc = self._read_menu_choice("SUBAREA_SELECT", f"[{z['name']}] 选择子区域", sub_opts).strip()
            if sc == "0": return
            try:
                sub = subs[int(sc)-1]
            except (ValueError, IndexError):
                self._warn_invalid_input(); return
        else:
            sub = subs[0]

        self._explore_loop(z["id"], sub["id"])

    def _explore_loop(self, zone_id: str, sub_area_id: str) -> None:
        ws = WorldSession(zone_id, sub_area_id, self.save, self.data)
        zone = self.data.zones[zone_id]
        sub = next(s for s in zone["sub_areas"] if s["id"] == sub_area_id)
        section(f"探索：{zone['name']} / {sub['name']}")
        info("（按 Enter 继续探索；输入 q 离开）")

        while True:
            cmd = self._read_line(
                "" if self.options.terminal_native else "  > ",
                state="EXPLORE_LOOP",
                actions=[("enter", "继续探索"), ("q", "离开探索")],
            ).strip().lower()
            if cmd == "q":
                ws.end_explore()
                break
            if cmd != "":
                self._warn_invalid_input()
                continue

            events = ws.step()
            self._process_world_events(ws, events)

            if ws._pending_skill_choice:
                creature, choices = ws._pending_skill_choice
                self._skill_choice_prompt(ws, choices, creature)

            if not self.save.active_party:
                warn("队伍全灭，返回主菜单"); break

        check_zone_unlock(self.save, self.data)
        write_save(self.save)
        self._push_party()

    def _process_world_events(self, ws: WorldSession, events: list[WorldEvent]) -> None:
        for ev in events:
            if ev.message:
                info(ev.message)
            if ev.event_type == WorldEventType.SHINY_APPEARED:
                spid = ev.data.get("species_id", "")
                render_shiny_effect(self.data.species.get(spid, {}).get("name", spid))
            self.observer.push(ev.event_type.name.lower(), ev.data, ev.message)

        if not ws.is_in_battle():
            return

        # 战斗 sub-loop
        while ws.is_in_battle():
            self._render_battle_state(ws._battle_engine)
            move_opts = [(str(i+1), name) for i, name in enumerate(ws._battle_engine.available_player_moves())]
            move_opts.append(("c", "使用捕捉球"))
            move_opts.append(("r", "逃跑"))
            cmd = self._read_menu_choice("BATTLE_MENU", "战斗行动", move_opts).strip().lower()

            if cmd == "r":
                evts = ws.battle_turn(BattleAction(action_type=ActionType.SURRENDER))
            elif cmd == "c":
                # 捕捉球选择子菜单
                capture_items = [
                    it for it in self.data.items.values()
                    if it.get("type") == "capture"
                    and self.save.get_item_count(it["id"]) > 0
                ]
                if not capture_items:
                    warn("没有捕捉球了！"); continue
                if len(capture_items) == 1:
                    item_id = capture_items[0]["id"]
                else:
                    sub_opts = [
                        (str(i+1), f"{it['name']} ×{self.save.get_item_count(it['id'])}  倍率 {it.get('multiplier',1.0)}×")
                        for i, it in enumerate(capture_items)
                    ] + [("0", "取消")]
                    sc = self._read_menu_choice("CAPTURE_ITEM_SELECT", "选择捕捉球", sub_opts).strip()
                    if sc == "0": continue
                    try:
                        item_id = capture_items[int(sc)-1]["id"]
                    except (ValueError, IndexError):
                        self._warn_invalid_input(); continue
                evts = ws.battle_turn(BattleAction(action_type=ActionType.USE_SKILL,
                                                    skill_name=f"__capture__{item_id}"))
                for ev in evts:
                    if ev.event_type == WorldEventType.CAPTURE_ATTEMPT:
                        render_capture_ball_animation(
                            any(e.event_type == WorldEventType.CAPTURE_SUCCESS for e in evts),
                            ev.data.get("rate", 0),
                        )
            else:
                try:
                    idx = int(cmd) - 1
                    skill = ws._battle_engine.available_player_moves()[idx]
                    evts = ws.battle_turn(BattleAction(action_type=ActionType.USE_SKILL, skill_name=skill))
                except (ValueError, IndexError):
                    self._warn_invalid_input(); continue

            for ev in evts:
                if ev.message: info(ev.message)
                if ev.event_type == WorldEventType.BATTLE_TURN:
                    render_battle_log(ev.data.get("log", []))
                    render_battle_status(ev.data.get("status_bar", ""))
                # 12.1 精确写盘：捕捉成功 / 战斗结束（EXP+死亡结算后）立即持久化
                if ev.event_type in (
                    WorldEventType.CAPTURE_SUCCESS,
                    WorldEventType.BATTLE_END,
                    WorldEventType.PARTY_WIPED,
                ):
                    write_save(self.save)
                self.observer.push(ev.event_type.name.lower(), ev.data, ev.message)

    def _render_battle_state(self, engine: Any) -> None:
        if engine:
            print()
            render_battle_status(engine.render_status_bar())

    # ------------------------------------------------------------------ #
    # 深渊
    # ------------------------------------------------------------------ #

    def _abyss_loop(self) -> None:
        if not self.save.active_party:
            warn("队伍全灭，无法进入深渊"); return

        section("进入深渊")
        info(f"当前队伍：{len(self.save.active_party)} 只虾米")
        warn("⚠ 深渊模式：HP归零=永久死亡！所有层都会累积深渊污染，退出时可能带病/带污染离开")
        confirm = self._read_line(
            "  确认进入？(y/n) ",
            state="ABYSS_CONFIRM",
            actions=[("y", "进入"), ("n", "返回")],
        ).strip().lower()
        if confirm != "y": return

        tower = TowerSession(self.save, self.data)

        while self.save.active_party:
            info(f"\n  当前队伍存活：{', '.join(c.display_name for c in self.save.active_party)}")
            action = self._read_line(
                f"  [深渊第{tower.floor+1}层] 前进(↵) / 撤退(q)? ",
                state="ABYSS_DECISION",
                actions=[("enter", "前进"), ("q", "撤退")],
            ).strip().lower()
            if action == "q":
                evts = [e for e in tower._settle_plague()]
                for ev in evts:
                    if ev.message: info(ev.message)
                self.save.total_abyss_runs += 1
                tower.floor = 0
                break

            evts = tower.enter_next_floor()
            for ev in evts:
                if ev.message: info(ev.message)
                self.observer.push(ev.event_type.name.lower(), ev.data, ev.message)

            while tower.is_in_battle():
                eng = tower._battle_engine
                if eng:
                    render_battle_status(eng.render_status_bar())
                moves = tower._battle_engine.available_player_moves() if tower._battle_engine else []
                opts = [(str(i+1), n) for i, n in enumerate(moves)] + [("r", "尝试撤退（本回合无效，下层才能退）")]
                cmd = self._read_menu_choice("BATTLE_MENU", "战斗", opts).strip().lower()
                if cmd == "r":
                    warn("本层不可撤退"); continue
                try:
                    idx = int(cmd) - 1
                    skill = moves[idx]
                    evts = tower.battle_turn(BattleAction(action_type=ActionType.USE_SKILL, skill_name=skill))
                except (ValueError, IndexError):
                    self._warn_invalid_input(); continue

                for ev in evts:
                    if ev.message: info(ev.message)
                    if ev.event_type == TowerEventType.BATTLE_TURN:
                        render_battle_log(ev.data.get("log", []))
                    # 12.1 精确写盘：深渊每层通过 / 疫病死亡结算 / 全灭后立即持久化
                    if ev.event_type in (
                        TowerEventType.BATTLE_END,
                        TowerEventType.PLAGUE_DEATH,
                        TowerEventType.WIPE_OUT,
                        TowerEventType.RETREAT,
                        TowerEventType.ABYSS_RECORD,
                    ):
                        write_save(self.save)
                    self.observer.push(ev.event_type.name.lower(), ev.data, ev.message)

            if tower.has_pending_choice():
                creature, choices = tower._pending_skill_choice
                self._skill_choice_prompt(tower, choices, creature)

            if not self.save.active_party:
                warn("队伍全灭，退出深渊")
                break

        write_save(self.save)
        self._push_party()
        info(f"深渊最深记录：{self.save.deepest_abyss_floor} 层")

    # ------------------------------------------------------------------ #
    # 技能选择
    # ------------------------------------------------------------------ #

    def _skill_choice_prompt(self, session: Any, choices: list, creature: Creature) -> None:
        print()
        info(f"{BOLD(creature.display_name)} 的技能候选（Lv{creature.level}升级）：")
        for i, s in enumerate(choices):
            info(f"  [{i+1}] {s['name']} ({s['type']} | {s.get('power',0)}威力) - {s['description']}")
        info(f"  [0] 跳过")
        if len(creature.moves) >= 4:
            info(f"  当前技能：{creature.moves}")
            info(f"  （技能已满，需指定替换序号：1-4）")

        cmd = self._read_line(
            "  选择技能序号：",
            state="SKILL_CHOICE",
            actions=[(str(i+1), s["name"]) for i, s in enumerate(choices)] + [("0", "跳过")],
        ).strip()
        try:
            ci = int(cmd) - 1
        except ValueError:
            self._warn_invalid_input()
            return

        replace_idx = None
        if ci >= 0 and len(creature.moves) >= 4:
            rep = self._read_line(
                "  替换第几个技能（1-4）？",
                state="SKILL_REPLACE",
                actions=[(str(i+1), name) for i, name in enumerate(creature.moves)],
                prompt_label="INPUT_REPLACE_SLOT",
            ).strip()
            try:
                replace_idx = int(rep) - 1
            except ValueError:
                self._warn_invalid_input()
                return
            if replace_idx not in range(len(creature.moves)):
                self._warn_invalid_input()
                return

        if hasattr(session, "apply_skill_choice"):
            evts = session.apply_skill_choice(ci, replace_index=replace_idx)
            for ev in evts:
                if ev.message:
                    info(ev.message)

    # ------------------------------------------------------------------ #
    # 词条工坊
    # ------------------------------------------------------------------ #

    def _workshop_menu(self) -> None:
        while True:
            section("词条工坊")
            info(render_material_costs(self.save, self.data))
            render_party(self.save.party, self.data)
            workshop_options = [
                ("1", "重投词条（甲核×3）"),
                ("2", "升阶词条（灵晶）"),
                ("3", "封印词条（潮石×1）"),
                ("4", "解除封印（潮石×2）"),
                ("5", "净化深渊污染（净疫盐×1）"),
                ("0", "返回"),
            ]
            choice = self._read_menu_choice(
                "WORKSHOP_MENU",
                "工坊操作",
                workshop_options,
                action_summary=[
                    ("1", "重投"),
                    ("2", "升阶"),
                    ("3", "封印"),
                    ("4", "解封"),
                    ("5", "净化"),
                    ("0", "返回"),
                ],
            ).strip()
            if choice == "0": break
            if choice == "5":
                alive = self.save.active_party
                if not alive:
                    warn("队伍为空"); continue
                candidates = [c for c in alive if c.has_plague or c.abyss_taint > 0]
                if not candidates:
                    info("当前没有需要净化的虾米"); continue
                if self.save.get_item_count("cure_plague") <= 0:
                    warn("没有净疫盐，无法净化"); continue
                cleanse_options = [(str(i+1), f"{c.display_name} (疫病={c.has_plague}, 污染={c.abyss_taint})") for i, c in enumerate(candidates)] + [("0", "取消")]
                cc = self._read_menu_choice("WORKSHOP_CLEANSE_SELECT", "选择净化的虾米", cleanse_options).strip()
                if cc == "0": continue
                try:
                    creature = candidates[int(cc)-1]
                except (ValueError, IndexError):
                    self._warn_invalid_input(); continue
                if not self.save.consume_item("cure_plague", 1):
                    warn("净化失败"); continue
                creature.cure_plague()
                success(f"已净化 {creature.display_name} 的深渊污染与疫病")
                write_save(self.save)
                continue

            # 选虾米
            alive = self.save.active_party
            if not alive:
                warn("队伍为空"); continue
            creature_options = [(str(i+1), c.display_name) for i, c in enumerate(alive)] + [("0", "取消")]
            cc = self._read_menu_choice("WORKSHOP_TARGET_SELECT", "选择虾米", creature_options).strip()
            if cc == "0": continue
            try:
                creature = alive[int(cc)-1]
            except (ValueError, IndexError):
                self._warn_invalid_input(); continue

            print(render_creature_affixes(creature, self.data))
            slot_s = self._read_line(
                "  选择词条槽序号（1起）：",
                state="WORKSHOP_SLOT_SELECT",
                actions=[(str(i+1), f"槽{i+1}") for i in range(len(creature.affix_slots))],
                prompt_label="INPUT_SLOT",
            ).strip()
            try:
                slot_idx = int(slot_s) - 1
            except ValueError:
                self._warn_invalid_input(); continue

            if choice == "1":
                result = reroll(creature, slot_idx, self.save, self.data)
            elif choice == "2":
                result = upgrade(creature, slot_idx, self.save, self.data)
            elif choice == "3":
                result = seal(creature, slot_idx, self.save, self.data)
            elif choice == "4":
                result = unseal(creature, slot_idx, self.save, self.data)
            else:
                continue

            (success if result.success else error)(result.message)
            write_save(self.save)

    # ------------------------------------------------------------------ #
    # 图鉴
    # ------------------------------------------------------------------ #

    def _dex_view(self) -> None:
        section("虾图录")
        info(f"已见：{len(self.save.dex_seen)} 种  已捕：{len(self.save.dex_caught)} 种  "
             f"灵光：{len(self.save.shiny_caught)} 种")
        hr()
        for species_id, sp in self.data.species.items():
            if species_id in self.save.dex_caught:
                shiny = YELLOW("✦") if species_id in self.save.shiny_caught else " "
                info(f"  {shiny} {sp['name']} ({sp['type']}) - {sp['lore'][:40]}…")
            elif species_id in self.save.dex_seen:
                info(f"  ? {sp['name']} （已目击）")
        self._wait_for_enter(state="DEX_VIEW", action="返回")

    # ------------------------------------------------------------------ #
    # 队伍详情
    # ------------------------------------------------------------------ #

    def _party_detail(self) -> None:
        while True:
            render_party(self.save.party, self.data)
            alive = [c for c in self.save.party if c]
            if not alive:
                self._wait_for_enter(
                    state="PARTY_DETAIL",
                    action="返回",
                    prompt="  （空队伍）按 Enter 返回…",
                )
                return
            party_options = [(str(i+1), c.display_name if c else "空槽") for i, c in enumerate(self.save.party)] + [("0", "返回")]
            cc = self._read_menu_choice("PARTY_DETAIL", "查看成员", party_options).strip()
            if cc == "0": break
            try:
                c = self.save.party[int(cc)-1]
                if c: render_creature_detail(c, self.data)
            except (ValueError, IndexError):
                self._warn_invalid_input()
            self._wait_for_enter(state="PARTY_DETAIL", action="继续")

    # ------------------------------------------------------------------ #
    # 辅助
    # ------------------------------------------------------------------ #

    def _push_party(self) -> None:
        if self.save:
            self.observer.update_party([
                c.to_dict() if c else None for c in self.save.party
            ])

    def _on_exit(self) -> None:
        elapsed = int(time.time() - self._start_time)
        report_path = None
        if self.save:
            self.save.playtime_seconds += elapsed
            write_save(self.save)
            try:
                report_path = generate_session_report(
                    self.save,
                    observer_snapshot=self.observer.get_snapshot(),
                    events=list(getattr(self.observer, '_event_history', [])),
                    session_seconds=elapsed,
                    title='lobster-cli-tamer Session 结算页',
                    data=self.data,
                )
            except Exception as e:
                warn(f"生成结算页失败：{e}")
        self.observer.stop()
        if report_path:
            info(f"静态结算页：{report_path}")
        print("\n  感谢游玩！再见 🦞\n")


# --------------------------------------------------------------------------- #
# CLI 入口
# --------------------------------------------------------------------------- #

HELP_EPILOG = """
游戏背景：
  你是一名甲录师，在潮礁海域捕捉、培养与编队虾米，
  通过大世界抓宠、深渊冒险、工坊洗词条来不断提升队伍。

核心 loop：
  1. 野外探索与捕捉虾米
  2. 进入深渊承担污染 / 疫病 / 永久死亡风险
  3. 获取甲网、净疫盐与更高阶养成材料
  4. 回工坊重投 / 升阶 / 封印词条
  5. 再挑战更深层深渊

对 coding agent 的建议：
  - 推荐使用 PTY 运行，而不是一次性管道灌入输入
  - 推荐命令：
      ./lobster-cli-tamer --terminal-native --no-color --save-slot 0
  - 若要新建固定名字的新档：
      ./lobster-cli-tamer --terminal-native --no-color --save-slot 0 --player-name Agent
  - terminal-native 模式会为关键输入点输出稳定的 STATE/ACTIONS/PROMPT 锚点
  - 回车继续 / 返回 与新档命名也会给出 enter=/text=... 的明确提示
""".strip()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lobster-cli-tamer",
        description="横着抓：只给龙虾玩的 CLI 捕兽养成。支持人类玩家，也在持续优化 terminal-native / coding-agent 可玩性。",
        epilog=HELP_EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--terminal-native",
        action="store_true",
        help="启用更适合通用 coding agent / PTY 终端交互的模式（当前会默认关闭 banner 与 observer）。",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="关闭 ANSI 颜色，减少终端解析噪音。",
    )
    parser.add_argument(
        "--no-banner",
        action="store_true",
        help="关闭启动横幅。terminal-native 模式下默认启用。",
    )
    parser.add_argument(
        "--no-observer",
        action="store_true",
        help="关闭本地实时观战看板。terminal-native 模式下默认启用。",
    )
    parser.add_argument(
        "--save-slot",
        type=int,
        choices=[0, 1, 2],
        help="直接进入指定存档槽（0/1/2）。若槽位为空则自动新建。",
    )
    parser.add_argument(
        "--player-name",
        help="与 --save-slot 配合时，用于自动新建存档的默认名字。",
    )
    return parser


def parse_options(argv: Optional[list[str]] = None) -> GameOptions:
    args = build_parser().parse_args(argv)
    terminal_native = bool(args.terminal_native)
    return GameOptions(
        terminal_native=terminal_native,
        no_color=bool(args.no_color or terminal_native),
        no_banner=bool(args.no_banner or terminal_native),
        no_observer=bool(args.no_observer or terminal_native),
        save_slot=args.save_slot,
        player_name=args.player_name,
    )


def main(argv: Optional[list[str]] = None) -> None:
    options = parse_options(argv)
    game = Game(options)
    try:
        game.run()
    except (KeyboardInterrupt, EOFError):
        print("\n  输入中断，正在保存并退出…")
        game._on_exit()
        sys.exit(0)


if __name__ == "__main__":
    main()
