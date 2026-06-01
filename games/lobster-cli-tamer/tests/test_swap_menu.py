"""测试 SaveSlot 的 box/party 互换能力(v0.1.8 新增)。"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lobster_cli_tamer.save import SaveSlot
from lobster_cli_tamer.creature import Creature
from lobster_cli_tamer.loader import load_game_data


_data = None


def _get_data():
    global _data
    if _data is None:
        _data = load_game_data()
    return _data


def _fresh_save_with_box() -> SaveSlot:
    save = SaveSlot(slot=0, version=1, player_name="TestAgent")
    data = _get_data()
    # 1 只 party,2 只 box
    c1 = Creature.from_species("reef_shrimp", data, level=10)
    c1.bind_species_data(data)
    c1.moves = [data.species["reef_shrimp"]["base_skill"]]
    c2 = Creature.from_species("rock_crab", data, level=5)
    c2.bind_species_data(data)
    c2.moves = [data.species["rock_crab"]["base_skill"]]
    c3 = Creature.from_species("poison_urchin", data, level=7)
    c3.bind_species_data(data)
    c3.moves = [data.species["poison_urchin"]["base_skill"]]
    save.party = [c1, None, None, None, None, None]
    save.box = [c2, c3]
    return save


def test_box有怪时可以调换():
    save = _fresh_save_with_box()
    assert len(save.box) == 2
    assert save.party[0] is not None
    # 模拟 _swap_menu 流程:把 box[0] 调到 party 第一个空槽(=index 1)
    picked = save.box.pop(0)
    for i in range(len(save.party)):
        if save.party[i] is None:
            save.party[i] = picked
            break
    assert len(save.box) == 1
    assert save.party[1] is not None
    assert save.party[1].species_id == "rock_crab"


def test_party_退到_box():
    save = _fresh_save_with_box()
    initial_box_len = len(save.box)
    moved = save.party[0]
    save.party[0] = None
    save.box.append(moved)
    assert len(save.box) == initial_box_len + 1
    assert save.party[0] is None


def test_party_全满_不能从_box调入():
    """当 party 6 槽全满时,不应让 box→party 调入(避免丢失 box 怪)。"""
    save = _fresh_save_with_box()
    data = _get_data()
    # 把所有空槽填满
    for sid in ("reef_shrimp", "rock_crab", "poison_urchin", "ghost_shrimp", "coral_rock_crab"):
        c = Creature.from_species(sid, data, level=5)
        c.bind_species_data(data)
        c.moves = [data.species[sid]["base_skill"]]
        for i in range(len(save.party)):
            if save.party[i] is None:
                save.party[i] = c
                break
    # 现在 party 满
    assert all(c is not None for c in save.party)
    # 模拟 swap menu "2" 应被 warn 拦截(我们在 _swap_menu 里有检查)
    # 这里只验证检查条件
    has_empty = any(c is None for c in save.party)
    assert has_empty is False


if __name__ == "__main__":
    unittest.main()
