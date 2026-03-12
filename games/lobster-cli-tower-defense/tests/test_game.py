import contextlib
import io
import unittest

from lobster_cli_tower_defense.content import DOCTRINES, UNITS, build_wave_plan
from lobster_cli_tower_defense.game import (
    build_forecast_lines,
    build_game_state,
    build_parser,
    menu_loop,
    unit_max_hp,
)


class GameTests(unittest.TestCase):
    def test_seeded_wave_plan_is_repeatable(self):
        plan_a = [[(item.lane, item.enemy_key, item.count) for item in pulse] for pulse in build_wave_plan(7)]
        plan_b = [[(item.lane, item.enemy_key, item.count) for item in pulse] for pulse in build_wave_plan(7)]
        self.assertEqual(plan_a, plan_b)

    def test_crusher_blockers_gain_bonus_hp(self):
        doctrine = DOCTRINES[0]
        self.assertEqual(unit_max_hp(doctrine, "reef-guard"), UNITS["reef-guard"].max_hp + 2)
        self.assertEqual(unit_max_hp(doctrine, "ring-cutter"), UNITS["ring-cutter"].max_hp)

    def test_oracle_forecast_shows_three_windows(self):
        state = build_game_state(11, DOCTRINES[1])
        lines = build_forecast_lines(state)
        self.assertEqual(len(lines), 3)
        self.assertIn("再下 pulse", lines[2])

    def test_parser_supports_lineage_alias_and_settlement_flag(self):
        args = build_parser().parse_args(["--quick-start", "--lineage", "2", "--seed", "7", "--verbose-text", "--no-settlement-report"])
        self.assertTrue(args.quick_start)
        self.assertEqual(args.doctrine, 2)
        self.assertEqual(args.seed, 7)
        self.assertTrue(args.verbose_text)
        self.assertFalse(args.settlement_report)

    def test_scripted_input_exhaustion_ends_without_eoferror(self):
        args = build_parser().parse_args([
            "--quick-start",
            "--seed",
            "7",
            "--doctrine",
            "1",
            "--script",
            "1,1,1",
            "--no-settlement-report",
        ])
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            exit_code = menu_loop(args)
        output = buffer.getvalue()
        self.assertEqual(exit_code, 0)
        self.assertIn("脚本化输入已耗尽", output)
        self.assertIn("这不算胜利，也不假装你已经守住了", output)
        self.assertNotIn("EOFError", output)


if __name__ == "__main__":
    unittest.main()
