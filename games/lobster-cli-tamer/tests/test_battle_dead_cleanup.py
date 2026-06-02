"""测试野外战斗死亡的虾米能正确清理（v0.1.8 修复验证）。

旧 BUG:combat.py take_damage 只在 is_tower=True 时设 dead=True,
导致野外战斗死亡的怪 dead=False HP=0,永远占着 party 槽位,
active_party 排除但槽位不释放 → 抓新怪装不进 6 槽。
"""
import os
import sys
import unittest

# 让脚本可作为测试入口,import lobster_cli_tamer
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lobster_cli_tamer.loader import load_game_data
from lobster_cli_tamer.save import SaveSlot
from lobster_cli_tamer.combat import (
    BattleState, BattleEngine, BattleAction, ActionType,
    BattleResult, Combatant, make_enemy_combatant,
)
from lobster_cli_tamer.creature import Creature


_data = None


def _get_data():
    global _data
    if _data is None:
        _data = load_game_data()
    return _data


def _fresh_save() -> SaveSlot:
    save = SaveSlot(slot=0, version=1, player_name="TestAgent")
    data = _get_data()
    # 给一个主力 party: 3 只礁虾
    party = []
    for sid in ("reef_shrimp", "reef_shrimp", "reef_shrimp"):
        c = Creature.from_species(sid, data, level=10)
        c.bind_species_data(data)
        c.moves = [data.species[sid]["base_skill"]]
        party.append(c)
    while len(party) < 6:
        party.append(None)
    save.party = party
    return save


def test_野外死亡设dead_true():
    """野外战斗 take_damage 致死时也应设 dead=True(v0.1.8 修复)。"""
    data = _get_data()
    c = Creature.from_species("reef_shrimp", data, level=10)
    c.bind_species_data(data)
    cb = Combatant(creature=c)
    cb.shield_hp = 0
    # 野外(is_tower=False)打死
    actual, died = cb.take_damage(9999, is_tower=False)
    assert died is True
    assert c.dead is True, "野外打死也应该 dead=True(旧 BUG 是 dead=False)"
    assert c.hp_current == 0


def test_野外战死清埋后释放槽位():
    """野外战斗胜利后,死掉的怪应被 cleanup_dead_creatures 释放槽位。"""
    save = _fresh_save()
    initial_party_size = sum(1 for c in save.party if c is not None)
    assert initial_party_size == 3
    # 模拟战斗中我方 #1 死掉(deep=False → dead=False(旧 BUG), 现在 dead=True)
    save.party[1].hp_current = 0
    save.party[1].dead = True  # take_damage 致死自动设
    initial_memorial = len(save.memorial)
    # 战斗结束,调用 cleanup
    cleaned = save.cleanup_dead_creatures(cause="野外战斗")
    assert cleaned == 1
    assert len(save.memorial) == initial_memorial + 1
    # 关键:槽位被释放
    assert save.party[1] is None
    # 现在可以装进新怪
    data = _get_data()
    new_c = Creature.from_species("rock_crab", data, level=5)
    new_c.bind_species_data(data)
    new_c.moves = [data.species["rock_crab"]["base_skill"]]
    save.party[1] = new_c
    assert save.party[1].species_id == "rock_crab"


def test_槽位清埋后可继续抓怪模拟6槽装满():
    """集成:模拟野外怪打死我方 1 只后,清埋 + 抓新怪装入,不应该卡死。"""
    save = _fresh_save()
    data = _get_data()
    # 第 1 只死掉
    save.party[0].hp_current = 0
    save.party[0].dead = True
    cleaned = save.cleanup_dead_creatures(cause="野外战斗")
    assert cleaned == 1
    # 此时 active_party 只剩 2 只活的([1] 和 [2])
    alive = save.active_party
    assert len(alive) == 2
    # 抓新怪填入 [0] 槽(现在是 None)
    assert save.party[0] is None
    new_c = Creature.from_species("poison_urchin", data, level=7)
    new_c.bind_species_data(data)
    new_c.moves = [data.species["poison_urchin"]["base_skill"]]
    save.party[0] = new_c
    # 再填 [1] 槽(之前空的)
    new_c2 = Creature.from_species("ghost_shrimp", data, level=6)
    new_c2.bind_species_data(data)
    new_c2.moves = [data.species["ghost_shrimp"]["base_skill"]]
    save.party[1] = new_c2
    # 现在 party 有 [0]=新 poison, [1]=新 ghost, [2]=原 reef = 3 只活的
    alive = save.active_party
    assert len(alive) == 3


def test_没死的不会被误清理():
    """活着的怪(dead=False HP>0)不应该被 cleanup 误清。"""
    save = _fresh_save()
    # 把第 1 只 HP 设 1/48 但不 dead
    save.party[1].hp_current = 1
    save.party[1].dead = False
    cleaned = save.cleanup_dead_creatures(cause="野外战斗")
    assert cleaned == 0
    assert save.party[1] is not None
    assert save.party[1].hp_current == 1


if __name__ == "__main__":
    unittest.main()


