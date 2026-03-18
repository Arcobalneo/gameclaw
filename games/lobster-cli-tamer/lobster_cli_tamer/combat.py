"""combat.py – 回合制战斗引擎。

BattleState  保存单场战斗的完整状态（双方虾米、临时属性、buff/debuff、护盾、状态异常）。
BattleEngine 驱动战斗流程：初始化 → 循环取行动 → 应用结果 → 检查结束。

设计原则：
- 引擎不负责 IO，所有行动通过 BattleAction 传入。
- 引擎不修改仓库、存档，只处理战斗期间的虾米状态。
- 深渊永久死亡（HP归零立即死亡）标志由引擎设置，由调用方决定写入存档。
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from lobster_cli_tamer.loader import GameData

from lobster_cli_tamer.creature import (
    Creature,
    STATUS_POISON,
    STATUS_PARALYZE,
    STATUS_BURN,
    STATUS_FREEZE,
    STATUS_CONFUSE,
)
from lobster_cli_tamer.skills import execute_skill, get_type_effectiveness, SkillResult
from lobster_cli_tamer.affixes import (
    AffixTriggerState,
    process_affix_event,
    collect_passive_team_affixes,
    AffixEffect,
)


# --------------------------------------------------------------------------- #
# 行动类型
# --------------------------------------------------------------------------- #

class ActionType(Enum):
    USE_SKILL = auto()
    SWITCH = auto()
    SURRENDER = auto()  # 深渊外才有效


@dataclass
class BattleAction:
    action_type: ActionType
    skill_name: Optional[str] = None     # USE_SKILL
    switch_to_index: Optional[int] = None  # SWITCH（party 中的 index）


# --------------------------------------------------------------------------- #
# 战斗参与方
# --------------------------------------------------------------------------- #

@dataclass
class Combatant:
    """单个战斗参与方（玩家 or 敌方）。"""
    creature: Creature
    # 临时属性阶段（倍率叠加）
    stat_stage: dict[str, float] = field(default_factory=lambda: {"atk":1.0,"def":1.0,"spd":1.0,"end":1.0})
    shield_hp: float = 0.0        # 护盾 HP
    status: Optional[str] = None  # 当前状态异常
    status_turns: int = 0         # 状态剩余回合数（0=永续直到战斗结束）
    freeze_skip_next: bool = False # 冰封：下回合跳过
    affix_state: AffixTriggerState = field(default_factory=AffixTriggerState)
    temp_priority: int = 0        # 本轮行动优先级加成

    def apply_stat_change(self, stat: str, value: float, duration: int = 2) -> None:
        # 简化：直接乘进阶段，不追踪持续回合（后续扩展可加 buff list）
        self.stat_stage[stat] = max(0.25, min(4.0, self.stat_stage.get(stat, 1.0) + value))

    def effective_stat(self, stat: str) -> float:
        return self.creature.effective_stat(stat, self.stat_stage)

    def take_damage(self, amount: float, is_tower: bool = False) -> tuple[float, bool]:
        """返回 (实际扣血量, 是否死亡)。护盾先扣。"""
        actual = amount
        if self.shield_hp > 0:
            absorbed = min(self.shield_hp, amount)
            self.shield_hp -= absorbed
            actual = amount - absorbed
        self.creature.hp_current = max(0.0, self.creature.hp_current - actual)
        died = self.creature.hp_current <= 0
        if died and is_tower:
            self.creature.dead = True  # 深渊内永久死亡
        return actual, died

    def tick_status(self) -> list[str]:
        """每回合开始 tick 状态效果，返回日志消息。"""
        msgs: list[str] = []
        if not self.status:
            return msgs
        if self.status == STATUS_POISON:
            dmg = self.creature.stats["hp"] * 0.05
            self.creature.hp_current = max(0, self.creature.hp_current - dmg)
            msgs.append(f"{self.creature.display_name} 中毒！受到 {dmg:.1f} 伤害")
        elif self.status == STATUS_BURN:
            dmg = self.creature.stats["hp"] * 0.05
            self.creature.hp_current = max(0, self.creature.hp_current - dmg)
            msgs.append(f"{self.creature.display_name} 灼烧！受到 {dmg:.1f} 伤害")
            self.stat_stage["atk"] = max(0.25, self.stat_stage.get("atk", 1.0) - 0.02)
        if self.status_turns > 0:
            self.status_turns -= 1
            if self.status_turns == 0:
                msgs.append(f"{self.creature.display_name} 的 {self.status} 解除了")
                self.status = None
        return msgs


# --------------------------------------------------------------------------- #
# 战斗状态
# --------------------------------------------------------------------------- #

class BattleResult(Enum):
    ONGOING = auto()
    PLAYER_WIN = auto()
    PLAYER_LOSE = auto()
    SURRENDERED = auto()


@dataclass
class BattleState:
    player: Combatant
    enemy: Combatant
    turn: int = 0
    result: BattleResult = BattleResult.ONGOING
    log: list[str] = field(default_factory=list)
    is_tower: bool = False  # 深渊模式：HP归零=永久死亡
    # party 切换支持
    player_party: list[Creature] = field(default_factory=list)
    player_active_index: int = 0
    exp_gained: int = 0

    def add_log(self, msg: str) -> None:
        self.log.append(msg)

    def is_over(self) -> bool:
        return self.result != BattleResult.ONGOING


# --------------------------------------------------------------------------- #
# 战斗引擎
# --------------------------------------------------------------------------- #

class BattleEngine:
    def __init__(self, state: BattleState, data: "GameData") -> None:
        self.state = state
        self.data = data
        # 应用 passive_team 词条（战斗开始）
        self._apply_passive_team()

    # ------------------------------------------------------------------ #
    # 初始化
    # ------------------------------------------------------------------ #

    def _apply_passive_team(self) -> None:
        party = [c for c in self.state.player_party if c.is_alive]
        passive = collect_passive_team_affixes(party, self.data)
        for affix in passive:
            fx = affix.get("effect", {})
            if fx.get("type") == "stat_change" and fx.get("target") == "team":
                stat = fx.get("stat", "atk")
                val = fx.get("value", 0)
                self.state.player.apply_stat_change(stat, val)
                self.state.add_log(f"✦ 队伍词条 [{affix['name']}] → {stat}+{val*100:.0f}%")

    # ------------------------------------------------------------------ #
    # 公开：执行一个完整回合
    # ------------------------------------------------------------------ #

    def run_turn(self, player_action: BattleAction) -> BattleState:
        st = self.state
        if st.is_over():
            return st

        st.turn += 1
        st.add_log(f"── 回合 {st.turn} ──────────────────────────────")

        # 处理玩家换手
        if player_action.action_type == ActionType.SWITCH:
            self._handle_switch(player_action)
            # 换手后敌方自由攻击一次
            self._enemy_attack_free()
            self._check_end()
            return st

        if player_action.action_type == ActionType.SURRENDER:
            st.result = BattleResult.SURRENDERED
            return st

        # 决定先手
        player_first = self._resolve_priority(player_action)

        if player_first:
            self._do_player_action(player_action)
            if not st.is_over():
                self._do_enemy_turn()
        else:
            self._do_enemy_turn()
            if not st.is_over():
                self._do_player_action(player_action)

        self._tick_status_both()
        self._check_end()
        return st

    # ------------------------------------------------------------------ #
    # 先手判定
    # ------------------------------------------------------------------ #

    def _resolve_priority(self, player_action: BattleAction) -> bool:
        skill_name = player_action.skill_name
        player_priority = 0
        if skill_name:
            skill = self._find_skill(skill_name)
            if skill:
                for fx in skill.get("effects", []):
                    if fx["type"] == "priority":
                        player_priority = fx.get("value", 1)
        player_priority += self.state.player.temp_priority
        self.state.player.temp_priority = 0  # 清零

        enemy_spd = self.state.enemy.effective_stat("spd")
        player_spd = self.state.player.effective_stat("spd") + player_priority * 9999

        if player_spd == enemy_spd:
            return random.random() < 0.5
        return player_spd > enemy_spd

    # ------------------------------------------------------------------ #
    # 玩家行动
    # ------------------------------------------------------------------ #

    def _do_player_action(self, action: BattleAction) -> None:
        st = self.state
        if not st.player.creature.is_alive:
            return
        # 麻痹跳过检查
        if st.player.status == STATUS_PARALYZE and random.random() < 0.30:
            st.add_log(f"{st.player.creature.display_name} 麻痹！无法行动")
            return
        # 困惑自打检查
        if st.player.status == STATUS_CONFUSE and random.random() < 0.35:
            dmg = st.player.creature.stats["atk"] * 0.4
            st.player.creature.hp_current = max(0, st.player.creature.hp_current - dmg)
            st.add_log(f"{st.player.creature.display_name} 陷入混乱，攻击了自己！({dmg:.1f})")
            if st.player.creature.hp_current <= 0 and st.is_tower:
                st.player.creature.dead = True
            self._check_end()
            return

        skill_name = action.skill_name
        skill = self._find_skill(skill_name) if skill_name else None
        if skill is None:
            st.add_log(f"[找不到技能 {skill_name}，跳过]")
            return

        st.add_log(f"{st.player.creature.display_name} 使用了 【{skill_name}】")
        self._apply_skill(skill, attacker_side=st.player, defender_side=st.enemy, is_player_attacker=True)

    # ------------------------------------------------------------------ #
    # 敌方行动（AI）
    # ------------------------------------------------------------------ #

    def _do_enemy_turn(self) -> None:
        st = self.state
        if not st.enemy.creature.is_alive:
            return
        if st.enemy.status == STATUS_PARALYZE and random.random() < 0.30:
            st.add_log(f"{st.enemy.creature.display_name} 麻痹！无法行动")
            return
        if st.enemy.status == STATUS_FREEZE and st.enemy.freeze_skip_next:
            st.add_log(f"{st.enemy.creature.display_name} 被冰封，无法行动")
            st.enemy.freeze_skip_next = False
            return
        # 简单 AI：随机选自身已有技能
        moves = st.enemy.creature.moves
        skill_name = random.choice(moves) if moves else None
        skill = self._find_skill(skill_name) if skill_name else None
        if skill is None:
            return
        st.add_log(f"{st.enemy.creature.display_name} 使用了 【{skill_name}】")
        self._apply_skill(skill, attacker_side=st.enemy, defender_side=st.player, is_player_attacker=False)

    def _enemy_attack_free(self) -> None:
        """换手后敌方自由攻击。"""
        self._do_enemy_turn()

    # ------------------------------------------------------------------ #
    # 技能应用
    # ------------------------------------------------------------------ #

    def _apply_skill(
        self,
        skill: dict[str, Any],
        attacker_side: Combatant,
        defender_side: Combatant,
        is_player_attacker: bool,
    ) -> None:
        st = self.state
        attacker = attacker_side.creature
        defender = defender_side.creature

        # 词条触发：攻击前
        for eff in process_affix_event(
            attacker, "on_deal_damage", {"hp_pct": attacker.hp_pct}, self.data, attacker_side.affix_state
        ):
            st.add_log(f"  {eff.describe()}")
            self._apply_affix_effect(eff, attacker_side, defender_side)

        atk_skill_type = skill.get("type", "无")
        defender_species = self.data.species[defender.species_id]
        def_type = defender_species["type"]
        type_eff = get_type_effectiveness(atk_skill_type, def_type, self.data.balance)

        result = execute_skill(
            skill,
            attacker,
            defender,
            type_effectiveness=type_eff,
            stage_atk=attacker_side.stat_stage.get("atk", 1.0),
            stage_def=defender_side.stat_stage.get("def", 1.0),
        )

        for msg in result.messages:
            st.add_log(f"  ★ {msg}")

        if type_eff > 1.0:
            st.add_log("  效果拔群！")
        elif type_eff < 1.0 and type_eff > 0:
            st.add_log("  效果不太好……")

        # 伤害
        if result.damage > 0:
            dmg = result.damage
            # 护盾先吸收
            if defender_side.shield_hp > 0:
                absorbed = min(defender_side.shield_hp, dmg)
                defender_side.shield_hp -= absorbed
                dmg -= absorbed
                if absorbed > 0:
                    st.add_log(f"  护盾吸收了 {absorbed:.1f} 伤害")
            defender.hp_current = max(0.0, defender.hp_current - dmg)
            suffix = f"（共{result.multi_hit}连击）" if result.multi_hit else ""
            st.add_log(f"  造成 {result.damage:.1f} 伤害{suffix}")
            if defender.hp_current <= 0 and st.is_tower:
                defender.dead = True

        # 回血 / 自伤（recoil）
        if result.heal > 0:
            attacker.hp_current = min(attacker.stats["hp"], attacker.hp_current + result.heal)
            st.add_log(f"  回复了 {result.heal:.1f} HP")
        elif result.heal < 0:
            attacker.hp_current = max(0.0, attacker.hp_current + result.heal)  # heal<0 即扣血
            st.add_log(f"  反伤 {abs(result.heal):.1f}")
            if attacker.hp_current <= 0 and st.is_tower:
                attacker.dead = True

        # 护盾
        if result.shield:
            attacker_side.shield_hp += result.shield
            st.add_log(f"  获得了 {result.shield:.1f} HP 护盾")

        # 状态异常
        if result.status_applied and not defender_side.status:
            defender_side.status = result.status_applied
            defender_side.status_turns = 0  # 持续到战斗结束
            if result.status_applied == STATUS_FREEZE:
                defender_side.freeze_skip_next = True
            st.add_log(f"  {defender.display_name} 陷入了 {result.status_applied}！")

        # 属性变化
        for sc in result.stat_changes:
            target_side = attacker_side if sc["target"] == "self" else defender_side
            target_side.apply_stat_change(sc["stat"], sc["value"])
            direction = "↑" if sc["value"] > 0 else "↓"
            whose = "我方" if (target_side is st.player) else "对方"
            st.add_log(f"  {whose} {sc['stat'].upper()} {direction}")

        # 词条触发：受伤后
        for eff in process_affix_event(
            defender, "on_take_damage", {"hp_pct": defender.hp_pct}, self.data, defender_side.affix_state
        ):
            st.add_log(f"  {eff.describe()}")
            self._apply_affix_effect(eff, defender_side, attacker_side)

        # HP 阈值词条
        if defender.hp_pct < 0.5:
            for eff in process_affix_event(
                attacker, "on_hp_threshold", {"hp_pct": attacker.hp_pct}, self.data, attacker_side.affix_state
            ):
                st.add_log(f"  {eff.describe()}")
                self._apply_affix_effect(eff, attacker_side, defender_side)

    # ------------------------------------------------------------------ #
    # 词条效果应用
    # ------------------------------------------------------------------ #

    def _apply_affix_effect(
        self,
        eff: AffixEffect,
        owner_side: Combatant,
        opp_side: Combatant,
    ) -> None:
        fx = eff.effect
        t = fx.get("type")
        target_side = owner_side if eff.target in ("self", "team") else opp_side

        if t == "stat_change":
            target_side.apply_stat_change(fx["stat"], fx["value"])
        elif t == "shield":
            owner_side.shield_hp += fx.get("value", 0) * owner_side.creature.stats["hp"]
        elif t == "heal":
            owner_side.creature.hp_current = min(
                owner_side.creature.stats["hp"],
                owner_side.creature.hp_current + fx.get("value", 0) * owner_side.creature.stats["hp"],
            )
        elif t == "status_apply":
            if not opp_side.status and random.random() < fx.get("chance", 0):
                opp_side.status = fx["status"]
                self.state.add_log(f"  词条附加状态: {fx['status']}")

    # ------------------------------------------------------------------ #
    # 状态 tick
    # ------------------------------------------------------------------ #

    def _tick_status_both(self) -> None:
        for side in (self.state.player, self.state.enemy):
            for msg in side.tick_status():
                self.state.add_log(msg)

    # ------------------------------------------------------------------ #
    # 换手
    # ------------------------------------------------------------------ #

    def _handle_switch(self, action: BattleAction) -> None:
        st = self.state
        idx = action.switch_to_index
        if idx is None or idx < 0 or idx >= len(st.player_party):
            st.add_log("[换手失败：无效的 party 序号]")
            return
        new_creature = st.player_party[idx]
        if not new_creature.is_alive:
            st.add_log("[换手失败：该虾米已无法战斗]")
            return
        if new_creature is st.player.creature:
            st.add_log("[换手失败：已经是当前上阵的虾米]")
            return
        st.add_log(f"{st.player.creature.display_name} 退场，{new_creature.display_name} 上场！")
        st.player_active_index = idx
        old_state = st.player
        st.player = Combatant(creature=new_creature)
        # 继承被动队伍词条
        self._apply_passive_team()
        # 触发 on_switch_in
        for eff in process_affix_event(
            new_creature, "on_switch_in", {"hp_pct": new_creature.hp_pct}, self.data, st.player.affix_state
        ):
            st.add_log(f"  {eff.describe()}")
            self._apply_affix_effect(eff, st.player, st.enemy)

    # ------------------------------------------------------------------ #
    # 结束检查
    # ------------------------------------------------------------------ #

    def _check_end(self) -> None:
        st = self.state
        if st.enemy.creature.hp_current <= 0:
            st.result = BattleResult.PLAYER_WIN
            enemy_sp = self.data.species.get(st.enemy.creature.species_id, {})
            enemy_lv = st.enemy.creature.level
            st.exp_gained = max(10, enemy_sp.get("affix_slots", 2) * enemy_lv * 5)
            st.add_log(f"✓ {st.enemy.creature.display_name} 倒下了！获得 {st.exp_gained} EXP")
            return

        # 玩家方：当前出战虾米已倒
        if not st.player.creature.is_alive:
            # 从 player_party 快照中找第一个存活的替补，自动换上
            for i, c in enumerate(st.player_party):
                if c.is_alive and c is not st.player.creature:
                    st.add_log(
                        f"⚡ {st.player.creature.display_name} 倒下！"
                        f"{c.display_name} 自动上场！"
                    )
                    st.player_active_index = i
                    st.player = Combatant(creature=c)
                    self._apply_passive_team()
                    return  # 战斗继续，不结束
            # 无可替补 → 全灭
            st.result = BattleResult.PLAYER_LOSE
            st.add_log("✗ 我方全灭！")

    # ------------------------------------------------------------------ #
    # 辅助
    # ------------------------------------------------------------------ #

    def _find_skill(self, skill_name: Optional[str]) -> Optional[dict[str, Any]]:
        if not skill_name:
            return None
        # 先按名字查
        for s in self.data.skills.values():
            if s["name"] == skill_name:
                return s
        return None

    def available_player_moves(self) -> list[str]:
        return list(self.state.player.creature.moves)

    def render_status_bar(self) -> str:
        p = self.state.player
        e = self.state.enemy
        def _bar(c: Combatant) -> str:
            shields = f" 🛡{c.shield_hp:.0f}" if c.shield_hp > 0 else ""
            status = f" [{c.status}]" if c.status else ""
            plague = " 🦠" if c.creature.has_plague else ""
            affixes_str = ""
            for slot in c.creature.affix_slots:
                if not slot.is_empty():
                    aff = self.data.affixes.get(slot.affix_id)
                    if aff:
                        from lobster_cli_tamer.affixes import TIER_SYMBOLS
                        sym = TIER_SYMBOLS.get(aff["tier"], "?")
                        affixes_str += f" {sym}{aff['name']}"
            return (
                f"{c.creature.display_name} Lv{c.creature.level} "
                f"HP {c.creature.hp_current:.0f}/{c.creature.stats['hp']:.0f}"
                f"{shields}{status}{plague}{affixes_str}"
            )
        return f"[我方] {_bar(p)}\n[对手] {_bar(e)}"


# --------------------------------------------------------------------------- #
# 工厂：从物种 id 构建战斗用 Combatant（敌方）
# --------------------------------------------------------------------------- #

def make_enemy_combatant(
    species_id: str,
    level: int,
    data: "GameData",
    affix_ids: Optional[list[str]] = None,
) -> Combatant:
    from lobster_cli_tamer.creature import Creature as _C, AffixSlot
    enemy = _C.from_species(species_id, data, level=level)
    enemy.bind_species_data(data)
    # 附加指定词条
    if affix_ids:
        for i, aid in enumerate(affix_ids):
            if i < len(enemy.affix_slots):
                enemy.affix_slots[i].affix_id = aid
    return Combatant(creature=enemy)
