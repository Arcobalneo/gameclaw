import random
import unittest

from lobster_cli_roguelike.game import (
    EEL,
    LINEAGES,
    MUTATIONS,
    Action,
    Outcome,
    apply_mutation,
    build_memory_note,
    build_parser,
    build_player,
    check_failure,
    choose_encounter,
    pick_mutations,
    push_run_note,
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

    def test_parser_supports_endless_and_verbose_flags(self):
        args = build_parser().parse_args(["--quick-start", "--debug-rolls", "--max-cycles", "2", "--verbose-text"])
        self.assertTrue(args.quick_start)
        self.assertTrue(args.debug_rolls)
        self.assertEqual(args.max_cycles, 2)
        self.assertTrue(args.verbose_text)

    def test_memory_note_is_text_prompt_not_store(self):
        action = Action(key="2", title="绕后偷袭", blurb="", resolver=lambda player, rng: Outcome(True, ""))
        note = build_memory_note(EEL, action, Outcome(success=False, message="", deltas={"energy": -2, "shell": -1}))
        self.assertIn("记进 memory", note)
        self.assertIn("绕后偷袭", note)
        self.assertIn("能量 -2", note)

    def test_push_run_note_keeps_recent_unique_notes(self):
        notes = ["a", "b", "c"]
        push_run_note(notes, "b", limit=3)
        push_run_note(notes, "d", limit=3)
        self.assertEqual(notes, ["c", "b", "d"])


if __name__ == "__main__":
    unittest.main()
