import pathlib
import tempfile

import pytest

import lobster_cli_tamer.save as save_mod
from lobster_cli_tamer.creature import Creature
from lobster_cli_tamer.game import Game, GameOptions, main
from lobster_cli_tamer.loader import load_game_data
from lobster_cli_tamer.render import render_menu
from lobster_cli_tamer.save import SaveSlot, load_save


class InputFeeder:
    def __init__(self, answers: list[str]) -> None:
        self._answers = iter(answers)

    def __call__(self, prompt: str = "") -> str:
        return next(self._answers)


class FakeBattleEngine:
    def available_player_moves(self) -> list[str]:
        return ["潮击1", "防御姿态1"]

    def render_status_bar(self) -> str:
        return "[我方] 礁虾 Lv8 HP 24/24\n[对手] 海草蟹 Lv5 HP 18/18"


class FakeWorldSession:
    def __init__(self) -> None:
        self._battle_engine = FakeBattleEngine()
        self._turns = 0

    def is_in_battle(self) -> bool:
        return self._turns == 0

    def battle_turn(self, action) -> list:
        self._turns += 1
        return []


class FakeExploreSession:
    def __init__(self, *args, **kwargs) -> None:
        self._pending_skill_choice = None

    def step(self) -> list:
        return []

    def is_in_battle(self) -> bool:
        return False

    def end_explore(self) -> None:
        return None


@pytest.fixture
def isolated_save_dir():
    old_dir = save_mod.SAVE_DIR
    old_last = save_mod._LAST_SLOT_FILE
    tmp_dir = pathlib.Path(tempfile.mkdtemp())
    save_mod.SAVE_DIR = tmp_dir
    save_mod._LAST_SLOT_FILE = tmp_dir / "last_slot"
    try:
        yield tmp_dir
    finally:
        save_mod.SAVE_DIR = old_dir
        save_mod._LAST_SLOT_FILE = old_last


def _make_game(data, *, terminal_native: bool = True) -> Game:
    return Game(
        GameOptions(
            terminal_native=terminal_native,
            no_color=terminal_native,
            no_banner=terminal_native,
            no_observer=terminal_native,
        )
    )


def _make_save(data) -> SaveSlot:
    save = SaveSlot(slot=0, player_name="测试")
    creature = Creature.from_species("reef_shrimp", data, level=8)
    creature.bind_species_data(data)
    creature.moves = ["潮击1", "防御姿态1", "蜕壳1"]
    save.party = [creature, None, None, None, None, None]
    return save


