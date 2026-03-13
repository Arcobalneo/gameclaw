from __future__ import annotations

import html

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence


@dataclass
class ObserverPage:
    title: str
    subtitle: str
    package_line: str
    status_lines: list[str]
    board_rows: list[str]
    threat_lines: list[str]
    forecast_lines: list[str]
    recent_events: list[str]
    footer: str


@dataclass
class SettlementReport:
    ending: str
    title: str
    seed: int
    profile_name: str
    mission_name: str
    package_line: str
    turns: int
    alert: int
    exposure_peak: int
    score: int
    cause: str
    final_notes: list[str]
    board_rows: list[str]
    status_lines: list[str]
    key_events: list[str]
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
    return slug or "lobster-heist"


def settlement_reports_dir() -> Path:
    return Path.cwd() / "settlement_reports"


def settlement_report_path(profile_key: str, seed: int, *, ending: str, turns: int) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    outcome = {
        "won": "escaped",
        "lost": "boxed",
        "aborted": "interrupted",
    }[ending]
    filename = f"lobster-heist-{slugify_text(profile_key)}-seed{seed}-turn{turns}-{outcome}-{stamp}.html"
    return settlement_reports_dir() / filename


def render_observer_html(page: ObserverPage, *, auto_refresh: bool = True) -> str:
    refresh_tag = '<meta http-equiv="refresh" content="1" />' if auto_refresh else ""
    status_items = "".join(f"<li>{html.escape(line)}</li>" for line in page.status_lines)
    threat_items = "".join(f"<li>{html.escape(line)}</li>" for line in page.threat_lines)
    forecast_items = "".join(f"<li>{html.escape(line)}</li>" for line in page.forecast_lines)
    event_items = "".join(f"<li>{html.escape(line)}</li>" for line in page.recent_events)
    board_html = "\n".join(html.escape(line) for line in page.board_rows)
    return f"""<!DOCTYPE html>
<html lang=\"zh-CN\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  {refresh_tag}
  <title>{html.escape(page.title)}</title>
  <style>
    :root {{
      color-scheme: dark;
      --bg: #07131f;
      --panel: #0d2031;
      --panel-2: #11283b;
      --text: #ebf4ff;
      --muted: #9bb3c9;
      --accent: #7ae582;
      --line: rgba(255,255,255,0.08);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;
      background: radial-gradient(circle at top, #16324f 0%, var(--bg) 55%);
      color: var(--text);
      padding: 24px 16px 36px;
    }}
    .card {{
      max-width: 1100px;
      margin: 0 auto;
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.35);
    }}
    .eyebrow {{ color: var(--accent); font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }}
    h1 {{ margin: 10px 0 8px; font-size: 32px; line-height: 1.15; }}
    .lead {{ color: var(--muted); font-size: 15px; line-height: 1.65; margin-bottom: 20px; }}
    .grid {{ display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; }}
    .panel {{ background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 18px; }}
    .panel h2 {{ margin: 0 0 10px; font-size: 18px; }}
    .panel ul {{ margin: 0; padding-left: 20px; }}
    .panel li {{ line-height: 1.65; }}
    pre {{ margin: 0; white-space: pre-wrap; line-height: 1.5; font-size: 14px; }}
    .footer {{ margin-top: 18px; color: var(--muted); font-size: 13px; }}
  </style>
</head>
<body>
  <main class=\"card\">
    <div class=\"eyebrow\">GameClaw · Live Observer</div>
    <h1>{html.escape(page.title)}</h1>
    <p class=\"lead\">{html.escape(page.subtitle)}<br />{html.escape(page.package_line)}</p>
    <div class=\"grid\">
      <section class=\"panel\">
        <h2>当前设施视图</h2>
        <pre>{board_html}</pre>
      </section>
      <section class=\"panel\">
        <h2>状态</h2>
        <ul>{status_items}</ul>
      </section>
      <section class=\"panel\">
        <h2>威胁</h2>
        <ul>{threat_items}</ul>
      </section>
      <section class=\"panel\">
        <h2>Forecast</h2>
        <ul>{forecast_items}</ul>
      </section>
    </div>
    <section class=\"panel\" style=\"margin-top: 16px;\">
      <h2>最近事件</h2>
      <ul>{event_items}</ul>
    </section>
    <div class=\"footer\">{html.escape(page.footer)}</div>
  </main>
</body>
</html>
"""


