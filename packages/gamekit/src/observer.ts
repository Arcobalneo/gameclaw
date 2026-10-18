import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { GameError } from './errors';
import type { GamePaths } from './paths';
import { observerFilePath } from './paths';
import { readSave } from './store';
import type { GameDefinition, GameMeta } from './types';

export interface ObserverPortFile {
  game: string;
  port: number;
  pid: number;
  token: string;
  startedAt: string;
}

export interface ObserverHandle {
  url: string;
  port: number;
  pid: number;
  reused: boolean;
}

const OBSERVER_TTL_MS = 3 * 60 * 60 * 1000;
const PORT_SCAN_LIMIT = 40;

function readPortFile(paths: GamePaths): ObserverPortFile | undefined {
  try {
    return JSON.parse(fs.readFileSync(observerFilePath(paths), 'utf8')) as ObserverPortFile;
  } catch {
    return undefined;
  }
}

function writePortFile(paths: GamePaths, value: ObserverPortFile): void {
  fs.mkdirSync(paths.observerDir, { recursive: true });
  const file = observerFilePath(paths);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(`${file}.tmp`, file);
}

function removePortFile(paths: GamePaths): void {
  try {
    fs.rmSync(observerFilePath(paths));
  } catch {
    // Already gone.
  }
}

function requestJson(
  port: number,
  pathname: string,
  options: { method?: string; headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: '127.0.0.1',
        port,
        path: pathname,
        method: options.method ?? 'GET',
        headers: options.headers,
        timeout: options.timeoutMs ?? 800,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => resolve({ status: response.statusCode ?? 0, body }));
      },
    );
    request.on('timeout', () => request.destroy(new Error('observer request timed out')));
    request.on('error', reject);
    request.end();
  });
}

async function isHealthy(port: number, gameId: string): Promise<boolean> {
  try {
    const response = await requestJson(port, '/health', { timeoutMs: 500 });
    if (response.status !== 200) return false;
    const payload = JSON.parse(response.body) as { ok?: boolean; game?: string };
    return payload.ok === true && payload.game === gameId;
  } catch {
    return false;
  }
}

function selfSpawnPrefix(): string[] {
  const entry = process.argv[1];
  const execArgv = process.execArgv.filter((arg) => !arg.startsWith('--inspect'));
  const leading = entry && /\.(?:[cm]?[jt]s)$/.test(entry) ? [entry] : [];
  return [...execArgv, ...leading];
}

/**
 * Start (or reuse) the detached observer daemon for this game.
 * Returns null when the observer cannot be started; callers must degrade honestly.
 */
export async function ensureObserver(
  game: GameDefinition,
  paths: GamePaths,
  options: { enabled?: boolean } = {},
): Promise<ObserverHandle | null> {
  if (options.enabled === false) return null;
  const existing = readPortFile(paths);
  if (existing && (await isHealthy(existing.port, game.meta.id))) {
    return {
      url: `http://127.0.0.1:${existing.port}`,
      port: existing.port,
      pid: existing.pid,
      reused: true,
    };
  }
  removePortFile(paths);

  const args = [
    ...selfSpawnPrefix(),
    '__observer-daemon',
    '--state-dir',
    paths.root,
    '--game-id',
    game.meta.id,
  ];
  try {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    });
    child.unref();
  } catch {
    return null;
  }

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const portFile = readPortFile(paths);
    if (!portFile) continue;
    if (await isHealthy(portFile.port, game.meta.id)) {
      return {
        url: `http://127.0.0.1:${portFile.port}`,
        port: portFile.port,
        pid: portFile.pid,
        reused: false,
      };
    }
  }
  return null;
}

export async function stopObserver(paths: GamePaths): Promise<void> {
  const portFile = readPortFile(paths);
  if (!portFile) return;
  try {
    await requestJson(portFile.port, '/shutdown', {
      method: 'POST',
      headers: { 'x-observer-token': portFile.token },
      timeoutMs: 800,
    });
  } catch {
    // The daemon may already be gone or expired.
  }
  removePortFile(paths);
}

function listenOnFreePort(server: http.Server, start: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let port = start;
    const attempt = (): void => {
      if (port >= start + PORT_SCAN_LIMIT) {
        reject(new GameError('INTERNAL', 'No free observer port found.'));
        return;
      }
      const onError = (error: NodeJS.ErrnoException): void => {
        server.removeListener('error', onError);
        if (error.code === 'EADDRINUSE') {
          port += 1;
          attempt();
          return;
        }
        reject(error);
      };
      server.once('error', onError);
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', onError);
        resolve(port);
      });
    };
    attempt();
  });
}

