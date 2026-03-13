from __future__ import annotations

from typing import Sequence

WRAP_WIDTH = 86


def render_compact_view(
    *,
    title: str,
    subtitle: str,
    header_lines: Sequence[str],
    map_rows: Sequence[str],
    threat_lines: Sequence[str],
    forecast_lines: Sequence[str],
    note_lines: Sequence[str],
) -> str:
    lines: list[str] = [title, subtitle, ""]
    lines.extend(header_lines)
    lines.append("")
    lines.append("设施")
    lines.extend(map_rows)
    lines.append("")
    lines.append("威胁")
    lines.extend(threat_lines or ["- 暂时没有已确认的威胁。"])
    lines.append("")
    lines.append("Forecast")
    lines.extend(forecast_lines or ["- 还没有额外 forecast。"])
    lines.append("")
    lines.append("提醒")
    lines.extend(note_lines or ["- 先想撤离线。"])
    return "\n".join(lines)


def render_resolution(*, title: str, events: Sequence[str], footer: str, limit: int = 8) -> str:
    lines = [title]
    shown = list(events[:limit])
    lines.extend(f"- {line}" for line in shown)
    if len(events) > limit:
        lines.append(f"- 另有 {len(events) - limit} 条细节省略。")
    lines.append(footer)
    return "\n".join(lines)
