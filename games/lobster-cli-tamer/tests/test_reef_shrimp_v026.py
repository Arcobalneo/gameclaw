"""v0.2.6 reef_shrimp 数值调整 + ai_easy cap 测试
- reef_shrimp base_stats HP 40→60, ATK 25→30, DEF 18→20, SPD 48→50, END 18→22
- ai_easy cap: party_max_lv (不再 +1)
"""
import os
import sys
import random
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lobster_cli_tamer.creature import Creature
from lobster_cli_tamer.loader import load_game_data


def test_reef_shrimp_v5_stats():
    """Lv5 reef_shrimp 应该有 60 + 2*4 = 68 HP"""
    data = load_game_data()
    c = Creature.from_species('reef_shrimp', data, level=5)
    c.bind_species_data(data)
    # base 60 + growth 2*4 = 68
    expected_hp = 60 + 2*4
    assert c.stats['hp'] == expected_hp, f"reef_shrimp Lv5 HP should be {expected_hp}, got {c.stats['hp']}"


def test_ai_easy_caps_at_party_max_lv():
    """ai_easy=True 时, 怪 Lv 不超过 party_max_lv"""
    data = load_game_data()
    reef_surface = data.zones['reef_zone']['sub_areas'][0]
    random.seed(42)
    levels = []
    for _ in range(50):
        enc = data  # dummy
        from lobster_cli_tamer.capture import encounter
        enc = encounter(reef_surface, data, party_max_lv=5, ai_easy=True)
        if enc is not None:
            levels.append(enc.level)
    if levels:
        assert max(levels) <= 5, f"ai_easy should cap at party_max_lv=5, got max {max(levels)}"


if __name__ == '__main__':
    test_reef_shrimp_v5_stats()
    print("✓ test_reef_shrimp_v5_stats")
    test_ai_easy_caps_at_party_max_lv()
    print("✓ test_ai_easy_caps_at_party_max_lv")
    print("All tests passed")
