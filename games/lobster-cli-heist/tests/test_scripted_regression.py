import contextlib
import io
import unittest

from lobster_cli_heist.game import build_parser, menu_loop


def run_scripted_game(*args: str) -> tuple[int, str]:
    parser = build_parser()
    buffer = io.StringIO()
    with contextlib.redirect_stdout(buffer):
        exit_code = menu_loop(parser.parse_args([*args, "--no-settlement-report", "--observer-port-start", "8500"]))
    return exit_code, buffer.getvalue()


class ScriptedRegressionTests(unittest.TestCase):
    def assert_contains_in_order(self, output: str, fragments: list[str]) -> None:
        cursor = 0
        for fragment in fragments:
            index = output.find(fragment, cursor)
            self.assertNotEqual(index, -1, f"missing fragment: {fragment!r}\n--- output ---\n{output}")
            cursor = index + len(fragment)

    def test_shade_scripted_baseline(self):
        exit_code, output = run_scripted_game(
            "--quick-start",
            "--seed",
            "7",
            "--profile",
            "1",
            "--script",
            "1,1,2,4,1,1,2",
        )
        self.assertEqual(exit_code, 0)
        self.assert_contains_in_order(
            output,
            [
                "Profile> 1 [preset]",
                "Live observer: http://127.0.0.1:8500",
                "Action> 1 [script]",
                "Turn 1 结果",
                "脚本化输入已耗尽",
            ],
        )

    def test_breaker_scripted_baseline(self):
        exit_code, output = run_scripted_game(
            "--quick-start",
            "--seed",
            "11",
            "--profile",
            "2",
            "--script",
            "4,1,1,1,5,1,1,1",
        )
        self.assertEqual(exit_code, 0)
        self.assert_contains_in_order(
            output,
            [
                "Profile> 2 [preset]",
                "Live observer: http://127.0.0.1:8500",
                "Turn 1 结果",
                "脚本化输入已耗尽",
            ],
        )

    def test_runner_scripted_baseline(self):
        exit_code, output = run_scripted_game(
            "--quick-start",
            "--seed",
            "23",
            "--profile",
            "3",
            "--script",
            "1,1,5,1,1,2,1,1",
        )
        self.assertEqual(exit_code, 0)
        self.assert_contains_in_order(
            output,
            [
                "Profile> 3 [preset]",
                "Live observer: http://127.0.0.1:8500",
                "Turn 1 结果",
                "脚本化输入已耗尽",
            ],
        )


if __name__ == "__main__":
    unittest.main()
