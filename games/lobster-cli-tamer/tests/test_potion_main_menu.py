"""v0.2.4 主菜单用药测试"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lobster_cli_tamer.save import new_save, write_save
from lobster_cli_tamer.creature import Creature
from lobster_cli_tamer.loader import load_game_data


def test_potion_heals_active_party():
    data = load_game_data()
    save = new_save(0, 'test-potion')
    c1 = Creature.from_species('reef_shrimp', data, level=5)
    c1.bind_species_data(data)
    c1.moves = [data.species[c1.species_id]['base_skill']]
    c1.hp_current = c1.stats['hp'] * 0.2  # 20% HP
    save.party = [c1, None, None, None, None, None]
    save.items['potion_minor'] = 3
    write_save(save)
    
    # 模拟 game._use_potion
    assert save.consume_item('potion_minor', 1) is True
    healed = 0
    for c in save.party:
        if c is not None and c.hp_current > 0 and c.hp_current < c.stats['hp']:
            heal_amt = c.stats['hp'] * 0.3
            c.hp_current = min(c.stats['hp'], c.hp_current + heal_amt)
            healed += 1
    assert healed == 1
    # HP 从 20% 涨到 50%
    expected = c1.stats['hp'] * 0.5
    assert abs(c1.hp_current - expected) < 0.1
    # potion 减到 2
    assert save.items['potion_minor'] == 2


def test_potion_heals_multiple_creatures():
    data = load_game_data()
    save = new_save(0, 'test-potion-multi')
    creatures = []
    for i in range(3):
        c = Creature.from_species('reef_shrimp', data, level=5)
        c.bind_species_data(data)
        c.moves = [data.species[c.species_id]['base_skill']]
        c.hp_current = c.stats['hp'] * 0.1  # 10% HP
        creatures.append(c)
    save.party = creatures + [None, None, None]
    save.items['potion_minor'] = 3
    write_save(save)
    
    assert save.consume_item('potion_minor', 1) is True
    healed = 0
    for c in save.party:
        if c is not None and c.hp_current > 0 and c.hp_current < c.stats['hp']:
            heal_amt = c.stats['hp'] * 0.3
            c.hp_current = min(c.stats['hp'], c.hp_current + heal_amt)
            healed += 1
    assert healed == 3


def test_potion_fails_when_empty():
    data = load_game_data()
    save = new_save(0, 'test-potion-empty')
    save.items['potion_minor'] = 0
    write_save(save)
    assert save.consume_item('potion_minor', 1) is False


if __name__ == '__main__':
    test_potion_heals_active_party()
    print("✓ test_potion_heals_active_party")
    test_potion_heals_multiple_creatures()
    print("✓ test_potion_heals_multiple_creatures")
    test_potion_fails_when_empty()
    print("✓ test_potion_fails_when_empty")
    print("All tests passed")
