"""report.py – 生成静态 HTML 结算页。

用途：
- 游戏退出时生成 session 结算页
- 深渊结束后生成 run summary
- observer 停止后仍可离线查看结果
"""
from __future__ import annotations

import html
import json
import time
from pathlib import Path
from typing import Any, Iterable, Optional

from lobster_cli_tamer.save import SAVE_DIR, SaveSlot


def generate_session_report(
    save: SaveSlot,
    observer_snapshot: Optional[dict[str, Any]] = None,
    events: Optional[list[dict[str, Any]]] = None,
    session_seconds: int = 0,
    title: str = "lobster-cli-tamer 结算页",
    output_path: Optional[str | Path] = None,
) -> Path:
    reports_dir = SAVE_DIR / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    ts = time.strftime("%Y%m%d-%H%M%S")
    path = Path(output_path) if output_path else reports_dir / f"session-{ts}.html"

    body = _build_html(
        title=title,
        save=save,
        observer_snapshot=observer_snapshot or {},
        events=events or [],
        session_seconds=session_seconds,
    )
    path.write_text(body, encoding="utf-8")

    latest = reports_dir / "latest.html"
    latest.write_text(body, encoding="utf-8")
    return path


def _build_html(
    title: str,
    save: SaveSlot,
    observer_snapshot: dict[str, Any],
    events: list[dict[str, Any]],
    session_seconds: int,
) -> str:
    party_rows = "\n".join(_render_party_row(c) for c in save.party if c is not None) or "<tr><td colspan='6'>无</td></tr>"
    box_count = len(save.box)
    memorial_rows = "\n".join(
        f"<tr><td>{_e(m.get('name','?'))}</td><td>{_e(m.get('species_id','?'))}</td><td>{m.get('level','?')}</td><td>{'✦' if m.get('is_shiny') else ''}</td><td>{_e(m.get('cause','?'))}</td></tr>"
        for m in save.memorial[-20:]
    ) or "<tr><td colspan='5'>暂无阵亡记录</td></tr>"
    event_rows = "\n".join(_render_event_row(e) for e in events[-80:]) or "<div class='empty'>本次 session 没有事件日志</div>"

    snapshot_json = html.escape(json.dumps(observer_snapshot, ensure_ascii=False, indent=2))
    play_min = session_seconds // 60

    return f"""<!doctype html>
<html lang='zh'>
<head>
<meta charset='utf-8'>
<title>{_e(title)}</title>
<style>
body {{ background:#0b1020; color:#e7edf7; font-family:Inter,Segoe UI,Arial,sans-serif; margin:0; }}
.wrap {{ max-width:1100px; margin:0 auto; padding:24px; }}
.hero {{ background:linear-gradient(135deg,#102542,#173b66); border:1px solid #264d7d; border-radius:12px; padding:20px; margin-bottom:18px; }}
.hero h1 {{ margin:0 0 8px; font-size:28px; }}
.hero .meta {{ color:#a9c1de; font-size:14px; }}
.grid {{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }}
.card {{ background:#121a2b; border:1px solid #22314f; border-radius:12px; padding:16px; }}
.card h2 {{ margin:0 0 12px; font-size:18px; color:#8fd3ff; }}
.kpis {{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-top:14px; }}
.kpi {{ background:#0d1524; border-radius:10px; padding:12px; text-align:center; }}
.kpi .n {{ font-size:22px; font-weight:700; color:#7bf1a8; }}
table {{ width:100%; border-collapse:collapse; font-size:14px; }}
th,td {{ padding:8px 10px; border-bottom:1px solid #23314c; text-align:left; }}
.badge {{ display:inline-block; padding:2px 8px; border-radius:999px; background:#203351; color:#cbe5ff; font-size:12px; }}
.shiny {{ color:#ffd54f; font-weight:700; }}
.dead {{ color:#ff8a80; }}
pre {{ white-space:pre-wrap; word-break:break-word; background:#0d1524; padding:12px; border-radius:10px; }}
.event {{ border-left:3px solid #39c6ff; padding:6px 10px; margin:6px 0; background:#0d1524; border-radius:8px; }}
.empty {{ color:#7f93ad; }}
@media (max-width: 900px) {{ .grid {{ grid-template-columns:1fr; }} .kpis {{ grid-template-columns:repeat(2,minmax(0,1fr)); }} }}
</style>
</head>
<body>
<div class='wrap'>
  <section class='hero'>
    <h1>🦞 {_e(title)}</h1>
    <div class='meta'>玩家：{_e(save.player_name)} · 生成时间：{_e(time.strftime('%Y-%m-%d %H:%M:%S'))} · 本次 session：约 {play_min} 分钟</div>
    <div class='kpis'>
      <div class='kpi'><div class='n'>{len(save.dex_caught)}</div><div>已捕虾米</div></div>
      <div class='kpi'><div class='n'>{save.deepest_abyss_floor}</div><div>深渊最深</div></div>
      <div class='kpi'><div class='n'>{len(save.active_party)}</div><div>当前存活队伍</div></div>
      <div class='kpi'><div class='n'>{save.total_deaths}</div><div>永久死亡</div></div>
    </div>
  </section>

  <div class='grid'>
    <section class='card'>
      <h2>当前队伍</h2>
      <table>
        <thead><tr><th>名称</th><th>等级</th><th>HP</th><th>状态</th><th>技能</th><th>词条数</th></tr></thead>
        <tbody>{party_rows}</tbody>
      </table>
      <p>仓库虾米：<span class='badge'>{box_count}</span></p>
    </section>

    <section class='card'>
      <h2>资源与进度</h2>
      <p>已见图鉴：<span class='badge'>{len(save.dex_seen)}</span></p>
      <p>灵光目击：<span class='badge'>{len(save.shiny_encountered)}</span> / 灵光捕获：<span class='badge'>{len(save.shiny_caught)}</span></p>
      <p>战斗次数：<span class='badge'>{save.total_battles}</span> · 捕捉次数：<span class='badge'>{save.total_captures}</span> · 深渊尝试：<span class='badge'>{save.total_abyss_runs}</span></p>
      <pre>{_e(json.dumps(save.items, ensure_ascii=False, indent=2))}</pre>
    </section>

    <section class='card'>
      <h2>阵亡纪念</h2>
      <table>
        <thead><tr><th>名称</th><th>species_id</th><th>等级</th><th>灵光</th><th>死因</th></tr></thead>
        <tbody>{memorial_rows}</tbody>
      </table>
    </section>

    <section class='card'>
      <h2>Observer Snapshot</h2>
      <pre>{snapshot_json}</pre>
    </section>
  </div>

  <section class='card' style='margin-top:16px;'>
    <h2>本次 Session 事件流</h2>
    {event_rows}
  </section>
</div>
</body>
</html>"""


def _render_party_row(c) -> str:
    state = []
    if c.is_shiny:
        state.append("<span class='shiny'>✦灵光</span>")
    if c.has_plague:
        state.append("🦠疫病")
    if c.dead:
        state.append("<span class='dead'>阵亡</span>")
    state_html = " / ".join(state) or "正常"
    return (
        f"<tr>"
        f"<td>{_e(c.display_name)}</td>"
        f"<td>{c.level}</td>"
        f"<td>{round(c.hp_current)}/{round(c.stats.get('hp',0))}</td>"
        f"<td>{state_html}</td>"
        f"<td>{_e(', '.join(c.moves))}</td>"
        f"<td>{sum(1 for s in c.affix_slots if not s.is_empty())}</td>"
        f"</tr>"
    )


def _render_event_row(e: dict[str, Any]) -> str:
    et = _e(str(e.get("type", "event")))
    msg = _e(str(e.get("message", "")))
    data = _e(json.dumps(e.get("data", {}), ensure_ascii=False))
    return f"<div class='event'><b>{et}</b>：{msg}<br><small>{data}</small></div>"


def _e(v: Any) -> str:
    return html.escape(str(v))
