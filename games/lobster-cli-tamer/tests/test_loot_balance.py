from lobster_cli_tamer.combat import BattleResult, BattleState, Combatant
from lobster_cli_tamer.creature import Creature
from lobster_cli_tamer.loader import load_game_data
from lobster_cli_tamer.save import SaveSlot
from lobster_cli_tamer.tower import FloorType, TowerSession
from lobster_cli_tamer.world import WorldEventType, WorldSession


def _make_save(data):
    save = SaveSlot(slot=123, player_name="测试")
    player = Creature.from_species("reef_shrimp", data, level=10)
    player.bind_species_data(data)
    player.moves = ["潮击1"]
    save.party = [player, None, None, None, None, None]
    return save, player


def test_world_battle_loot_can_restore_basic_nets(monkeypatch) -> None:
    data = load_game_data()
    save, _ = _make_save(data)
    zone = data.zones["reef_zone"]
    sub = zone["sub_areas"][0]
    ws = WorldSession(zone["id"], sub["id"], save, data)

    rolls = iter([0.0, 0.99])
    monkeypatch.setattr("lobster_cli_tamer.world.random.random", lambda: next(rolls))
    monkeypatch.setattr("lobster_cli_tamer.world.random.randint", lambda a, b: 1)

    loot = ws._roll_battle_loot()
    assert loot is not None
    assert loot["id"] == "net_basic"
    assert loot["count"] == 1


def test_world_battle_end_applies_loot(monkeypatch) -> None:
    data = load_game_data()
    save, player = _make_save(data)
    zone = data.zones["reef_zone"]
    sub = zone["sub_areas"][0]
    ws = WorldSession(zone["id"], sub["id"], save, data)

    enemy = Creature.from_species("iron_shell_claw", data, level=8)
    enemy.bind_species_data(data)

    monkeypatch.setattr(ws, "_roll_battle_loot", lambda: {"id": "net_basic", "name": "甲网", "count": 1})
    before = save.get_item_count("net_basic")
    state = BattleState(
        player=Combatant(creature=player),
        enemy=Combatant(creature=enemy),
        result=BattleResult.PLAYER_WIN,
        exp_gained=0,
        player_party=save.active_party,
    )

    events = ws._on_battle_end(state)

    assert save.get_item_count("net_basic") == before + 1
    assert any(ev.event_type == WorldEventType.ITEM_FOUND for ev in events)


def test_shared_pity_triggers_guaranteed_basic_net() -> None:
    data = load_game_data()
    save, _ = _make_save(data)

    assert save.consume_capture_tool_pity(None) is False
    assert save.capture_tool_pity == 1
    assert save.consume_capture_tool_pity("jihe_core") is False
    assert save.capture_tool_pity == 2
    assert save.consume_capture_tool_pity(None) is True
    assert save.capture_tool_pity == 0
    assert save.consume_capture_tool_pity("net_fine") is False
    assert save.capture_tool_pity == 0


def test_world_pity_guarantees_basic_net(monkeypatch) -> None:
    data = load_game_data()
    save, _ = _make_save(data)
    save.capture_tool_pity = 2
    zone = data.zones["reef_zone"]
    sub = zone["sub_areas"][0]
    ws = WorldSession(zone["id"], sub["id"], save, data)

    monkeypatch.setattr("lobster_cli_tamer.world.random.random", lambda: 0.99)

    loot = ws._roll_battle_loot()
    assert loot is not None
    assert loot["id"] == "net_basic"
    assert loot.get("guaranteed") is True
    assert save.capture_tool_pity == 0


def test_tower_normal_floor_can_drop_basic_nets(monkeypatch) -> None:
    data = load_game_data()
    save, _ = _make_save(data)
    tower = TowerSession(save, data)
    tower._floor_type = FloorType.NORMAL

    rolls = iter([1, 0, 1])
    monkeypatch.setattr("lobster_cli_tamer.tower.random.randint", lambda a, b: next(rolls))
    monkeypatch.setattr(
        "lobster_cli_tamer.tower.random.choice",
        lambda candidates: next(c for c in candidates if c["id"] == "net_basic"),
    )

    drop = tower._roll_drop()
    assert drop is not None
    assert drop["id"] == "net_basic"


def test_tower_boss_floor_can_drop_higher_tier_nets(monkeypatch) -> None:
    data = load_game_data()
    save, _ = _make_save(data)
    tower = TowerSession(save, data)
    tower._floor_type = FloorType.BOSS

    rolls = iter([8, 3, 2, 1, 1, 1, 1])
    monkeypatch.setattr("lobster_cli_tamer.tower.random.randint", lambda a, b: next(rolls))
    monkeypatch.setattr(
        "lobster_cli_tamer.tower.random.choice",
        lambda candidates: next(c for c in candidates if c["id"] == "net_spirit"),
    )

    drop = tower._roll_drop()
    assert drop is not None
    assert drop["id"] == "net_spirit"


def test_tower_pity_guarantees_basic_net(monkeypatch) -> None:
    data = load_game_data()
    save, _ = _make_save(data)
    save.capture_tool_pity = 2
    tower = TowerSession(save, data)
    tower._floor_type = FloorType.NORMAL

    monkeypatch.setattr("lobster_cli_tamer.tower.random.randint", lambda a, b: 0)
    monkeypatch.setattr("lobster_cli_tamer.tower.random.random", lambda: 0.99)

    drop = tower._roll_drop()
    assert drop is not None
    assert drop["id"] == "net_basic"
    assert drop.get("guaranteed") is True
    assert save.capture_tool_pity == 0


def test_normal_floor_no_longer_drops_core_affix_materials() -> None:
    data = load_game_data()
    normal = data.tower_config["drops"]["normal"]
    assert "甲核" not in normal
    assert "灵晶" not in normal
    assert "潮石" not in normal
    assert "甲网" in normal


def test_floor_drop_fallback_only_keeps_rare_shiny_trap() -> None:
    data = load_game_data()
    fallback_ids = {drop["item_id"] for drop in data.tower_config["floor_drops"]}
    assert fallback_ids == {"shiny_trap"}


def test_elite_and_boss_hold_core_affix_materials() -> None:
    data = load_game_data()
    elite = data.tower_config["drops"]["elite"]
    boss = data.tower_config["drops"]["boss"]
    assert "甲核" in elite
    assert "灵晶" in elite
    assert "潮石" not in elite
    assert "潮石" in boss
    assert "深渊灵晶" in boss