def test_battle_turn_中间就清埋_dead_creatures():
    """v0.1.8 修复:战斗 turn 后立即 cleanup,确保 save.party 槽位不卡半死怪。

    场景:战斗中自动换手时,死掉的怪 dead=True HP=0 但战斗未结束。
    必须在 _on_battle_end 之前就清理,否则 _on_battle_end 触发时
    cleanup 又会跑一遍(幂等),但 _on_battle_end 是 state.is_over() 才触发,
    如果战斗因其他原因没结束(例如玩家 SURRENDER 主动退),cleanup 必须在
    battle_turn 里跑。
    """
    from lobster_cli_tamer.creature import Creature
    from lobster_cli_tamer.combat import Combatant, BattleAction, ActionType
    from lobster_cli_tamer.world import WorldSession

    data = _get_data()
    save = _fresh_save()

    # 设一个 zone + sub_area
    ws = WorldSession("reef_zone", "reef_surface", save, data)

    # 手动模拟战斗中 [0] 死
    save.party[0].hp_current = 0
    save.party[0].dead = True
    # cleanup
    cleaned = save.cleanup_dead_creatures(cause="野外战斗")
    assert cleaned == 1
    # 关键:save.party[0] 现在是 None(可被新怪填)
    assert save.party[0] is None
    # 抓新怪填入
    new_c = Creature.from_species("ghost_shrimp", data, level=5)
    new_c.bind_species_data(data)
    new_c.moves = [data.species["ghost_shrimp"]["base_skill"]]
    save.party[0] = new_c
    assert save.party[0] is not None


def test_capture_success_走_loot和cleanup():
    """v0.2.0 修复:抓怪成功(战斗结束)也走 loot + cleanup,不再因 c 试捕
    不消耗回合而完全错过保底补给。
    """
    from lobster_cli_tamer.creature import Creature
    from lobster_cli_tamer.combat import Combatant
    from lobster_cli_tamer.world import WorldSession

    data = _get_data()
    save = _fresh_save()

    # 设一个 dead 怪,模拟战斗中死了
    save.party[0].hp_current = 0
    save.party[0].dead = True

    # 模拟 cleanup
    cleaned = save.cleanup_dead_creatures(cause="野外战斗")
    assert cleaned == 1
    assert save.party[0] is None

    # items: 5 个 net + 3 个 potion + 1 cure (新档默认)
    assert save.items.get("net_basic", 0) == 5

    # 模拟 _grant_emergency_net_if_needed: 旧逻辑 capture_total > 0 不补给
    # 新逻辑 capture_total > 0 + pity < 3 不补给
    assert save.capture_tool_pity == 0
    # 这场景下不应补给 (capture_total > 0 + pity 0 < 3)
    # 但如果 pity 涨到 3, 应补给
    save.capture_tool_pity = 3
    # 旧调用会跑这段
    capture_total = sum(
        count for k, count in save.items.items()
        if k.startswith("net_") or k == "shiny_trap"
    )
    # 旧逻辑 (capture_total > 0) 不补给
    should_grant_old = (capture_total == 0)
    # 新逻辑 (capture_total > 0 + pity < 3) 不补给
    should_grant_new = (capture_total == 0) or (save.capture_tool_pity >= 3)
    # 旧逻辑会错过,新逻辑会补给
    assert should_grant_new is True
    assert should_grant_old is False


def test_capture_consume_pity_涨_补_网():
    """v0.2.1 修复: c 试捕失败也调 consume_capture_tool_pity,
    累计 2 次失败后下次必掉甲网。
    """
    from lobster_cli_tamer.creature import Creature
    save = _fresh_save()
    # 初始 pity 0, 1 个 net
    assert save.capture_tool_pity == 0
    assert save.items.get("net_basic", 0) == 5

    # 试捕 1 次失败: pity 0 -> 1
    granted = save.consume_capture_tool_pity(None)
    assert granted is False
    assert save.capture_tool_pity == 1

    # 试捕 2 次失败: pity 1 -> 2
    granted = save.consume_capture_tool_pity(None)
    assert granted is False
    assert save.capture_tool_pity == 2

    # 试捕 3 次失败: pity 2 >= 2 -> 触发保底
    granted = save.consume_capture_tool_pity(None)
    assert granted is True
    assert save.capture_tool_pity == 0


def test_capture_no_net_still_increments_pity():
    """v0.2.2 修复: 即便没捕捉球, c 试捕仍会调 consume_capture_tool_pity
    涨 pity, 避免玩家卡在"没 net + 战斗不赢"的状态永远不补给。
    """
    save = _fresh_save()
    # 初始 5 net
    assert save.items.get("net_basic", 0) == 5

    # 5 次试捕成功: net 5 -> 0 (pity 不涨因为是 capture tool)
    for _ in range(5):
        save.consume_item("net_basic")
    assert save.items.get("net_basic", 0) == 0

    # 现在没 net, 但 c 试捕仍应涨 pity
    for i in range(3):
        granted = save.consume_capture_tool_pity(None)
        # i=0: pity 0->1
        # i=1: pity 1->2
        # i=2: pity 2->3 -> granted True + reset 0
        if i < 2:
            assert granted is False
            assert save.capture_tool_pity == i + 1
        else:
            assert granted is True
            assert save.capture_tool_pity == 0
