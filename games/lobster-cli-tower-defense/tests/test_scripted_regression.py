import contextlib
import io
import unittest

from lobster_cli_tower_defense.game import build_parser, menu_loop


def run_scripted_game(*args: str) -> tuple[int, str]:
    parser = build_parser()
    buffer = io.StringIO()
    with contextlib.redirect_stdout(buffer):
        exit_code = menu_loop(parser.parse_args([*args, "--no-settlement-report"]))
    return exit_code, buffer.getvalue()


class ScriptedRegressionTests(unittest.TestCase):
    def assert_contains_in_order(self, output: str, fragments: list[str]) -> None:
        cursor = 0
        for fragment in fragments:
            index = output.find(fragment, cursor)
            self.assertNotEqual(index, -1, f"missing fragment: {fragment!r}\n--- output ---\n{output}")
            cursor = index + len(fragment)

    def test_oracle_scripted_opening_baseline(self):
        exit_code, output = run_scripted_game(
            "--quick-start",
            "--seed",
            "7",
            "--doctrine",
            "2",
            "--script",
            "1,3,5,0,3,2",
        )

        self.assertEqual(exit_code, 0)
        self.assert_contains_in_order(
            output,
            [
                "Doctrine> 2 [preset]",
                "【须探哨兵】入位 LP。",
                "你发动了【触须预警】，目标：中排缝。",
                "Pulse 1 结果",
                "- 中排缝被【触须预警】点亮：2 个目标更慢、更脆。",
                "- LP 须哨 -> 【锅沿杂兵】 3。",
                "脚本化输入已耗尽。",
            ],
        )

    def test_crusher_scripted_skill_window_baseline(self):
        exit_code, output = run_scripted_game(
            "--quick-start",
            "--seed",
            "7",
            "--doctrine",
            "1",
            "--script",
            "1,1,2,0,0,3,1",
        )

        self.assertEqual(exit_code, 0)
        self.assert_contains_in_order(
            output,
            [
                "Doctrine> 1 [preset]",
                "【礁口重钳】入位 M1。",
                "你发动了【碎壳顶潮】，目标：礁口重钳@M1。",
                "Pulse 2 结果",
                "- M1 重钳 -> 【锅沿杂兵】 5。",
                "- M1 重钳 收壳了【锅沿杂兵】。",
                "脚本化输入已耗尽。",
            ],
        )

    def test_gambler_scripted_swap_answers_side_runner(self):
        exit_code, output = run_scripted_game(
            "--quick-start",
            "--seed",
            "7",
            "--doctrine",
            "3",
            "--script",
            "1,2,5,0,0,3,1,5",
        )

        self.assertEqual(exit_code, 0)
        self.assert_contains_in_order(
            output,
            [
                "Doctrine> 3 [preset]",
                "【塑圈剪手】入位 LP。",
                "你发动了【脱壳换线】，目标：塑圈剪手 -> RP。",
                "Pulse 2 结果",
                "- RP 剪手 -> 【抽水跳虾】 3。",
                "高  LP[.] | RP[剪手6]",
                "脚本化输入已耗尽。",
            ],
        )


if __name__ == "__main__":
    unittest.main()
