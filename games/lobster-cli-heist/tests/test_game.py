import contextlib
import io
import unittest

from lobster_cli_heist.content import build_mission
from lobster_cli_heist.game import build_parser, menu_loop
from lobster_cli_heist.simulation import build_game_state, take_action
from lobster_cli_heist.content import profile_by_index


class GameTests(unittest.TestCase):
    def test_seeded_mission_is_repeatable(self):
        mission_a = build_mission(7)
        mission_b = build_mission(7)
        self.assertEqual(mission_a.title, mission_b.title)
        self.assertEqual(mission_a.true_objective_site, mission_b.true_objective_site)
        self.assertEqual(mission_a.complication.title, mission_b.complication.title)

    def test_parser_supports_profile_and_flags(self):
        args = build_parser().parse_args([
            "--quick-start",
            "--profile",
            "2",
            "--seed",
            "7",
            "--verbose-text",
            "--no-settlement-report",
            "--observer-port-start",
            "8100",
        ])
        self.assertTrue(args.quick_start)
        self.assertEqual(args.profile, 2)
        self.assertEqual(args.seed, 7)
        self.assertTrue(args.verbose_text)
        self.assertFalse(args.settlement_report)
        self.assertEqual(args.observer_port_start, 8100)

    def test_pickup_starts_lockdown(self):
        state = build_game_state(7, profile_by_index(1))
        state.position = state.mission.true_objective_site
        result = take_action(state, "interact", "candidate")
        self.assertFalse(result.ended)
        self.assertTrue(state.carrying)
        self.assertIsNotNone(state.lockdown_timer)
        self.assertGreaterEqual(state.alert, 2)

    def test_scripted_input_exhaustion_ends_without_eoferror(self):
        args = build_parser().parse_args([
            "--quick-start",
            "--seed",
            "7",
            "--profile",
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
        self.assertIn("这不算胜利，也不假装你已经潜出去了", output)
        self.assertNotIn("EOFError", output)


if __name__ == "__main__":
    unittest.main()
