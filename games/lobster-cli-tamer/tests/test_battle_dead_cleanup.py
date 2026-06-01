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
