"""v0.2.3 AI 友好模式测试

验证:
1. GameOptions.ai_easy 默认 False
2. parse_options('--ai-easy') 打开 ai_easy
3. encounter() 加 ai_easy=True 时, 怪 Lv 锁 ≤ party_max_lv + 1
4. encounter() 不传 ai_easy 时, 行为不变 (regression)
5. BattleState.ai_easy 默认 False
6. WorldSession 接受 ai_easy 参数
"""
import os
import sys
import random

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lobster_cli_tamer"))

from lobster_cli_tamer.game import GameOptions, parse_options
from lobster_cli_tamer.capture import encounter
from lobster_cli_tamer.combat import BattleState
from lobster_cli_tamer.world import WorldSession
from lobster_cli_tamer.loader import load_game_data


def test_game_options_ai_easy_default_false():
    opts = GameOptions()
    assert opts.ai_easy is False


def test_parse_options_ai_easy():
    opts = parse_options(['--ai-easy'])
    assert opts.ai_easy is True


def test_parse_options_no_ai_easy():
    opts = parse_options([])
    assert opts.ai_easy is False


def test_battle_state_ai_easy_default_false():
    state = BattleState(player=None, enemy=None)
    assert state.ai_easy is False


def test_encounter_ai_easy_caps_level():
    """ai_easy=True 时, 怪 Lv 不超过 party_max_lv + 1"""
    data = load_game_data()
    reef_surface = data.zones['reef_zone']['sub_areas'][0]
    # level_range [1, 10], party Lv5
    # 不开 ai_easy: 可能 roll 到 10
    random.seed(42)
    no_easy_levels = []
    for _ in range(50):
        enc = encounter(reef_surface, data, party_max_lv=5, ai_easy=False)
        if enc is not None:
            no_easy_levels.append(enc.level)
    # 开 ai_easy: 全部 ≤ 6
    random.seed(42)
    easy_levels = []
    for _ in range(50):
        enc = encounter(reef_surface, data, party_max_lv=5, ai_easy=True)
        if enc is not None:
            easy_levels.append(enc.level)
    print(f"no_easy: max={max(no_easy_levels) if no_easy_levels else None}, easy: max={max(easy_levels) if easy_levels else None}")
    if easy_levels:
        assert max(easy_levels) <= 6, f"ai_easy should cap at party_max_lv+1=6, got {max(easy_levels)}"
    if no_easy_levels:
        # 不开 ai_easy 时应该至少有 >6 的
        assert any(l > 6 for l in no_easy_levels), "no_easy should have some >6 levels in 50 samples"


def test_world_session_ai_easy():
    data = load_game_data()
    save_path = '/root/.lobster-cli-tamer/save_0.json'
    from lobster_cli_tamer.save import new_save, write_save, SAVE_DIR
    save = new_save(0, 'test')
    write_save(save)
    ws = WorldSession('reef_zone', 'reef_surface', save, data, ai_easy=True)
    assert ws.ai_easy is True
    ws2 = WorldSession('reef_zone', 'reef_surface', save, data)
    assert ws2.ai_easy is False


if __name__ == '__main__':
    test_game_options_ai_easy_default_false()
    print("✓ test_game_options_ai_easy_default_false")
    test_parse_options_ai_easy()
    print("✓ test_parse_options_ai_easy")
    test_parse_options_no_ai_easy()
    print("✓ test_parse_options_no_ai_easy")
    test_battle_state_ai_easy_default_false()
    print("✓ test_battle_state_ai_easy_default_false")
    test_encounter_ai_easy_caps_level()
    print("✓ test_encounter_ai_easy_caps_level")
    test_world_session_ai_easy()
    print("✓ test_world_session_ai_easy")
    print("All tests passed")
