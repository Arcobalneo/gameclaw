"""v0.2.5 数值调整测试
- plague_max_rate: 0.5 → 0.25
- plague_rate_per_floor: 0.05 → 0.03
- taint_to_plague_threshold: 3 → 5
- level_scaling_per_floor: 0.8 → 0.6
- normal 净疫盐补给: 0-1 → 1-2

预期:
- 5 层疫病死亡率: 5×0.03=0.15 (15%, 之前 25%)
- 7 层疫病死亡率: 7×0.03=0.21 (21%, 之前 35%)
- 10 层 (BOSS 10): 10×0.03=0.30 (30%, 之前 50%) — 但 cap 0.25 (25%)
- 4 层 normal 净疫盐 1-2 必有
- 怪等级 10 层: 5 + 10*0.6 = 11 (之前 5+10*0.8=13)
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lobster_cli_tamer.creature import Creature
from lobster_cli_tamer.loader import load_game_data


def test_plague_death_chance_at_floor_5():
    data = load_game_data()
    c = Creature.from_species('reef_shrimp', data, level=5)
    c.bind_species_data(data)
    c.has_plague = True
    c.plague_floors = 5
    chance = c.plague_death_chance(data.balance)
    # 5 * 0.03 = 0.15
    assert abs(chance - 0.15) < 0.01, f"floor 5 chance should be ~0.15, got {chance}"


def test_plague_death_chance_at_floor_10():
    data = load_game_data()
    c = Creature.from_species('reef_shrimp', data, level=5)
    c.bind_species_data(data)
    c.has_plague = True
    c.plague_floors = 10
    chance = c.plague_death_chance(data.balance)
    # min(10 * 0.03, 0.25) = 0.25
    assert abs(chance - 0.25) < 0.01, f"floor 10 chance should be capped 0.25, got {chance}"


def test_plague_death_chance_capped():
    data = load_game_data()
    c = Creature.from_species('reef_shrimp', data, level=5)
    c.bind_species_data(data)
    c.has_plague = True
    c.plague_floors = 20
    chance = c.plague_death_chance(data.balance)
    # min(20 * 0.03, 0.25) = 0.25
    assert abs(chance - 0.25) < 0.01, f"floor 20+ chance should be capped 0.25, got {chance}"


def test_taint_threshold_5():
    data = load_game_data()
    t = data.balance['tower']['taint_to_plague_threshold']
    assert t == 5, f"taint threshold should be 5, got {t}"


def test_plague_max_rate_025():
    data = load_game_data()
    r = data.balance['tower']['plague_max_rate']
    assert r == 0.25, f"plague max rate should be 0.25, got {r}"


def test_level_scaling_04():
    data = load_game_data()
    s = data.balance['tower']['level_scaling_per_floor']
    assert s == 0.4, f"level scaling should be 0.6, got {s}"


def test_normal_drop_cure_plague():
    """normal 层 净疫盐补给 1-2 (保证补给)"""
    data = load_game_data()
    drops = data.tower_config['drops']
    nrange = drops['normal']['净疫盐']
    assert nrange[0] >= 1, f"normal 净疫盐 min should be >= 1, got {nrange}"


if __name__ == '__main__':
    test_plague_death_chance_at_floor_5()
    print("✓ test_plague_death_chance_at_floor_5")
    test_plague_death_chance_at_floor_10()
    print("✓ test_plague_death_chance_at_floor_10")
    test_plague_death_chance_capped()
    print("✓ test_plague_death_chance_capped")
    test_taint_threshold_5()
    print("✓ test_taint_threshold_5")
    test_plague_max_rate_025()
    print("✓ test_plague_max_rate_025")
    test_level_scaling_04()
    print("✓ test_level_scaling_04")
    test_normal_drop_cure_plague()
    print("✓ test_normal_drop_cure_plague")
    print("All tests passed")