def render_settlement_html(report: SettlementReport) -> str:
    if report.ending == "won":
        badge = "带货撤离成功"
        accent = "#4ecdc4"
    elif report.ending == "aborted":
        badge = "中止收壳"
        accent = "#ffd166"
    else:
        badge = "被设施装箱"
        accent = "#ff6b6b"
    note_items = "".join(f"<li>{html.escape(note)}</li>" for note in report.final_notes)
    if not note_items:
        note_items = "<li>这轮没提炼出稳定结论，但你仍然可以回头看最先崩掉的那一格。</li>"
    event_items = "".join(f"<li>{html.escape(line)}</li>" for line in report.key_events)
    if not event_items:
        event_items = "<li>这轮没有留下额外关键事件。</li>"
    board_html = "\n".join(html.escape(line) for line in report.board_rows)
    status_items = "".join(f"<li>{html.escape(line)}</li>" for line in report.status_lines)
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
      max-width: 1100px;
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
    .columns {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }}
    .panel {{ background: var(--panel-2); border: 1px solid var(--line); border-radius: 18px; padding: 18px; }}
    .panel h2 {{ margin: 0 0 12px; font-size: 18px; }}
    .panel p, .panel li {{ color: var(--text); line-height: 1.7; }}
    ul {{ margin: 0; padding-left: 20px; }}
    pre {{ margin: 0; white-space: pre-wrap; line-height: 1.5; font-size: 14px; }}
    .footer {{ margin-top: 20px; color: var(--muted); font-size: 13px; }}
  </style>
</head>
<body>
  <main class=\"card\">
    <div class=\"eyebrow\">GameClaw · Settlement Report</div>
    <h1>{html.escape(report.title)}</h1>
    <p class=\"lead\">{html.escape(report.cause)}<br />{html.escape(report.package_line)}</p>

    <section class=\"grid\">
      <div class=\"stat\"><div class=\"label\">结局</div><div class=\"value\">{html.escape(badge)}</div></div>
      <div class=\"stat\"><div class=\"label\">Profile</div><div class=\"value\">{html.escape(report.profile_name)}</div></div>
      <div class=\"stat\"><div class=\"label\">任务</div><div class=\"value\">{html.escape(report.mission_name)}</div></div>
      <div class=\"stat\"><div class=\"label\">回合</div><div class=\"value\">{report.turns}</div></div>
      <div class=\"stat\"><div class=\"label\">警戒</div><div class=\"value\">{report.alert}</div></div>
      <div class=\"stat\"><div class=\"label\">曝光峰值</div><div class=\"value\">{report.exposure_peak}</div></div>
      <div class=\"stat\"><div class=\"label\">战绩</div><div class=\"value\">{report.score}</div></div>
      <div class=\"stat\"><div class=\"label\">种子</div><div class=\"value\">{report.seed}</div></div>
    </section>

    <div class=\"columns\">
      <section class=\"panel\">
        <h2>最终状态</h2>
        <ul>{status_items}</ul>
      </section>
      <section class=\"panel\">
        <h2>最终设施视图</h2>
        <pre>{board_html}</pre>
      </section>
    </div>

    <div class=\"columns\">
      <section class=\"panel\">
        <h2>关键事件</h2>
        <ul>{event_items}</ul>
      </section>
      <section class=\"panel\">
        <h2>本局观察摘记</h2>
        <ul>{note_items}</ul>
      </section>
    </div>

    <div class=\"footer\">Generated by lobster-cli-heist · {html.escape(report.report_path.name)}</div>
  </main>
</body>
</html>
"""


def write_settlement_report(report: SettlementReport) -> Path:
    report.report_path.parent.mkdir(parents=True, exist_ok=True)
    report.report_path.write_text(render_settlement_html(report), encoding="utf-8")
    return report.report_path
