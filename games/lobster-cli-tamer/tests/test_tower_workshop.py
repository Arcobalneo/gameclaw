from lobster_cli_tamer.affixes import roll_affix_slots
from lobster_cli_tamer.creature import Creature
from lobster_cli_tamer.loader import load_game_data
from lobster_cli_tamer.save import SaveSlot
from lobster_cli_tamer.tower import FloorType, TowerSession, classify_floor
from lobster_cli_tamer.workshop import reroll, seal, unseal, upgrade
from lobster_cli_tamer.combat import BattleAction, ActionType, BattleState, BattleResult, Combatant


def _make_save(data):
    save = SaveSlot(slot=77, player_name="测试")
    c = Creature.from_species("reef_shrimp", data, level=20)
    c.bind_species_data(data)
    c.moves = ["潮击1", "防御姿态1", "蜕壳1"]
    for i, aff in enumerate(roll_affix_slots(len(c.affix_slots), data)):
        c.affix_slots[i].affix_id = aff["id"]
    save.party = [c, None, None, None, None, None]
    save.add_item("jihe_core", 50)
    save.add_item("spirit_crystal", 50)
    save.add_item("tide_stone", 50)
    return save, c


def test_workshop_core_flow() -> None:
    data = load_game_data()
    save, c = _make_save(data)
    first = c.affix_slots[0].affix_id
    assert reroll(c, 0, save, data).success
    assert c.affix_slots[0].affix_id != ""
    assert upgrade(c, 0, save, data).success
    assert seal(c, 0, save, data).success
    assert not reroll(c, 0, save, data).success
    assert unseal(c, 0, save, data).success


def test_tower_floor_progression() -> None:
    data = load_game_data()
    save, _ = _make_save(data)
    assert classify_floor(1) == FloorType.NORMAL
    assert classify_floor(4) == FloorType.ELITE
    assert classify_floor(10) == FloorType.BOSS

    tower = TowerSession(save, data)
    evts = tower.enter_next_floor()
    assert tower.floor == 1
    assert tower.is_in_battle()
    for _ in range(50):
        if not tower.is_in_battle():
            break
        tower.battle_turn(BattleAction(action_type=ActionType.USE_SKILL, skill_name="潮击1"))
    assert save.deepest_abyss_floor >= 0


def test_tower_taint_converts_to_plague_on_third_normal_clear() -> None:
    data = load_game_data()
    save, c = _make_save(data)
    tower = TowerSession(save, data)
    tower._floor_type = FloorType.NORMAL

    for expected in (1, 2):
        events = tower._apply_abyss_taint()
        assert c.abyss_taint == expected
        assert c.has_plague is False
        assert any("深渊污染" in ev.message for ev in events)

    events = tower._apply_abyss_taint()
    assert c.abyss_taint == 0
    assert c.has_plague is True
    assert c.plague_floors == 3
    assert any("转化为疫病" in ev.message for ev in events)


def test_tower_plague_pressure_scales_by_floor_type() -> None:
    data = load_game_data()
    save, c = _make_save(data)
    c.apply_plague(3)
    tower = TowerSession(save, data)

    tower._floor_type = FloorType.NORMAL
    tower._apply_abyss_taint()
    assert c.plague_floors == 4

    tower._floor_type = FloorType.ELITE
    tower._apply_abyss_taint()
    assert c.plague_floors == 6

    tower._floor_type = FloorType.BOSS
    tower._apply_abyss_taint()
    assert c.plague_floors == 9


def test_tower_retreat_preserves_taint_and_cure_clears_it() -> None:
    data = load_game_data()
    save, c = _make_save(data)
    c.abyss_taint = 2
    tower = TowerSession(save, data)

    events = tower._settle_plague()
    assert c.abyss_taint == 2
    assert any("带着深渊污染离开" in ev.message for ev in events)

    c.cure_plague()
    assert c.has_plague is False
    assert c.plague_floors == 0
    assert c.abyss_taint == 0
