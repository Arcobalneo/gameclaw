"""tower.py – 无尽深渊爬塔模块。

深渊结构（小循环，每 5 层一循环）：
  普通 → 普通 → 普通 → 精英（疫病）→ [每10层 BOSS]

永久死亡规则：
  - 战斗内 HP=0 → 立即标记 dead=True
  - 精英层存活但带疫病 → 退出/撤退时掷骰：min(floors×5%, 50%)
  - 全灭 → 结算疫病死亡 → 更新深渊记录
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from lobster_cli_tamer.loader import GameData
    from lobster_cli_tamer.save import SaveSlot

from lobster_cli_tamer.combat import (
    BattleState, BattleEngine, BattleAction, BattleResult,
    Combatant, make_enemy_combatant, ActionType,
)
from lobster_cli_tamer.creature import Creature
from lobster_cli_tamer.skills import pick_level_up_choices
from lobster_cli_tamer.world import WorldEventType, WorldEvent


# --------------------------------------------------------------------------- #
# 层级类型
# --------------------------------------------------------------------------- #

class FloorType(Enum):
    NORMAL = "普通"
    ELITE = "精英"   # 每小循环第 4 层
    BOSS = "BOSS"    # 每 10 层


def classify_floor(floor: int) -> FloorType:
    if floor % 10 == 0:
        return FloorType.BOSS
    if floor % 5 == 4:
        return FloorType.ELITE
    return FloorType.NORMAL


# --------------------------------------------------------------------------- #
# 深渊战斗事件
# --------------------------------------------------------------------------- #

class TowerEventType(Enum):
    FLOOR_START = auto()
    BATTLE_TURN = auto()
    BATTLE_END = auto()
    PLAGUE_RISK = auto()
    PLAGUE_DEATH = auto()
    LEVEL_UP = auto()
    SKILL_CHOICE = auto()
    ITEM_DROP = auto()
    ABYSS_RECORD = auto()
    RETREAT = auto()
    WIPE_OUT = auto()


@dataclass
class TowerEvent:
    event_type: TowerEventType
    data: dict[str, Any] = field(default_factory=dict)
    message: str = ""


# --------------------------------------------------------------------------- #
# 深渊 Session
# --------------------------------------------------------------------------- #

class TowerSession:
    def __init__(self, save: "SaveSlot", data: "GameData") -> None:
        self.save = save
        self.data = data
        self.floor = 0
        self._battle_engine: Optional[BattleEngine] = None
        self._floor_type: FloorType = FloorType.NORMAL
        self._pending_skill_choice: Optional[tuple[Creature, list]] = None
        self._active_log: list[str] = []

    # ------------------------------------------------------------------ #
    # 进入下一层
    # ------------------------------------------------------------------ #

    def enter_next_floor(self) -> list[TowerEvent]:
        self.floor += 1
        self._floor_type = classify_floor(self.floor)
        events: list[TowerEvent] = []

        events.append(TowerEvent(
            TowerEventType.FLOOR_START,
            {"floor": self.floor, "type": self._floor_type.value},
            f"━━━ 深渊第 {self.floor} 层 [{self._floor_type.value}] ━━━",
        ))

        # 生成敌方
        enemy_cb = self._spawn_enemy()
        if enemy_cb is None:
            events.append(TowerEvent(TowerEventType.BATTLE_END, message="[无法生成敌方]"))
            return events

        # 玩家先手：取一次快照，保证 player_party 与 player_lead 指向同一列表
        active_snapshot = self.save.active_party
        player_lead = active_snapshot[0] if active_snapshot else None
        if player_lead is None:
            events.append(TowerEvent(TowerEventType.WIPE_OUT, message="队伍全灭，无法进入深渊"))
            return events

        state = BattleState(
            player=Combatant(creature=player_lead),
            enemy=enemy_cb,
            player_party=active_snapshot,
            is_tower=True,
        )
        self._battle_engine = BattleEngine(state, self.data)
        self._active_log = []
        return events

    # ------------------------------------------------------------------ #
    # 战斗回合
    # ------------------------------------------------------------------ #

    def battle_turn(self, action: BattleAction) -> list[TowerEvent]:
        events: list[TowerEvent] = []
        if self._battle_engine is None:
            return events

        state = self._battle_engine.run_turn(action)
        new_lines = state.log[len(self._active_log):]
        self._active_log = list(state.log)

        events.append(TowerEvent(TowerEventType.BATTLE_TURN, {
            "log": new_lines,
            "status_bar": self._battle_engine.render_status_bar(),
            "floor": self.floor,
        }))

        if state.is_over():
            events.extend(self._on_floor_end(state))

        return events

    # ------------------------------------------------------------------ #
    # 层结束处理
    # ------------------------------------------------------------------ #

    def _on_floor_end(self, state: BattleState) -> list[TowerEvent]:
        events: list[TowerEvent] = []
        self._battle_engine = None

        # 移除战斗内死亡虾米
        for c in list(self.save.party):
            if c and c.dead:
                self.save.add_to_memorial(c, f"深渊第{self.floor}层战斗")
                idx = self.save.party.index(c)
                self.save.party[idx] = None
                events.append(TowerEvent(
                    TowerEventType.BATTLE_END,
                    {"dead": c.display_name},
                    f"✝ {c.display_name} 在深渊永远倒下了……",
                ))

        if state.result == BattleResult.PLAYER_WIN:
            events.append(TowerEvent(TowerEventType.BATTLE_END, {
                "result": "win", "floor": self.floor,
            }, f"通过了第 {self.floor} 层！"))

            # 所有层：污染 / 疫病压力累积
            events.extend(self._apply_abyss_taint())

            # EXP + 升级
            for c in self.save.active_party:
                exp = self._floor_exp()
                leveled = c.gain_exp(exp, self.data.balance)
                if leveled:
                    events.extend(self._on_level_up(c))

            # 材料掉落
            drop = self._roll_drop()
            if drop:
                self.save.add_item(drop["id"], drop["count"])
                suffix = "（保底）" if drop.get("guaranteed") else ""
                events.append(TowerEvent(TowerEventType.ITEM_DROP, drop,
                    f"获得了 {drop['name']} ×{drop['count']}{suffix}"))

            # 更新深渊记录
            if self.floor > self.save.deepest_abyss_floor:
                self.save.deepest_abyss_floor = self.floor
                events.append(TowerEvent(TowerEventType.ABYSS_RECORD, {
                    "floor": self.floor,
                }, f"✦ 新纪录！最深到达第 {self.floor} 层！"))

        elif state.result in (BattleResult.PLAYER_LOSE, BattleResult.SURRENDERED):
            is_retreat = state.result == BattleResult.SURRENDERED
            events.append(TowerEvent(
                TowerEventType.RETREAT if is_retreat else TowerEventType.WIPE_OUT,
                {"floor": self.floor},
                "主动撤退，离开深渊" if is_retreat else "队伍全灭！",
            ))
            events.extend(self._settle_plague())
            self.floor = 0
            self.save.total_abyss_runs += 1

        return events

    # ------------------------------------------------------------------ #
    # 疫病 / 污染
    # ------------------------------------------------------------------ #

    def _apply_abyss_taint(self) -> list[TowerEvent]:
        events: list[TowerEvent] = []
        cfg = self.data.balance.get("tower", {})
        taint_cfg = cfg.get("taint_gain", {})
        floor_key = {
            FloorType.NORMAL: "normal",
            FloorType.ELITE: "elite",
            FloorType.BOSS: "boss",
        }.get(self._floor_type, "normal")
        taint_gain = int(taint_cfg.get(floor_key, 1))
        threshold = int(cfg.get("taint_to_plague_threshold", 3))

        for c in self.save.active_party:
            if c.has_plague:
                c.increment_plague(taint_gain)
                events.append(TowerEvent(
                    TowerEventType.PLAGUE_RISK,
                    {"creature": c.display_name, "plague_floors": c.plague_floors},
                    f"🦠 {c.display_name} 在深渊中继续恶化（疫病 +{taint_gain}，当前 {c.plague_floors}）",
                ))
                continue

            c.add_abyss_taint(taint_gain)
            events.append(TowerEvent(
                TowerEventType.PLAGUE_RISK,
                {"creature": c.display_name, "taint": c.abyss_taint},
                f"☣ {c.display_name} 深渊污染 +{taint_gain}（当前 {c.abyss_taint}）",
            ))
            converted = c.convert_taint_to_plague_if_needed(threshold)
            if converted:
                events.append(TowerEvent(
                    TowerEventType.PLAGUE_RISK,
                    {"creature": c.display_name, "converted": converted},
                    f"🦠 {c.display_name} 的深渊污染转化为疫病（+{converted} 层）",
                ))

        return events

    def _settle_plague(self) -> list[TowerEvent]:
        """退出深渊时结算疫病死亡，并保留未净化的污染。"""
        events: list[TowerEvent] = []
        for c in list(self.save.active_party):
            if not c.has_plague:
                if c.abyss_taint > 0:
                    events.append(TowerEvent(TowerEventType.PLAGUE_RISK, {
                        "creature": c.display_name, "taint": c.abyss_taint,
                    }, f"☣ {c.display_name} 带着深渊污染离开（污染 {c.abyss_taint}，未清除）"))
                continue
            chance = c.plague_death_chance(self.data.balance)
            events.append(TowerEvent(TowerEventType.PLAGUE_RISK, {
                "creature": c.display_name, "chance": chance,
            }, f"🦠 {c.display_name} 疫病死亡率 {chance*100:.0f}%，掷骰……"))
            if random.random() < chance:
                c.dead = True
                self.save.add_to_memorial(c, f"深渊疫病（{c.plague_floors}层）")
                idx = next((i for i, x in enumerate(self.save.party) if x is c), None)
                if idx is not None:
                    self.save.party[idx] = None
                events.append(TowerEvent(TowerEventType.PLAGUE_DEATH, {
                    "creature": c.display_name,
                }, f"✝ {c.display_name} 因疫病永远离去……"))
            else:
                events.append(TowerEvent(TowerEventType.PLAGUE_RISK, {
                    "creature": c.display_name,
                }, f"{c.display_name} 侥幸逃过了疫病（仍携带，需治疗）"))
        return events

    # ------------------------------------------------------------------ #
    # 升级
    # ------------------------------------------------------------------ #

    def _on_level_up(self, creature: Creature) -> list[TowerEvent]:
        events: list[TowerEvent] = []
        events.append(TowerEvent(TowerEventType.LEVEL_UP, {
            "creature": creature.display_name, "level": creature.level,
        }, f"✓ {creature.display_name} 升到了 Lv{creature.level}！"))
        if creature.level % 2 == 0:
            choices = pick_level_up_choices(creature, self.data, count=3)
            if choices:
                self._pending_skill_choice = (creature, choices)
                events.append(TowerEvent(TowerEventType.SKILL_CHOICE, {
                    "creature": creature.display_name,
                    "choices": [{"name": s["name"], "type": s["type"], "power": s.get("power", 0),
                                 "description": s["description"]} for s in choices],
                }, "深渊感悟！选择新技能（0=跳过）："))
        return events

    def apply_skill_choice(self, choice_index: int, replace_index: Optional[int] = None) -> list[TowerEvent]:
        events: list[TowerEvent] = []
        if not self._pending_skill_choice:
            return events
        creature, choices = self._pending_skill_choice
        self._pending_skill_choice = None
        if choice_index < 0 or choice_index >= len(choices):
            return events
        skill = choices[choice_index]
        creature.learn_skill(skill["name"], replace_index=replace_index)
        events.append(TowerEvent(TowerEventType.LEVEL_UP, {
            "creature": creature.display_name, "skill": skill["name"],
        }, f"{creature.display_name} 领悟了 【{skill['name']}】！"))
        return events

    # ------------------------------------------------------------------ #
    # 辅助
    # ------------------------------------------------------------------ #

    def _spawn_enemy(self) -> Optional[Combatant]:
        tc = self.data.tower_config
        floor = self.floor

        # BOSS 层
        if self._floor_type == FloorType.BOSS:
            bosses = tc.get("bosses", [])
            boss_idx = (floor // 10 - 1) % len(bosses) if bosses else 0
            if bosses:
                boss = bosses[boss_idx % len(bosses)]
                sid = boss["species_id"]
                lv = boss.get("level", 30) + (floor // 10 - 1) * 5
                affix_ids = boss.get("affix_ids", [])
                cb = make_enemy_combatant(sid, lv, self.data, affix_ids=affix_ids or None)
                cb.creature.moves = [self.data.species[sid]["base_skill"]]
                return cb

        # 普通/精英：从 band 池中取
        bands = tc.get("enemy_pool_by_band", [])
        if not bands:
            return None
        band = None
        for b in bands:
            lo = b.get("floor_from", b.get("min_floor", 1))
            hi = b.get("floor_to", b.get("max_floor", 9999))
            if lo <= floor <= hi:
                band = b
                break
        if band is None:
            band = bands[-1]

        pool = band.get("species_ids", [])
        if not pool:
            return None
        sid = random.choice(pool)
        lv_range = band.get("level_range", [floor, floor + 3])
        lv = random.randint(lv_range[0], min(lv_range[1], lv_range[0] + 5))
        cb = make_enemy_combatant(sid, lv, self.data)
        cb.creature.moves = [self.data.species[sid]["base_skill"]]
        if self._floor_type == FloorType.ELITE:
            # 精英加一个随机词条
            from lobster_cli_tamer.affixes import roll_affix
            aff = roll_affix(self.data)
            if cb.creature.affix_slots:
                cb.creature.affix_slots[0].affix_id = aff["id"]
        return cb

    def _floor_exp(self) -> int:
        base = self.data.balance.get("tower", {}).get("exp_per_floor", 50)
        return max(10, base + self.floor * 3)

    def _roll_drop(self) -> Optional[dict[str, Any]]:
        tc = self.data.tower_config
        # 优先按层类型查分层掉落配置（normal/elite/boss）
        type_map = {FloorType.NORMAL: "normal", FloorType.ELITE: "elite", FloorType.BOSS: "boss"}
        type_key = type_map.get(self._floor_type, "normal")
        drops_by_type: dict[str, Any] = tc.get("drops", {})
        type_drops = drops_by_type.get(type_key, {})
        chosen = None

        if type_drops:
            # 结构：{中文item名: [min_count, max_count]}
            items_by_name = {v["name"]: k for k, v in self.data.items.items()}
            candidates = []
            for item_name, count_range in type_drops.items():
                item_id = items_by_name.get(item_name)
                if item_id:
                    count = random.randint(int(count_range[0]), int(count_range[1]))
                    if count > 0:
                        candidates.append({"id": item_id, "name": item_name, "count": count})
            if candidates:
                chosen = random.choice(candidates)

        if chosen is None:
            # fallback：floor_drops（固定概率列表）
            floor_drops = tc.get("floor_drops", [])
            for d in floor_drops:
                if random.random() < d.get("chance", 0):
                    chosen = {"id": d["item_id"], "name": d.get("name", d["item_id"]), "count": d.get("count", 1)}
                    break

        if self.save.consume_capture_tool_pity(chosen["id"] if chosen else None):
            item = self.data.items["net_basic"]
            return {"id": "net_basic", "name": item["name"], "count": 1, "guaranteed": True}

        return chosen

    def is_in_battle(self) -> bool:
        return self._battle_engine is not None

    def has_pending_choice(self) -> bool:
        return self._pending_skill_choice is not None

    def can_advance(self) -> bool:
        return not self.is_in_battle() and not self.has_pending_choice() and bool(self.save.active_party)
