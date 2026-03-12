import random
import unittest

from lobster_cli_roguelike.game import (
    LINEAGES,
    MUTATIONS,
    apply_mutation,
    build_parser,
    build_player,
    check_failure,
    choose_encounter,
    pick_mutations,
)


class GameTests(unittest.TestCase):
    def test_seeded_encounters_are_repeatable(self):
        rng_a = random.Random(7)
        rng_b = random.Random(7)
        seen_a = [choose_encounter(depth, rng_a).key for depth in range(1, 6)]
        seen_b = [choose_encounter(depth, rng_b).key for depth in range(1, 6)]
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

    def test_debug_rolls_flag_is_optional(self):
        args = build_parser().parse_args(["--quick-start", "--debug-rolls"])
        self.assertTrue(args.quick_start)
        self.assertTrue(args.debug_rolls)


if __name__ == "__main__":
    unittest.main()
