import tempfile
import unittest

from pathlib import Path

from lobster_cli_tower_defense.report import SettlementReport, render_settlement_html, write_settlement_report


class ReportTests(unittest.TestCase):
    def test_report_html_is_clean_and_memory_first(self):
        report = SettlementReport(
            ending="won",
            title="龙虾防线成功结算",
            seed=7,
            doctrine_name="沟壑碎壳者",
            stage_name="归海侧排一号线",
            pulse_reached=10,
            integrity=6,
            max_integrity=8,
            leaks=2,
            score=24,
            status_line="归海线 6/8 | 潮令 2 | 漏 2 | Pulse 10/10 | 收壳 24",
            cause="你把这条归海侧排线守到了最后一 pulse。",
            final_notes=["记进 memory 的本局观察：C 位别空太久；下局再验证。"],
            report_path=Path("settlement_reports/demo.html"),
        )
        html = render_settlement_html(report)
        self.assertIn("本局观察摘记", html)
        self.assertIn("沟壑碎壳者", html)
        self.assertNotIn("给主人 review", html)

    def test_write_settlement_report_writes_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = SettlementReport(
                ending="aborted",
                title="龙虾防线中止结算",
                seed=17,
                doctrine_name="脱壳赌徒",
                stage_name="归海侧排一号线",
                pulse_reached=3,
                integrity=7,
                max_integrity=7,
                leaks=0,
                score=6,
                status_line="归海线 7/7 | 潮令 4 | 漏 0 | Pulse 3/10 | 收壳 6",
                cause="脚本化输入已耗尽。 本轮先在这里收壳：这不算胜利，也不假装你已经守住了。",
                final_notes=["记进 memory 的本局观察：setup 先保 C 位。"],
                report_path=Path(tmp) / "settlement_reports" / "report.html",
            )
            path = write_settlement_report(report)
            self.assertTrue(path.exists())
            text = path.read_text(encoding="utf-8")
            self.assertIn("龙虾防线中止结算", text)
            self.assertIn("中止收壳", text)


if __name__ == "__main__":
    unittest.main()
