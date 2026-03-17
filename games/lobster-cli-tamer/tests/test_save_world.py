import pathlib
import tempfile

import lobster_cli_tamer.save as save_mod
from lobster_cli_tamer.capture import apply_capture, encounter
from lobster_cli_tamer.creature import Creature
from lobster_cli_tamer.loader import load_game_data
from lobster_cli_tamer.save import load_save, new_save, write_save
from lobster_cli_tamer.world import WorldSession, check_zone_unlock


def test_save_roundtrip_and_defaults() -> None:
    data = load_game_data()
    old_dir = save_mod.SAVE_DIR
    save_mod.SAVE_DIR = pathlib.Path(tempfile.mkdtemp())
    try:
        save = new_save(0, "测试")
        assert save.current_zone_id == "reef_zone"
        assert save.get_item_count("net_basic") >= 1
        player = Creature.from_species("reef_shrimp", data, level=5)
        player.bind_species_data(data)
        save.party = [player, None, None, None, None, None]
        write_save(save)
        loaded = load_save(0, data)
        assert loaded.player_name == "测试"
        assert loaded.party[0] is not None
        assert loaded.party[0].display_name == "礁虾"
    finally:
        save_mod.SAVE_DIR = old_dir


def test_world_encounter_and_unlock_logic() -> None:
    data = load_game_data()
    save = new_save_for_test(data)
    newly = check_zone_unlock(save, data)
    assert "reef_zone" in save.unlocked_zones
    assert "abyss_gate" in save.unlocked_zones
    assert isinstance(newly, list)

    zone = data.zones["reef_zone"]
    sub = zone["sub_areas"][0]
    ws = WorldSession(zone["id"], sub["id"], save, data)
    seen_any = False
    for _ in range(80):
        events = ws.step()
        if any(ev.data.get("species_id") for ev in events):
            seen_any = True
            break
    assert seen_any


def new_save_for_test(data):
    save = save_mod.SaveSlot(slot=99, player_name="测试")
    player = Creature.from_species("reef_shrimp", data, level=8)
    player.bind_species_data(data)
    player.moves = ["潮击1"]
    save.party = [player, None, None, None, None, None]
    return save