function dashboardHtml(meta: GameMeta): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${meta.name} · observer</title>
<style>
:root{color-scheme:dark;--bg:#07131f;--panel:#0d2031;--line:rgba(255,255,255,.08);--text:#ebf4ff;--muted:#9bb3c9;--accent:#7bf1a8}
*{box-sizing:border-box}
body{margin:0;padding:28px 18px 48px;background:radial-gradient(circle at 50% 0,#12314a 0,var(--bg) 55%);color:var(--text);font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
main{max-width:900px;margin:0 auto}
h1{font-size:18px;margin:0 0 4px}
.muted{color:var(--muted)}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:12px 0}
.headline{font-size:16px;font-weight:700;color:var(--accent);margin-bottom:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
.metric{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:8px;padding:8px 10px}
.metric .k{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.metric .v{font-size:16px;font-weight:700}
.section{margin-top:10px;white-space:pre-wrap}
.section h3{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin:10px 0 4px}
.action{padding:2px 0;border-bottom:1px dashed rgba(255,255,255,.05)}
.action .id{color:#8ecae6}
.end{color:#ffd166;font-weight:700}
</style>
</head>
<body>
<main>
  <h1>${meta.name} <span class="muted">· ${meta.englishName}</span></h1>
  <div class="muted" id="sub">connecting…</div>
  <div class="panel" id="panel">waiting for a run…</div>
  <div class="muted" style="text-align:center;margin-top:16px">live observer · refreshes every second</div>
</main>
<script>
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function tick(){
  try {
    const res = await fetch('/state.json', {cache:'no-store'});
    if(!res.ok){ document.getElementById('sub').textContent = 'no active run'; document.getElementById('panel').textContent = 'Start a run in the terminal.'; return; }
    const data = await res.json();
    if(!data.ok || !data.status){ throw new Error(data.error?.message || 'no state'); }
    const s = data.status;
    document.getElementById('sub').textContent = 'slot ' + data.slot + ' · turn ' + data.turn + ' · ' + data.outcome + ' · seed ' + data.seed;
    const metrics = (s.metrics||[]).map(m => '<div class="metric"><div class="k">'+esc(m.label)+'</div><div class="v">'+esc(m.value)+'</div></div>').join('');
    const sections = (s.sections||[]).map(sec => '<div class="section"><h3>'+esc(sec.title)+'</h3>'+sec.lines.map(esc).join('\\n')+'</div>').join('');
    const actions = (data.actions||[]).map(a => '<div class="action"><span class="id">'+esc(a.id)+'</span> · '+esc(a.label)+(a.risk?' <span class="muted">risk='+esc(a.risk)+'</span>':'')+'</div>').join('');
    const ended = data.outcome !== 'ongoing' ? '<div class="end">run ended: '+esc(data.outcome)+'</div>' : '';
    document.getElementById('panel').innerHTML = '<div class="headline">'+esc(s.headline)+'</div>'+ended+'<div class="grid">'+metrics+'</div>'+sections+'<div class="section"><h3>Actions</h3>'+actions+'</div>';
  } catch (error) {
    document.getElementById('sub').textContent = 'waiting for state…';
  }
}
tick(); setInterval(tick, 1000);
</script>
</body>
</html>`;
}

function snapshotPayload(game: GameDefinition, paths: GamePaths): Record<string, unknown> {
  let slot = 0;
  try {
    const raw = fs.readFileSync(path.join(paths.gameDir, 'last-slot'), 'utf8').trim();
    const parsed = Number(raw);
    if (Number.isInteger(parsed)) slot = parsed;
  } catch {
    // Keep slot 0.
  }
  try {
    const save = readSave(paths, slot);
    const status = game.status(save.state);
    return {
      ok: true,
      slot,
      runId: save.runId,
      turn: save.turn,
      seed: save.seed,
      outcome: status.outcome,
      status: {
        headline: status.headline,
        phase: status.phase,
        metrics: status.metrics,
        sections: status.sections,
      },
      actions: game.actions(save.state),
    };
  } catch (error) {
    return {
      ok: false,
      slot,
      error: { message: error instanceof Error ? error.message : String(error) },
    };
  }
}

/** Run the observer daemon in the foreground. Blocks until shutdown, TTL or signal. */
export function runObserverDaemon(
  game: GameDefinition,
  options: { paths: GamePaths; startPort: number },
): void {
  const { paths } = options;
  const token = crypto.randomBytes(16).toString('hex');
  const html = dashboardHtml(game.meta);

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    }
    if (url.pathname === '/health') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, game: game.meta.id, pid: process.pid }));
      return;
    }
    if (url.pathname === '/state.json') {
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(JSON.stringify(snapshotPayload(game, paths)));
      return;
    }
    if (url.pathname === '/shutdown' && request.method === 'POST') {
      if (request.headers['x-observer-token'] !== token) {
        response.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: false, error: 'invalid token' }));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true }));
      shutdown();
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: 'not found' }));
  });

  let closed = false;
  const shutdown = (): void => {
    if (closed) return;
    closed = true;
    removePortFile(paths);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 300).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  listenOnFreePort(server, options.startPort)
    .then((port) => {
      writePortFile(paths, {
        game: game.meta.id,
        port,
        pid: process.pid,
        token,
        startedAt: new Date().toISOString(),
      });
      console.error(`OBSERVER http://127.0.0.1:${port}`);
      setTimeout(shutdown, OBSERVER_TTL_MS).unref();
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}

/** Foreground observer used by the `observer` command (Ctrl-C to stop). */
export function runForegroundObserver(
  game: GameDefinition,
  options: { paths: GamePaths; port: number },
): void {
  runObserverDaemon(game, { paths: options.paths, startPort: options.port });
}
