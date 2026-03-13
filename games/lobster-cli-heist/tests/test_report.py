import tempfile
import unittest

from pathlib import Path

from lobster_cli_heist.report import ObserverPage, SettlementReport, render_observer_html, render_settlement_html, write_settlement_report


class ReportTests(unittest.TestCase):
    def test_live_observer_html_contains_core_sections(self):
        page = ObserverPage(
            title="横着潜",
            subtitle="当前任务：低温挂架 A-12",
            package_line="设施 / 安保 / 目标 / 麻烦",
            status_lines=["警戒 1", "Exposure 2/9"],
            board_rows=["上 [ Ex] [ Cov]", "下 [LShd] [ Vnt]"],
            threat_lines=["巡逻蟹 @ 下4"],
            forecast_lines=["镜头本拍扫 上4 / 上5"],
            recent_events=["你挪到了 上5 候选货格。"],
            footer="observer footer",
        )
        html = render_observer_html(page)
        self.assertIn("Live Observer", html)
        self.assertIn("当前设施视图", html)
        self.assertIn("你挪到了 上5 候选货格", html)

    def test_settlement_report_writes_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = SettlementReport(
                ending="aborted",
                title="龙虾潜行结算",
                seed=17,
                profile_name="藻披影行者",
                mission_name="低温挂架 A-12 · 盐账账本",
                package_line="设施 / 安保 / 目标 / 麻烦",
                turns=4,
                alert=1,
                exposure_peak=3,
                score=6,
                cause="脚本化输入已耗尽。 本轮先在这里收壳：这不算胜利，也不假装你已经潜出去了。",
                final_notes=["本局观察：先想撤离线。"],
                board_rows=["上 [ Ex] [ Cov]", "下 [LShd] [ Vnt]"],
                status_lines=["警戒 1", "Exposure 2/9"],
                key_events=["你挪到了 上5 候选货格。"],
                report_path=Path(tmp) / "settlement_reports" / "report.html",
            )
            html = render_settlement_html(report)
            self.assertIn("本局观察摘记", html)
            path = write_settlement_report(report)
            self.assertTrue(path.exists())
            self.assertIn("龙虾潜行结算", path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
