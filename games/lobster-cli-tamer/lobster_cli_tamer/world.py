"""world.py – 野外探索状态机。

WorldSession 代表一次野外探索（进入某子区域后的单次冒险）。
管理：步行 → 遭遇 → 战斗/逃跑/捕捉 → 获得战利品 → 返回主菜单。
不负责 IO 渲染，只驱动状态转换并返回事件供上层渲染。
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import TYPE_CHECKING, Any, Generator, Optional

if TYPE_CHECKING:
    from lobster_cli_tamer.loader import GameData
    from lobster_cli_tamer.save import SaveSlot

from lobster_cli_tamer.capture import encounter, capture_attempt, apply_capture, mark_seen, encounter_shiny_log
from lobster_cli_tamer.combat import (
    BattleState, BattleEngine, BattleAction, BattleResult,
    Combatant, make_enemy_combatant, ActionType,
)
from lobster_cli_tamer.creature import Creature
from lobster_cli_tamer.skills import pick_level_up_choices


# --------------------------------------------------------------------------- #
# 世界事件（供上层 render 消费）
# --------------------------------------------------------------------------- #

class WorldEventType(Enum):
    STEP = auto()              # 踏出一步
    NO_ENCOUNTER = auto()      # 无遭遇
    WILD_APPEARED = auto()     # 野生虾米出现
    SHINY_APPEARED = auto()    # 灵光！
    BATTLE_START = auto()
    BATTLE_TURN = auto()
    BATTLE_END = auto()
    CAPTURE_ATTEMPT = auto()
    CAPTURE_SUCCESS = auto()
    CAPTURE_FAIL = auto()
    RAN_AWAY = auto()          # 逃跑成功
    EXP_GAINED = auto()
    LEVEL_UP = auto()
    SKILL_CHOICE = auto()      # 等待玩家选技能
    SKILL_LEARNED = auto()
    ZONE_EVENT = auto()        # 区域触发事件（宝箱/NPC）
    ITEM_FOUND = auto()
    EXPLORE_END = auto()       # 玩家主动结束探索
    PARTY_WIPED = auto()


@dataclass
class WorldEvent:
    event_type: WorldEventType
    data: dict[str, Any] = field(default_factory=dict)
    message: str = ""


# --------------------------------------------------------------------------- #
# 探索 Session
# --------------------------------------------------------------------------- #

class WorldSession:
    def __init__(
        self,
        zone_id: str,
        sub_area_id: str,
        save: "SaveSlot",
        data: "GameData",
    ) -> None:
        self.zone_id = zone_id
        self.sub_area_id = sub_area_id
        self.save = save
        self.data = data

        zone = data.zones.get(zone_id)
        if not zone:
            raise ValueError(f"未知区域：{zone_id}")
        self.zone = zone
        self.sub_area = next(
            (sa for sa in zone["sub_areas"] if sa["id"] == sub_area_id),
            zone["sub_areas"][0],
        )
        self.steps = 0
        self.steps_per_encounter = self._roll_steps()
        self._battle_engine: Optional[BattleEngine] = None
        self._current_wild: Optional[Creature] = None
        self._pending_skill_choice: Optional[tuple[Creature, list]] = None

    # ------------------------------------------------------------------ #
    # 主循环入口（生成器）
    # ------------------------------------------------------------------ #

    def step(self) -> list[WorldEvent]:
        """踏出一步，返回本步产生的所有事件。"""
        events: list[WorldEvent] = []
        self.steps += 1
        events.append(WorldEvent(WorldEventType.STEP, {"steps": self.steps}))

        if self.steps < self.steps_per_encounter:
            events.append(WorldEvent(WorldEventType.NO_ENCOUNTER))
            return events

        # 重置步数计数器
        self.steps_per_encounter = self._roll_steps()
        self.steps = 0

        # 遭遇判定
        enc = encounter(self.sub_area, self.data)
        if enc is None:
            events.append(WorldEvent(WorldEventType.NO_ENCOUNTER))
            return events

        # 记录见过
        mark_seen(self.save, enc.species_id)
        if enc.is_shiny:
            encounter_shiny_log(self.save, enc.species_id)
            events.append(WorldEvent(
                WorldEventType.SHINY_APPEARED,
                {"species_id": enc.species_id, "level": enc.level},
                f"✦ 灵光！{enc.creature.display_name} 出现了！",
            ))
        else:
            events.append(WorldEvent(
                WorldEventType.WILD_APPEARED,
                {"species_id": enc.species_id, "level": enc.level},
                f"野生 {enc.creature.display_name}（Lv{enc.level}）出现了！",
            ))

        self._current_wild = enc.creature
        self._enc = enc

        # 自动进入战斗（调用方可在渲染后立即触发 battle_turn）
        player_lead = self.save.active_party[0] if self.save.active_party else None
        if player_lead is None:
            events.append(WorldEvent(WorldEventType.PARTY_WIPED, message="队伍全灭，无法战斗"))
            return events

        state = BattleState(
            player=Combatant(creature=player_lead),
            enemy=Combatant(creature=enc.creature),
            player_party=self.save.active_party,
            is_tower=False,
        )
        self._battle_engine = BattleEngine(state, self.data)
        events.append(WorldEvent(WorldEventType.BATTLE_START, {
            "player": player_lead.display_name,
            "enemy": enc.creature.display_name,
        }))
        return events

    # ------------------------------------------------------------------ #
    # 战斗回合
    # ------------------------------------------------------------------ #

    def battle_turn(self, action: BattleAction) -> list[WorldEvent]:
        events: list[WorldEvent] = []
        if self._battle_engine is None:
            return events

        # 捕捉行动特殊处理
        if action.action_type == ActionType.USE_SKILL and action.skill_name and action.skill_name.startswith("__capture__"):
            return self._handle_capture(action)

        state = self._battle_engine.run_turn(action)
        events.append(WorldEvent(WorldEventType.BATTLE_TURN, {
            "log": list(state.log[-20:]),
            "status_bar": self._battle_engine.render_status_bar(),
        }))

        if state.is_over():
            events.extend(self._on_battle_end(state))

        return events

    # ------------------------------------------------------------------ #
    # 捕捉
    # ------------------------------------------------------------------ #

    def _handle_capture(self, action: BattleAction) -> list[WorldEvent]:
        events: list[WorldEvent] = []
        item_id = action.skill_name.replace("__capture__", "") or "standard_trap"
        if not self.save.consume_item(item_id):
            events.append(WorldEvent(WorldEventType.CAPTURE_ATTEMPT, message=f"没有 {item_id} 了！"))
            return events

        wild = self._current_wild
        if wild is None:
            return events

        engine = self._battle_engine
        status = engine.state.enemy.status if engine else None
        weakened = wild.hp_pct < 0.3

        success, rate = capture_attempt(wild, item_id, self.data, weakened=weakened, status=status)
        events.append(WorldEvent(WorldEventType.CAPTURE_ATTEMPT, {
            "species": wild.display_name, "rate": round(rate, 3),
        }, f"投出捕捉球！捕捉率 {rate*100:.1f}%"))

        if success:
            captured = apply_capture(self._enc, self.save, self.data, captured_zone=self.zone_id)
            if wild.is_shiny:
                self.save.shiny_caught.add(wild.species_id)
            self.save.total_captures += 1
            events.append(WorldEvent(WorldEventType.CAPTURE_SUCCESS, {
                "species": wild.display_name, "is_shiny": wild.is_shiny,
            }, f"捕捉成功！{wild.display_name} 加入队伍！"))
            self._battle_engine = None
            self._current_wild = None
        else:
            events.append(WorldEvent(WorldEventType.CAPTURE_FAIL, message="捕捉失败！虾米挣脱了！"))
        return events

    # ------------------------------------------------------------------ #
    # 战斗结束处理
    # ------------------------------------------------------------------ #

    def _on_battle_end(self, state: BattleState) -> list[WorldEvent]:
        events: list[WorldEvent] = []

        if state.result == BattleResult.PLAYER_WIN:
            self.save.total_battles += 1
            events.append(WorldEvent(WorldEventType.BATTLE_END, {"result": "win"}))
            # 分 EXP
            for c in self.save.active_party:
                if not c.is_alive:
                    continue
                leveled = c.gain_exp(state.exp_gained, self.data.balance)
                events.append(WorldEvent(WorldEventType.EXP_GAINED, {
                    "creature": c.display_name, "exp": state.exp_gained,
                }))
                if leveled:
                    events.extend(self._on_level_up(c))

        elif state.result == BattleResult.PLAYER_LOSE:
            self.save.total_battles += 1
            # 移除战斗内死亡的虾米
            for c in self.save.active_party:
                if c.dead:
                    self.save.add_to_memorial(c, "野外战斗")
            events.append(WorldEvent(WorldEventType.PARTY_WIPED, message="队伍全灭！"))

        elif state.result == BattleResult.SURRENDERED:
            events.append(WorldEvent(WorldEventType.RAN_AWAY, message="成功逃跑！"))

        self._battle_engine = None
        self._current_wild = None
        return events

    # ------------------------------------------------------------------ #
    # 升级技能选择
    # ------------------------------------------------------------------ #

    def _on_level_up(self, creature: Creature) -> list[WorldEvent]:
        events: list[WorldEvent] = []
        events.append(WorldEvent(WorldEventType.LEVEL_UP, {
            "creature": creature.display_name, "level": creature.level,
        }, f"✓ {creature.display_name} 升到了 Lv{creature.level}！"))

        if creature.level % 2 == 0:  # 偶数级才触发技能选择
            choices = pick_level_up_choices(creature, self.data, count=3)
            if choices:
                self._pending_skill_choice = (creature, choices)
                events.append(WorldEvent(WorldEventType.SKILL_CHOICE, {
                    "creature": creature.display_name,
                    "choices": [{"name": s["name"], "type": s["type"], "power": s.get("power", 0), "description": s["description"]} for s in choices],
                }, "升级！选择新技能（输入序号，0=跳过）："))
        return events

    def apply_skill_choice(self, choice_index: int, replace_index: Optional[int] = None) -> list[WorldEvent]:
        events: list[WorldEvent] = []
        if not self._pending_skill_choice:
            return events
        creature, choices = self._pending_skill_choice
        self._pending_skill_choice = None
        if choice_index < 0 or choice_index >= len(choices):
            events.append(WorldEvent(WorldEventType.SKILL_LEARNED, message="跳过了技能学习"))
            return events
        skill = choices[choice_index]
        creature.learn_skill(skill["name"], replace_index=replace_index)
        events.append(WorldEvent(WorldEventType.SKILL_LEARNED, {
            "creature": creature.display_name, "skill": skill["name"],
        }, f"{creature.display_name} 学会了 【{skill['name']}】！"))
        return events

    # ------------------------------------------------------------------ #
    # 辅助
    # ------------------------------------------------------------------ #

    def _roll_steps(self) -> int:
        balance = self.data.balance.get("world", {})
        mn = balance.get("steps_min", 3)
        mx = balance.get("steps_max", 8)
        return random.randint(mn, mx)

    def is_in_battle(self) -> bool:
        return self._battle_engine is not None

    def end_explore(self) -> list[WorldEvent]:
        self._battle_engine = None
        return [WorldEvent(WorldEventType.EXPLORE_END, message="离开了野外区域")]


# --------------------------------------------------------------------------- #
# 区域解锁检查
# --------------------------------------------------------------------------- #

def check_zone_unlock(save: "SaveSlot", data: "GameData") -> list[str]:
    """检查是否有新区域可解锁，返回新解锁的 zone_id 列表。
    
    unlock_condition 格式（字符串）：
      'default'         → 默认解锁（起始区）
      'tower_best>=N'   → 深渊最深层 >= N
      'dex>=N'          → 图鉴捕捉数 >= N
    """
    newly_unlocked: list[str] = []
    for zone_id, zone in data.zones.items():
        if zone_id in save.unlocked_zones:
            continue
        cond = zone.get("unlock_condition", "default")
        if isinstance(cond, dict):
            # 兼容旧格式
            ctype = cond.get("type", "always")
            unlocked = False
            if ctype in ("always", "default"):
                unlocked = True
            elif ctype == "dex_count":
                unlocked = len(save.dex_caught) >= cond.get("count", 0)
            elif ctype == "zone_cleared":
                unlocked = cond.get("zone_id") in save.unlocked_zones
            elif ctype == "tower_best":
                unlocked = save.deepest_abyss_floor >= cond.get("floor", 0)
        else:
            # 字符串格式
            cond_str = str(cond).strip()
            if cond_str == "default":
                unlocked = True
            elif cond_str.startswith("tower_best>="):
                threshold = int(cond_str.split(">=")[1])
                unlocked = save.deepest_abyss_floor >= threshold
            elif cond_str.startswith("dex>="):
                threshold = int(cond_str.split(">=")[1])
                unlocked = len(save.dex_caught) >= threshold
            else:
                unlocked = False

        if unlocked:
            save.unlock_zone(zone_id)
            newly_unlocked.append(zone_id)
    return newly_unlocked
