from __future__ import annotations

import html

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


@dataclass
class SettlementReport:
    ending: str
    title: str
    seed: int
    doctrine_name: str
    stage_name: str
    pulse_reached: int
    integrity: int
    max_integrity: int
    leaks: int
    score: int
    status_line: str
    cause: str
    final_notes: list[str]
    report_path: Path


def slugify_text(value: str) -> str:
    lowered = value.lower()
    chars: list[str] = []
    prev_dash = False
    for ch in lowered:
        if ch.isascii() and ch.isalnum():
            chars.append(ch)
            prev_dash = False
        else:
            if not prev_dash:
                chars.append("-")
                prev_dash = True
    slug = "".join(chars).strip("-")
    return slug or "lobster-defense"


def settlement_reports_dir() -> Path:
    return Path.cwd() / "settlement_reports"


def settlement_report_path(doctrine_key: str, seed: int, *, ending: str, pulse_reached: int) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    outcome = {
        "won": "held",
        "lost": "breached",
        "aborted": "interrupted",
    }[ending]
    filename = f"lobster-defense-{slugify_text(doctrine_key)}-seed{seed}-pulse{pulse_reached}-{outcome}-{stamp}.html"
    return settlement_reports_dir() / filename


def render_settlement_html(report: SettlementReport) -> str:
    if report.ending == "won":
        badge = "守住归海线"
        accent = "#4ecdc4"
    elif report.ending == "aborted":
        badge = "中止收壳"
        accent = "#ffd166"
    else:
        badge = "归海线失守"
        accent = "#ff6b6b"
    note_items = "".join(f"<li>{html.escape(note)}</li>" for note in report.final_notes)
    if not note_items:
        note_items = "<li>这轮没有提炼出稳定结论，但你仍然可以回头看最先崩掉的卡口。</li>"
    return f"""<!DOCTYPE html>
<html lang=\"zh-CN\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>{html.escape(report.title)}</title>
  <style>
    :root {{
      color-scheme: dark;
      --bg: #07131f;
      --panel: #0d2031;
      --panel-2: #11283b;
      --text: #ebf4ff;
      --muted: #9bb3c9;
      --accent: {accent};
      --line: rgba(255,255,255,0.08);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;
      background: radial-gradient(circle at top, #12314a 0%, var(--bg) 55%);
      color: var(--text);
      padding: 32px 18px 48px;
    }}
    .card {{
      max-width: 920px;
      margin: 0 auto;
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.35);
    }}
    .eyebrow {{ color: var(--accent); font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }}
    h1 {{ margin: 10px 0 8px; font-size: 34px; line-height: 1.15; }}
    .lead {{ color: var(--muted); font-size: 16px; line-height: 1.65; margin-bottom: 24px; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 22px 0 26px; }}
    .stat {{ background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 14px 16px; }}
    .stat .label {{ color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }}
    .stat .value {{ font-size: 20px; margin-top: 6px; font-weight: 700; }}
    .panel {{ background: var(--panel-2); border: 1px solid var(--line); border-radius: 18px; padding: 18px; margin-top: 16px; }}
    .panel h2 {{ margin: 0 0 12px; font-size: 18px; }}
    .panel p, .panel li {{ color: var(--text); line-height: 1.7; }}
    ul {{ margin: 0; padding-left: 20px; }}
    .footer {{ margin-top: 20px; color: var(--muted); font-size: 13px; }}
  </style>
</head>
<body>
  <main class=\"card\">
    <div class=\"eyebrow\">GameClaw · Settlement Report</div>
    <h1>{html.escape(report.title)}</h1>
    <p class=\"lead\">{html.escape(report.cause)}</p>

    <section class=\"grid\">
      <div class=\"stat\"><div class=\"label\">结局</div><div class=\"value\">{html.escape(badge)}</div></div>
      <div class=\"stat\"><div class=\"label\">Doctrine</div><div class=\"value\">{html.escape(report.doctrine_name)}</div></div>
      <div class=\"stat\"><div class=\"label\">关卡</div><div class=\"value\">{html.escape(report.stage_name)}</div></div>
      <div class=\"stat\"><div class=\"label\">Pulse</div><div class=\"value\">{report.pulse_reached}</div></div>
      <div class=\"stat\"><div class=\"label\">完整度</div><div class=\"value\">{report.integrity}/{report.max_integrity}</div></div>
      <div class=\"stat\"><div class=\"label\">漏网</div><div class=\"value\">{report.leaks}</div></div>
      <div class=\"stat\"><div class=\"label\">战绩</div><div class=\"value\">{report.score}</div></div>
      <div class=\"stat\"><div class=\"label\">种子</div><div class=\"value\">{report.seed}</div></div>
    </section>

    <section class=\"panel\">
      <h2>最终状态</h2>
      <p>{html.escape(report.status_line)}</p>
    </section>

    <section class=\"panel\">
      <h2>本局观察摘记</h2>
      <ul>{note_items}</ul>
    </section>

    <div class=\"footer\">Generated by lobster-cli-tower-defense · {html.escape(report.report_path.name)}</div>
  </main>
</body>
</html>
"""


def write_settlement_report(report: SettlementReport) -> Path:
    report.report_path.parent.mkdir(parents=True, exist_ok=True)
    report.report_path.write_text(render_settlement_html(report), encoding="utf-8")
    return report.report_path
