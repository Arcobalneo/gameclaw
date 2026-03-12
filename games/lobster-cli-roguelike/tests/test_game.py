import random
import tempfile
import unittest
from pathlib import Path

from lobster_cli_roguelike.game import (
    LINEAGES,
    MUTATIONS,
    apply_mutation,
    begin_memory_run,
    build_parser,
    build_player,
    check_failure,
    choose_encounter,
    ensure_memory_profile,
    load_memory_store,
    memory_bonus_for_action,
    pick_mutations,
    record_memory_outcome,
    save_memory_store,
)


class GameTests(unittest.TestCase):
    def test_seeded_encounters_are_repeatable(self):
        rng_a = random.Random(7)
        rng_b = random.Random(7)
        seen_a = [choose_encounter(depth, rng_a, cycle=2).key for depth in range(1, 6)]
        seen_b = [choose_encounter(depth, rng_b, cycle=2).key for depth in range(1, 6)]
        self.assertEqual(seen_a, seen_b)

    def test_mutation_application_changes_state(self):
        player = build_player(LINEAGES[0])
        shell_before = player.shell
        mutation = next(item for item in MUTATIONS if item.key == "shell")
        note = apply_mutation(player, mutation)
        self.assertGreater(player.shell, shell_before)
        self.assertIn("甲壳", note)
        self.assertIn(mutation.title, player.upgrades)

    def test_failure_reason_is_reported(self):
        player = build_player(LINEAGES[1])
        player.salinity = 0
        self.assertIn("盐度适应", check_failure(player))

    def test_mutation_choices_have_three_options(self):
        choices = pick_mutations(random.Random(12))
        self.assertEqual(len(choices), 3)
        self.assertEqual(len({item.key for item in choices}), 3)

    def test_parser_supports_new_flags(self):
        args = build_parser().parse_args(["--quick-start", "--debug-rolls", "--max-cycles", "2"])
        self.assertTrue(args.quick_start)
        self.assertTrue(args.debug_rolls)
        self.assertEqual(args.max_cycles, 2)

    def test_memory_store_persists_profile(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "memory.json"
            store = load_memory_store(path)
            profile = ensure_memory_profile(store, "tester")
            begin_memory_run(profile, "crusher")
            record_memory_outcome(
                profile,
                encounter_key="eel",
                action_key="3",
                success=True,
                depth=4,
                cycle=1,
            )
            save_memory_store(path, store)
            reloaded = load_memory_store(path)
            saved = reloaded["profiles"]["tester"]
            self.assertEqual(saved["runs"], 1)
            self.assertEqual(saved["encounters"]["eel"]["actions"]["3"]["successes"], 1)

    def test_memory_bonus_grows_from_success_history(self):
        store = {"version": 1, "profiles": {}}
        profile = ensure_memory_profile(store, "tester")
        for _ in range(6):
            record_memory_outcome(
                profile,
                encounter_key="net",
                action_key="2",
                success=True,
                depth=8,
                cycle=2,
            )
        bonus = memory_bonus_for_action(profile, "net", "2")
        self.assertGreaterEqual(bonus, 2)


if __name__ == "__main__":
    unittest.main()