def test_help_works(capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--help"])

    assert exc.value.code == 0
    out = capsys.readouterr().out
    assert "usage:" in out.lower()
    assert "--terminal-native" in out
    assert "--save-slot" in out


def test_render_menu_compact_omits_framing(capsys) -> None:
    render_menu(
        "选择行动",
        [("1", "探索"), ("q", "退出")],
        prompt=None,
        compact=True,
    )

    out = capsys.readouterr().out
    assert "[1]" in out
    assert "[q]" in out
    assert "选择行动" not in out
    assert "────────────────────────────────────────" not in out


def test_terminal_native_save_slot_and_player_name_enters_main_flow(monkeypatch, capsys, isolated_save_dir) -> None:
    monkeypatch.setattr("lobster_cli_tamer.game.generate_session_report", lambda *args, **kwargs: None)
    monkeypatch.setattr("builtins.input", InputFeeder(["q"]))

    main(["--terminal-native", "--save-slot", "0", "--player-name", "Agent"])

    out = capsys.readouterr().out
    assert "STATE: MAIN_MENU" in out
    assert "ACTIONS: 1=探索,2=深渊,3=工坊,4=图鉴,5=队伍,6=存档,q=退出" in out
    assert "PROMPT: INPUT_ACTION" in out

    loaded = load_save(0, load_game_data())
    assert loaded.player_name == "Agent"


def test_terminal_native_save_select_outputs_anchors(monkeypatch, capsys, isolated_save_dir) -> None:
    data = load_game_data()
    game = _make_game(data)
    game.data = data
    monkeypatch.setattr("builtins.input", InputFeeder(["q"]))

    game._select_save()

    out = capsys.readouterr().out
    assert "STATE: SAVE_SELECT" in out
    assert "ACTIONS: 0=槽0,1=槽1,2=槽2,q=退出" in out
    assert "PROMPT: INPUT_ACTION" in out


def test_terminal_native_save_name_prompt_outputs_actions(monkeypatch, capsys, isolated_save_dir) -> None:
    data = load_game_data()
    game = _make_game(data)
    game.data = data
    monkeypatch.setattr("builtins.input", InputFeeder(["0", ""]))

    game._select_save()

    out = capsys.readouterr().out
    assert "STATE: SAVE_NAME" in out
    assert "ACTIONS: text=玩家名,enter=默认(甲录师)" in out
    assert "PROMPT: INPUT_PLAYER_NAME" in out

    loaded = load_save(0, data)
    assert loaded.player_name == "甲录师"


def test_terminal_native_battle_menu_outputs_anchors(monkeypatch, capsys) -> None:
    data = load_game_data()
    game = _make_game(data)
    game.data = data
    game.save = _make_save(data)
    monkeypatch.setattr("builtins.input", InputFeeder(["1"]))

    game._process_world_events(FakeWorldSession(), [])

    out = capsys.readouterr().out
    assert "STATE: BATTLE_MENU" in out
    assert "ACTIONS:" in out
    assert "PROMPT: INPUT_ACTION" in out


def test_terminal_native_abyss_decision_outputs_anchors(monkeypatch, capsys, isolated_save_dir) -> None:
    data = load_game_data()
    game = _make_game(data)
    game.data = data
    game.save = _make_save(data)
    monkeypatch.setattr("builtins.input", InputFeeder(["y", "q"]))

    game._abyss_loop()

    out = capsys.readouterr().out
    assert "STATE: ABYSS_DECISION" in out
    assert "ACTIONS: enter=前进,q=撤退" in out
    assert "PROMPT: INPUT_ACTION" in out


def test_terminal_native_explore_loop_outputs_anchors(monkeypatch, capsys) -> None:
    data = load_game_data()
    game = _make_game(data)
    game.data = data
    game.save = _make_save(data)
    zone_id = next(iter(data.zones))
    sub_area_id = data.zones[zone_id]["sub_areas"][0]["id"]
    monkeypatch.setattr("lobster_cli_tamer.game.WorldSession", FakeExploreSession)
    monkeypatch.setattr("lobster_cli_tamer.game.write_save", lambda *args, **kwargs: None)
    monkeypatch.setattr("builtins.input", InputFeeder(["q"]))

    game._explore_loop(zone_id, sub_area_id)

    out = capsys.readouterr().out
    assert "STATE: EXPLORE_LOOP" in out
    assert "ACTIONS: enter=继续探索,q=离开探索" in out
    assert "PROMPT: INPUT_ACTION" in out


def test_terminal_native_workshop_menu_outputs_anchors(monkeypatch, capsys) -> None:
    data = load_game_data()
    game = _make_game(data)
    game.data = data
    game.save = _make_save(data)
    monkeypatch.setattr("builtins.input", InputFeeder(["0"]))

    game._workshop_menu()

    out = capsys.readouterr().out
    assert "STATE: WORKSHOP_MENU" in out
    assert "ACTIONS: 1=重投,2=升阶,3=封印,4=解封,5=净化,0=返回" in out
    assert "PROMPT: INPUT_ACTION" in out


def test_terminal_native_invalid_input_uses_fixed_error(monkeypatch, capsys) -> None:
    data = load_game_data()
    game = _make_game(data)
    game.data = data
    game.save = _make_save(data)
    monkeypatch.setattr("lobster_cli_tamer.game.write_save", lambda *args, **kwargs: None)
    monkeypatch.setattr("builtins.input", InputFeeder(["x", "q"]))

    game._main_menu()

    out = capsys.readouterr().out
    assert "ERROR: INVALID_INPUT" in out


def test_terminal_native_press_enter_prompts_emit_enter_action(monkeypatch, capsys) -> None:
    data = load_game_data()
    game = _make_game(data)
    game.data = data
    game.save = _make_save(data)
    monkeypatch.setattr("builtins.input", InputFeeder([""]))

    game._dex_view()

    out = capsys.readouterr().out
    assert "STATE: DEX_VIEW" in out
    assert "ACTIONS: enter=返回" in out
    assert "PROMPT: PRESS_ENTER" in out


def test_eof_exits_gracefully_without_traceback(monkeypatch, capsys, isolated_save_dir) -> None:
    monkeypatch.setattr("lobster_cli_tamer.game.generate_session_report", lambda *args, **kwargs: None)

    def raise_eof(prompt: str = "") -> str:
        raise EOFError

    monkeypatch.setattr("builtins.input", raise_eof)

    with pytest.raises(SystemExit) as exc:
        main(["--terminal-native", "--save-slot", "0", "--player-name", "EOFTester"])

    assert exc.value.code == 0
    captured = capsys.readouterr()
    assert "输入中断，正在保存并退出…" in captured.out
    assert "Traceback" not in (captured.out + captured.err)

    loaded = load_save(0, load_game_data())
    assert loaded.player_name == "EOFTester"
