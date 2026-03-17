from lobster_cli_tamer.loader import load_game_data, summarize_game_data


def test_load_game_data_counts() -> None:
    summary = summarize_game_data()
    assert summary["species"] >= 100
    assert summary["skills"] >= 550
    assert summary["affixes"] >= 100
    assert summary["zones"] >= 7
    assert summary["items"] >= 3


def test_cross_refs_and_bosses() -> None:
    data = load_game_data()
    assert len(data.tower_config.get("bosses", [])) >= 3
    for zone in data.zones.values():
        for sub in zone["sub_areas"]:
            for entry in sub["encounter_table"]:
                assert entry["species_id"] in data.species
