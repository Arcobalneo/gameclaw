import unittest

from lobster_cli_tower_defense.render import render_compact_view, render_resolution


class RenderTests(unittest.TestCase):
    def test_render_compact_view_keeps_core_sections(self):
        text = render_compact_view(
            title="横着守",
            subtitle="归海侧排一号线",
            header_lines=["Pulse 3", "归海线 6/7"],
            map_rows=["左 L0[.] -> L1[重钳10] -> C[.] -> 海"],
            reserve_lines=["- 后备：剪手(3) ready"],
            forecast_lines=["- 本 pulse 入潮：左【锅沿杂兵】x2"],
            note_lines=["- 左线没稳卡口，别太贪。"],
        )
        self.assertIn("地图", text)
        self.assertIn("待命", text)
        self.assertIn("敌潮预告", text)
        self.assertIn("提醒", text)

    def test_render_resolution_truncates_long_event_lists(self):
        text = render_resolution(title="Pulse 4 结果", events=[f"事件 {index}" for index in range(12)], footer="Pulse 4 后：归海线 6/7", limit=5)
        self.assertIn("另有 7 条细节省略", text)
        self.assertIn("Pulse 4 后：归海线 6/7", text)


if __name__ == "__main__":
    unittest.main()
