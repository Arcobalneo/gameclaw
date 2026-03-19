"""observer.py – 全局 SSE Trace 看板。

游戏启动时立即部署，贯穿整个 session（探索/战斗/爬塔/工坊）。
接口：
  ObserverServer.start()    → 后台线程启动 HTTP
  ObserverServer.push(event)→ 广播 SSE 事件
  ObserverServer.stop()     → 关闭服务释放端口
  ObserverServer.url        → 当前服务 URL

事件格式：{"type": str, "data": dict, "ts": float}
"""
from __future__ import annotations

import json
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from queue import Queue, Empty
from typing import Any


# --------------------------------------------------------------------------- #
# SSE 事件队列（per-connection）
# --------------------------------------------------------------------------- #

class _SSEClient:
    def __init__(self) -> None:
        self.queue: Queue = Queue(maxsize=200)

    def push(self, data: str) -> None:
        if not self.queue.full():
            self.queue.put_nowait(data)


# --------------------------------------------------------------------------- #
# HTTP Handler
# --------------------------------------------------------------------------- #

class _Handler(BaseHTTPRequestHandler):
    # 引用 ObserverServer 实例（由 server.set_observer 注入）
    observer: "ObserverServer"

    def log_message(self, *args: Any) -> None:
        pass  # 静音日志

    def do_GET(self) -> None:
        if self.path == "/events":
            self._handle_sse()
        elif self.path in ("/", "/index.html"):
            self._handle_html()
        elif self.path == "/state":
            self._handle_state()
        else:
            self.send_response(404); self.end_headers()

    def _handle_html(self) -> None:
        html = _build_html(self.observer.port)
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle_state(self) -> None:
        state = self.observer.get_snapshot()
        body = json.dumps(state, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle_sse(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        client = _SSEClient()
        self.observer._add_client(client)
        try:
            # 先推送完整快照
            snap = self.observer.get_snapshot()
            self._write_sse({"type": "snapshot", "data": snap, "ts": time.time()}, client)
            while True:
                try:
                    data = client.queue.get(timeout=20)
                    self.wfile.write(data.encode("utf-8"))
                    self.wfile.flush()
                except Empty:
                    # heartbeat
                    self.wfile.write(b":keepalive\n\n")
                    self.wfile.flush()
        except Exception:
            pass
        finally:
            self.observer._remove_client(client)

    def _write_sse(self, event: dict, client: _SSEClient) -> None:
        payload = f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        self.wfile.write(payload.encode("utf-8"))
        self.wfile.flush()


# --------------------------------------------------------------------------- #
# ObserverServer
# --------------------------------------------------------------------------- #

class ObserverServer:
    def __init__(self) -> None:
        self.port: int = 0
        self.url: str = ""
        self._server: HTTPServer | None = None
        self._thread: threading.Thread | None = None
        self._clients: list[_SSEClient] = []
        self._clients_lock = threading.Lock()
        self._event_history: list[dict] = []   # 最近 500 个事件
        self._snapshot: dict = {}

    def start(self, port_hint: int = 8000) -> bool:
        """尝试从 port_hint 起找可用端口，启动 HTTP 服务。返回是否成功。"""
        for port in range(port_hint, port_hint + 50):
            try:
                server = HTTPServer(("0.0.0.0", port), _Handler)
                server.observer = self  # type: ignore[attr-defined]
                self._server = server
                self.port = port
                self.url = f"http://localhost:{port}"
                self._thread = threading.Thread(target=self._serve, daemon=True)
                self._thread.start()
                return True
            except OSError:
                continue
        return False

    def _serve(self) -> None:
        if self._server:
            self._server.serve_forever()

    def stop(self) -> None:
        if self._server:
            self._server.shutdown()
            self._server = None

    def push(self, event_type: str, data: dict | None = None, message: str = "") -> None:
        event = {
            "type": event_type,
            "data": data or {},
            "message": message,
            "ts": time.time(),
        }
        self._event_history.append(event)
        if len(self._event_history) > 500:
            self._event_history.pop(0)

        # 更新 snapshot 字段
        self._update_snapshot(event)

        payload = f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        with self._clients_lock:
            for client in list(self._clients):
                client.push(payload)

    def _update_snapshot(self, event: dict) -> None:
        t = event["type"]
        if t in ("party_update", "snapshot"):
            self._snapshot.update(event.get("data", {}))
        elif t == "battle_turn":
            self._snapshot["last_battle"] = event.get("data", {})
            self._snapshot["last_message"] = event.get("message", "")
        elif t == "floor_start":
            self._snapshot["abyss_floor"] = event["data"].get("floor", 0)
        elif t == "capture_success":
            self._snapshot["last_capture"] = event["data"]
        self._snapshot["last_event"] = event

    def get_snapshot(self) -> dict:
        return dict(self._snapshot)

    def update_party(self, party_data: list[dict]) -> None:
        self.push("party_update", {"party": party_data})
        self._snapshot["party"] = party_data

    def _add_client(self, client: _SSEClient) -> None:
        with self._clients_lock:
            self._clients.append(client)

    def _remove_client(self, client: _SSEClient) -> None:
        with self._clients_lock:
            if client in self._clients:
                self._clients.remove(client)

    def print_banner(self) -> None:
        """在控制台打印带框大字的 observer URL（游戏启动时调用）。"""
        url = self.url
        line = f"  实时观战看板：{url}  "
        border = "═" * len(line)
        print(f"\n╔{border}╗")
        print(f"║{line}║")
        print(f"╚{border}╝\n")


# --------------------------------------------------------------------------- #
# HTML 看板页
# --------------------------------------------------------------------------- #

def _build_html(port: int) -> str:
    return f"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>🦞 lobster-cli-tamer 实时看板</title>
<meta http-equiv="refresh" content="0">
<style>
  body {{ font-family: 'Consolas', monospace; background:#0a0a0f; color:#c8e6c9; margin:0; padding:16px; }}
  h1   {{ color:#80cbc4; font-size:1.4em; margin:0 0 12px; }}
  .card {{ background:#111827; border:1px solid #1f3a4a; border-radius:6px; padding:12px; margin:8px 0; }}
  .party-member {{ border-left:3px solid #26c6da; padding-left:8px; margin:4px 0; }}
  .shiny {{ color:#ffd54f; }}
  .plague {{ color:#ef5350; }}
  .taint {{ color:#ab47bc; }}
  .log {{ font-size:0.85em; color:#aaa; max-height:200px; overflow-y:auto; }}
  .event {{ border-left:2px solid #4caf50; padding:2px 6px; margin:2px 0; font-size:0.8em; }}
  .dead {{ color:#666; text-decoration:line-through; }}
  #status {{ color:#26c6da; font-size:0.85em; }}
</style>
</head>
<body>
<h1>🦞 横着抓 — 实时战况看板</h1>
<div id="status">连接中…</div>
<div class="card" id="party-card"><b>队伍</b><div id="party">加载中…</div></div>
<div class="card"><b>最近事件</b><div class="log" id="log"></div></div>
<div class="card"><b>深渊层数</b> <span id="floor">—</span></div>
<script>
const es = new EventSource('/events');
const log = document.getElementById('log');
const party = document.getElementById('party');
const floor = document.getElementById('floor');
const status = document.getElementById('status');

es.onopen = () => {{ status.textContent = '✓ 已连接'; }};
es.onerror = () => {{ status.textContent = '✗ 连接断开，等待重连…'; }};

function renderParty(members) {{
  if (!members || !members.length) {{ party.innerHTML = '（空队伍）'; return; }}
  party.innerHTML = members.map(m => {{
    if (!m) return '<div class="party-member dead">空槽</div>';
    const shiny = m.is_shiny ? '<span class="shiny">✦</span> ' : '';
    const plague = m.has_plague ? ' <span class="plague">🦠</span>' : '';
    const taint = m.abyss_taint ? ` <span class="taint">☣${m.abyss_taint}</span>` : '';
    const dead = m.dead ? ' dead' : '';
    const hp = m.hp_current !== undefined
      ? `HP ${{Math.round(m.hp_current)}}/${{Math.round(m.stats?.hp||0)}}`
      : '';
    return `<div class="party-member${{dead}}">${{shiny}}${{m.nickname||m.species_name||m.species_id}} Lv${{m.level}} ${{hp}}${{plague}}${{taint}}</div>`;
  }}).join('');
}}

es.onmessage = e => {{
  const ev = JSON.parse(e.data);
  if (ev.type === 'snapshot') {{
    if (ev.data.party) renderParty(ev.data.party);
    if (ev.data.abyss_floor) floor.textContent = ev.data.abyss_floor;
    return;
  }}
  if (ev.type === 'party_update' && ev.data.party) renderParty(ev.data.party);
  if (ev.type === 'floor_start') floor.textContent = ev.data.floor || '—';

  const div = document.createElement('div');
  div.className = 'event';
  div.textContent = `[${{new Date(ev.ts*1000).toLocaleTimeString()}}] ${{ev.message || ev.type}}`;
  log.prepend(div);
  if (log.children.length > 80) log.removeChild(log.lastChild);
}};
</script>
</body>
</html>"""
