"""v0.2.7 深渊退出时区域解锁测试

Bug: _abyss_loop 退出时未调 check_zone_unlock, 导致 deepest>=10 也未解锁深流峡谷。
v0.2.7 修复: 退出时调 check_zone_unlock + write_save。
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lobster_cli_tamer.save import new_save, SaveSlot
from lobster_cli_tamer.loader import load_game_data
from lobster_cli_tamer.world import check_zone_unlock


def test_check_zone_unlock_at_floor_10():
    """deepest_abyss_floor=10 应解锁 deep_current_canyon"""
    data = load_game_data()
    save = new_save(0, 'test')
    save.deepest_abyss_floor = 10
    new_unlocks = check_zone_unlock(save, data)
    assert 'deep_current_canyon' in new_unlocks, f"floor 10 should unlock deep_current_canyon, got {new_unlocks}"
    assert 'deep_current_canyon' in save.unlocked_zones


def test_check_zone_unlock_no_unlock_below_10():
    """deepest=5 不应解锁"""
    data = load_game_data()
    save = new_save(0, 'test')
    save.deepest_abyss_floor = 5
    new_unlocks = check_zone_unlock(save, data)
    assert 'deep_current_canyon' not in new_unlocks


def test_check_zone_unlock_floor_20():
    """deepest=20 应解锁 poison_algae_forest"""
    data = load_game_data()
    save = new_save(0, 'test')
    save.deepest_abyss_floor = 20
    new_unlocks = check_zone_unlock(save, data)
    assert 'poison_algae_forest' in new_unlocks


if __name__ == '__main__':
    test_check_zone_unlock_at_floor_10()
    print("✓ test_check_zone_unlock_at_floor_10")
    test_check_zone_unlock_no_unlock_below_10()
    print("✓ test_check_zone_unlock_no_unlock_below_10")
    test_check_zone_unlock_floor_20()
    print("✓ test_check_zone_unlock_floor_20")
    print("All tests passed")
