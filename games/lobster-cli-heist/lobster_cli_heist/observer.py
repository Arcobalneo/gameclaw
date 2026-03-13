from __future__ import annotations

import socket
import threading

from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class ObserverServer:
    def __init__(self, host: str = "127.0.0.1", port_start: int = 8000, *, port_limit: int = 128) -> None:
        self.host = host
        self.port = find_open_port(host=host, start=port_start, limit=port_limit)
        self._html = "<html><body><p>observer booting…</p></body></html>"
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._httpd = self._build_httpd()

    def _build_httpd(self) -> ReusableThreadingHTTPServer:
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                if self.path not in ("/", "/index.html"):
                    self.send_error(HTTPStatus.NOT_FOUND)
                    return
                with outer._lock:
                    body = outer._html.encode("utf-8")
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, format: str, *args: object) -> None:  # noqa: A003
                return

        return ReusableThreadingHTTPServer((self.host, self.port), Handler)

    @property
    def url(self) -> str:
        return f"http://{self.host}:{self.port}"

    def start(self, initial_html: str) -> None:
        self.publish(initial_html)
        self._thread = threading.Thread(target=self._httpd.serve_forever, name="lobster-heist-observer", daemon=True)
        self._thread.start()

    def publish(self, html: str) -> None:
        with self._lock:
            self._html = html

    def stop(self) -> None:
        self._httpd.shutdown()
        self._httpd.server_close()
        if self._thread is not None:
            self._thread.join(timeout=3)


def find_open_port(*, host: str = "127.0.0.1", start: int = 8000, limit: int = 128) -> int:
    for port in range(start, start + limit):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
            except OSError:
                continue
            return port
    raise RuntimeError(f"无法从 {host}:{start}+ 找到可用 observer 端口。")
