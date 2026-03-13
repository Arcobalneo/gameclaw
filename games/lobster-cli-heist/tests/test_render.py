import unittest

from lobster_cli_heist.render import render_compact_view, render_resolution


class RenderTests(unittest.TestCase):
    def test_render_compact_view_keeps_core_sections(self):
        text = render_compact_view(
            title="横着潜",
            subtitle="Observer：http://127.0.0.1:8000",
            header_lines=["警戒 1", "Exposure 2/9"],
            map_rows=["上 [ Ex] [ Cov]", "下 [LShd] [ Vnt]"],
            threat_lines=["- 巡逻蟹 @ 下4。"],
            forecast_lines=["- 镜头本拍扫 上4 / 上5。"],
            note_lines=["- 先想撤离线。"],
        )
        self.assertIn("设施", text)
        self.assertIn("威胁", text)
        self.assertIn("Forecast", text)
        self.assertIn("提醒", text)

    def test_render_resolution_truncates_long_lists(self):
        text = render_resolution(title="Turn 4 结果", events=[f"事件 {index}" for index in range(12)], footer="警戒 2 | Exposure 5/9", limit=5)
        self.assertIn("另有 7 条细节省略", text)
        self.assertIn("警戒 2 | Exposure 5/9", text)


if __name__ == "__main__":
    unittest.main()
