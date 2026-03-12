import contextlib
import io
import random
import unittest

from pathlib import Path
import tempfile

from lobster_cli_roguelike.game import (
    EEL,
    LINEAGES,
    MUTATIONS,
    Action,
    Outcome,
    SettlementReport,
    apply_deltas,
    apply_mutation,
    build_memory_note,
    build_mutation_note,
    build_parser,
    build_player,
    check_failure,
    choose_encounter,
    contest,
    format_build_summary,
    menu_loop,
    pick_mutations,
    push_run_note,
    render_settlement_html,
    write_settlement_report,
)


class GameTests(unittest.TestCase):
    def test_seeded_encounters_are_repeatable(self):
        rng_a = random.Random(7)
        rng_b = random.Random(7)
        seen_a = [choose_encounter(depth, rng_a, cycle=2).key for depth in range(1, 6)]
        seen_b = [choose_encounter(depth, rng_b, cycle=2).key for depth in range(1, 6)]
        self.assertEqual(seen_a, seen_b)

    def test_choose_encounter_avoids_recent_repeats_when_possible(self):
        encounter = choose_encounter(5, random.Random(9), cycle=2, recent_keys=["plastic", "eel"])
        self.assertNotIn(encounter.key, {"plastic", "eel"})

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

    def test_parser_supports_endless_verbose_and_settlement_flags(self):
        args = build_parser().parse_args(["--quick-start", "--debug-rolls", "--max-cycles", "2", "--verbose-text", "--no-settlement-report"])
        self.assertTrue(args.quick_start)
        self.assertTrue(args.debug_rolls)
        self.assertEqual(args.max_cycles, 2)
        self.assertTrue(args.verbose_text)
        self.assertFalse(args.settlement_report)

    def test_memory_note_is_text_prompt_not_store(self):
        action = Action(key="2", title="绕后偷袭", blurb="", resolver=lambda player, rng: Outcome(True, ""))
        note = build_memory_note(EEL, action, Outcome(success=False, message="", deltas={"energy": -2, "shell": -1}))
        self.assertIn("本局观察", note)
        self.assertIn("绕后偷袭", note)
        self.assertIn("能量 -2", note)
        self.assertIn("再验证", note)

    def test_mutation_note_and_build_summary_reflect_current_build(self):
        player = build_player(LINEAGES[0])
        mutation = next(item for item in MUTATIONS if item.key == "dash")
        result = apply_mutation(player, mutation)
        note = build_mutation_note(mutation, result)
        self.assertIn("build 观察", note)
        self.assertIn(mutation.title, note)
        self.assertEqual(format_build_summary(player), mutation.title)

    def test_push_run_note_keeps_recent_unique_notes(self):
        notes = ["a", "b", "c"]
        push_run_note(notes, "b", limit=3)
        push_run_note(notes, "d", limit=3)
        self.assertEqual(notes, ["c", "b", "d"])

    def test_tide_builds_from_setup_and_spends_on_commit(self):
        player = build_player(LINEAGES[1])
        opener = contest(
            player,
            random.Random(1),
            base=player.sense + player.salinity,
            difficulty=2,
            tags=("sense", "dash"),
            success_text="",
            fail_text="",
        )
        apply_deltas(player, opener.deltas)
        self.assertEqual(player.tide, 1)

        finisher = contest(
            player,
            random.Random(1),
            base=player.left_claw,
            difficulty=99,
            tags=("crush",),
            success_text="",
            fail_text="",
        )
        self.assertEqual(finisher.deltas.get("tide"), -1)

    def test_settlement_html_is_clean_report_without_agent_prompt_block(self):
        report = SettlementReport(
            ending="won",
            title="龙虾成功回海结算",
            seed=7,
            lineage_name="沟壑碎壳者",
            cycle=1,
            depth=10,
            score=12,
            status_line="壳 7 | 能 5 | 盐 4 | 左 4 | 右 2 | 须 2 | 蜕 1",
            cause="你在约定的 1 个潮段后收壳记事。",
            final_notes=["记进 memory 的本局观察：在【归海闸口】里试了 2号剪断塑料环，这次成了，结果 能量 -1，龙虾名声 +4；下局最好再验证一次。"],
            report_path=Path("settlement_reports/demo.html"),
        )
        html = render_settlement_html(report)
        self.assertIn("本局观察摘记", html)
        self.assertIn("沟壑碎壳者", html)
        self.assertNotIn("给主人 review", html)
        self.assertNotIn("给玩家 agent 的提示", html)

    def test_aborted_settlement_html_uses_neutral_copy(self):
        report = SettlementReport(
            ending="aborted",
            title="龙虾中止结算",
            seed=17,
            lineage_name="脱壳赌徒",
            cycle=1,
            depth=2,
            score=2,
            status_line="壳 4 | 能 5 | 盐 4 | 左 3 | 右 3 | 须 3 | 蜕 2 | 势 1",
            cause="脚本化输入已耗尽。 本轮先在这里收壳：这不算胜利，也不假装你已经死了。",
            final_notes=["记进 memory 的本局观察：先读潮再出手。"],
            report_path=Path("settlement_reports/demo-aborted.html"),
        )
        html = render_settlement_html(report)
        self.assertIn("中止收壳", html)
        self.assertIn("龙虾中止结算", html)

    def test_write_settlement_report_writes_html_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = SettlementReport(
                ending="lost",
                title="龙虾阵亡结算",
                seed=11,
                lineage_name="触须预言家",
                cycle=2,
                depth=13,
                score=9,
                status_line="壳 0 | 能 2 | 盐 4 | 左 2 | 右 3 | 须 4 | 蜕 1",
                cause="你死了。壳强度归零：你被这个世界连壳带脾气一起敲开了。",
                final_notes=["记进 memory 的本局观察：在【拖网阴影】里试了 1号右钳剪网，这次没成，结果 壳强度 -1，能量 -2；下局最好再验证一次。"],
                report_path=Path(tmp) / "settlement_reports" / "report.html",
            )
            path = write_settlement_report(report)
            self.assertTrue(path.exists())
            text = path.read_text(encoding="utf-8")
            self.assertIn("龙虾阵亡结算", text)
            self.assertNotIn("给主人 review", text)
            self.assertIn("本局观察摘记", text)

    def test_scripted_input_exhaustion_ends_without_eoferror(self):
        args = build_parser().parse_args([
            "--quick-start",
            "--seed",
            "7",
            "--lineage",
            "1",
            "--script",
            "1",
            "--no-settlement-report",
        ])
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            exit_code = menu_loop(args)
        output = buffer.getvalue()
        self.assertEqual(exit_code, 0)
        self.assertIn("脚本化输入已耗尽", output)
        self.assertIn("这不算胜利，也不假装你已经死了", output)
        self.assertNotIn("EOFError", output)


if __name__ == "__main__":
    unittest.main()
