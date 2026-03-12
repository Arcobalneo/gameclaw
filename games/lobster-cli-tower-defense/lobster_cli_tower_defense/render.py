from __future__ import annotations


def render_compact_view(
    *,
    title: str,
    subtitle: str,
    header_lines: list[str],
    map_rows: list[str],
    reserve_lines: list[str],
    forecast_lines: list[str],
    note_lines: list[str],
) -> str:
    chunks = [title, subtitle]
    chunks.extend(header_lines)
    chunks.append("")
    chunks.append("地图")
    chunks.extend(map_rows)
    if reserve_lines:
        chunks.append("")
        chunks.append("待命")
        chunks.extend(reserve_lines)
    if forecast_lines:
        chunks.append("")
        chunks.append("敌潮预告")
        chunks.extend(forecast_lines)
    if note_lines:
        chunks.append("")
        chunks.append("提醒")
        chunks.extend(note_lines)
    return "\n".join(chunks)


def render_resolution(*, title: str, events: list[str], footer: str, limit: int = 10) -> str:
    visible = events[:limit]
    hidden = len(events) - len(visible)
    lines = [title]
    lines.extend(f"- {event}" for event in visible)
    if hidden > 0:
        lines.append(f"- 另有 {hidden} 条细节省略。")
    lines.append(footer)
    return "\n".join(lines)
