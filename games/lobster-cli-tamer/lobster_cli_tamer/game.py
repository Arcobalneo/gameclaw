"""game.py - 游戏主状态机 + CLI 主入口。

Game 类驱动：主菜单 → 野外探索 / 深渊 / 词条工坊 / 图鉴 / 存档管理
"""
from __future__ import annotations

import sys
import time
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
    render_save_summaries, render_menu, prompt_input,
    print_observer_banner, render_shiny_effect, render_capture_ball_animation,
    GREEN, CYAN, BOLD, YELLOW, RED,
)
from lobster_cli_tamer.combat import BattleAction, ActionType


# --------------------------------------------------------------------------- #
# 游戏类
# --------------------------------------------------------------------------- #

class Game:
    def __init__(self) -> None:
        self.data: Optional[GameData] = None
        self.save: Optional[SaveSlot] = None
        self.observer = ObserverServer()
        self._start_time = time.time()

    # ------------------------------------------------------------------ #
    # 启动
    # ------------------------------------------------------------------ #

    def run(self) -> None:
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
        print()
        print(CYAN("  ╔═══════════════════════════════════════╗"))
        print(CYAN("  ║") + BOLD("   🦞  横着抓：只给龙虾玩的 CLI 捕兽养成   ") + CYAN("║"))
        print(CYAN("  ╚═══════════════════════════════════════╝"))
        print()

    def _start_observer(self) -> None:
        ok = self.observer.start(8000)
        if ok:
            print_observer_banner(self.observer.url)
        else:
            warn("无法启动实时看板（端口占用），继续游戏")

    # ------------------------------------------------------------------ #
    # 存档选择
    # ------------------------------------------------------------------ #

    def _select_save(self) -> None:
        # ── last_slot 快速续档 ──────────────────────────────────
        last = read_last_slot()
        if last is not None:
            summaries = list_save_summaries()
            s = summaries[last]
            pt = s.get("playtime_seconds", 0)
            h, m = divmod(pt // 60, 60)
            info(f"上次存档：槽{last} · {s.get('player_name','?')} · "
                 f"队伍{s.get('party_count',0)}只 · 深渊第{s.get('deepest_abyss_floor',0)}层 · {h}h{m:02d}m")
            print(f"  继续上次存档？(Enter=yes / n=选其他槽) ", end="", flush=True)
            ans = input().strip().lower()
            if ans != "n":
                self.save = load_save(last, self.data)
                write_last_slot(last)
                check_zone_unlock(self.save, self.data)
                self._push_party()
                return

        # ── 常规槽位选择 ───────────────────────────────────────
        summaries = list_save_summaries()
        render_save_summaries(summaries)
        render_menu("选择存档槽", [
            (str(i), f"槽{i}：{'新建' if not summaries[i].get('exists') else summaries[i].get('player_name','?')}")
            for i in range(3)
        ] + [("q", "退出")])
        choice = input().strip().lower()
        if choice == "q":
            return
        try:
            slot = int(choice)
            if slot not in (0, 1, 2):
                raise ValueError
        except ValueError:
            warn("无效选择"); return

        if save_exists(slot):
            self.save = load_save(slot, self.data)
        else:
            name = input('  新存档 — 输入你的名字（回车默认"甲录师"）：').strip() or '甲录师'
            self.save = new_save(slot, player_name=name)
            self._grant_starter_if_needed()

        write_last_slot(self.save.slot)
        check_zone_unlock(self.save, self.data)
        self._grant_starter_if_needed()
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

    def _main_menu(self) -> None:
        while True:
            section("主菜单")
            render_party(self.save.party, self.data)
            render_menu("选择行动", [
                ("1", "野外探索"),
                ("2", f"进入深渊（最深 {self.save.deepest_abyss_floor} 层）"),
                ("3", "词条工坊"),
                ("4", "查看图鉴"),
                ("5", "查看队伍详情"),
                ("6", "存档"),
                ("q", "退出"),
            ])
            choice = input().strip().lower()
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
                warn("无效输入")

    # ------------------------------------------------------------------ #
    # 野外探索
    # ------------------------------------------------------------------ #

    def _zone_select(self) -> None:
        zones = [z for zid, z in self.data.zones.items() if zid in self.save.unlocked_zones]
        if not zones:
            warn("没有可进入的区域"); return
        opts = [(str(i+1), f"{z['name']} - {z.get('description','')}") for i, z in enumerate(zones)]
        opts.append(("0", "返回"))
        render_menu("选择探索区域", opts)
        choice = input().strip()
        if choice == "0": return
        try:
            z = zones[int(choice)-1]
        except (ValueError, IndexError):
            warn("无效输入"); return

        # 子区域选择
        subs = z["sub_areas"]
        if len(subs) > 1:
            sub_opts = [(str(i+1), s["name"]) for i, s in enumerate(subs)]
            sub_opts.append(("0", "返回"))
            render_menu(f"[{z['name']}] 选择子区域", sub_opts)
            sc = input().strip()
            if sc == "0": return
            try:
                sub = subs[int(sc)-1]
            except (ValueError, IndexError):
                warn("无效输入"); return
        else:
            sub = subs[0]

        self._explore_loop(z["id"], sub["id"])

    def _explore_loop(self, zone_id: str, sub_area_id: str) -> None:
        ws = WorldSession(zone_id, sub_area_id, self.save, self.data)
        zone = self.data.zones[zone_id]
        sub = next(s for s in zone["sub_areas"] if s["id"] == sub_area_id)
        section(f"探索：{zone['name']} / {sub['name']}")
        info("（输入 q 离开，c 使用捕捉球）")

        while True:
            cmd = input("  > ").strip().lower()
            if cmd == "q":
                ws.end_explore()
                break

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
            render_menu("战斗行动", move_opts)
            cmd = input().strip().lower()

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
                    render_menu("选择捕捉球", sub_opts)
                    sc = input().strip()
                    if sc == "0": continue
                    try:
                        item_id = capture_items[int(sc)-1]["id"]
                    except (ValueError, IndexError):
                        warn("无效输入"); continue
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
                    warn("无效输入"); continue

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
        warn("⚠ 深渊模式：HP归零=永久死亡！精英层感染疫病，退出时掷死亡骰")
        confirm = input("  确认进入？(y/n) ").strip().lower()
        if confirm != "y": return

        tower = TowerSession(self.save, self.data)

        while self.save.active_party:
            info(f"\n  当前队伍存活：{', '.join(c.display_name for c in self.save.active_party)}")
            action = input(f"  [深渊第{tower.floor+1}层] 前进(↵) / 撤退(q)? ").strip().lower()
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
                render_menu("战斗", opts)
                cmd = input().strip()
                try:
                    idx = int(cmd) - 1
                    skill = moves[idx]
                    evts = tower.battle_turn(BattleAction(action_type=ActionType.USE_SKILL, skill_name=skill))
                except (ValueError, IndexError):
                    warn("无效输入"); continue

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

        cmd = input("  选择技能序号：").strip()
        replace_idx = None
        if len(creature.moves) >= 4:
            rep = input("  替换第几个技能（1-4）？").strip()
            try:
                replace_idx = int(rep) - 1
            except ValueError:
                pass
        try:
            ci = int(cmd) - 1
            if hasattr(session, "apply_skill_choice"):
                evts = session.apply_skill_choice(ci, replace_index=replace_idx)
                for ev in evts:
                    if ev.message: info(ev.message)
        except ValueError:
            pass

    # ------------------------------------------------------------------ #
    # 词条工坊
    # ------------------------------------------------------------------ #

    def _workshop_menu(self) -> None:
        while True:
            section("词条工坊")
            info(render_material_costs(self.save, self.data))
            render_party(self.save.party, self.data)
            render_menu("工坊操作", [
                ("1", "重投词条（甲核×3）"),
                ("2", "升阶词条（灵晶）"),
                ("3", "封印词条（潮石×1）"),
                ("4", "解除封印（潮石×2）"),
                ("0", "返回"),
            ])
            choice = input().strip()
            if choice == "0": break

            # 选虾米
            alive = self.save.active_party
            if not alive:
                warn("队伍为空"); continue
            render_menu("选择虾米", [(str(i+1), c.display_name) for i, c in enumerate(alive)] + [("0", "取消")])
            cc = input().strip()
            if cc == "0": continue
            try:
                creature = alive[int(cc)-1]
            except (ValueError, IndexError):
                warn("无效输入"); continue

            print(render_creature_affixes(creature, self.data))
            slot_s = input("  选择词条槽序号（1起）：").strip()
            try:
                slot_idx = int(slot_s) - 1
            except ValueError:
                warn("无效输入"); continue

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
        input("  按 Enter 返回…")

    # ------------------------------------------------------------------ #
    # 队伍详情
    # ------------------------------------------------------------------ #

    def _party_detail(self) -> None:
        while True:
            render_party(self.save.party, self.data)
            alive = [c for c in self.save.party if c]
            if not alive:
                input("  （空队伍）按 Enter 返回…"); return
            render_menu("查看成员", [(str(i+1), c.display_name if c else "空槽") for i, c in enumerate(self.save.party)] + [("0", "返回")])
            cc = input().strip()
            if cc == "0": break
            try:
                c = self.save.party[int(cc)-1]
                if c: render_creature_detail(c, self.data)
            except (ValueError, IndexError):
                warn("无效输入")
            input("  按 Enter 继续…")

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

def main() -> None:
    game = Game()
    try:
        game.run()
    except KeyboardInterrupt:
        print("\n  （Ctrl+C 中断）")
        if game.save:
            write_save(game.save)
        game.observer.stop()
        sys.exit(0)


if __name__ == "__main__":
    main()
