import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getSaveRoot, ensureRoot } from './storage.js';

function htmlPage(): string {
  const statePath = path.join(getSaveRoot(), 'observer', 'latest-state.json');
  let payload: any = {};
  try {
    payload = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    payload = { latestResult: 'observer waiting for first state write', latestAscii: [] };
  }
  const history = (payload.history ?? []).map((entry: any) => `${entry.turn}. ${entry.action} -> ${entry.result}`).join('\n');
  const ascii = (payload.latestAscii ?? []).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="2"><title>${payload.caseName ?? '横着看 observer'}</title><style>body{background:#07111a;color:#cfe2ef;font-family:ui-monospace,monospace;padding:24px} .grid{display:grid;grid-template-columns:2fr 1fr;gap:16px} pre{background:#101b26;padding:16px;border-radius:12px;white-space:pre-wrap}</style></head><body><h1>${payload.caseName ?? '横着看 observer'} · turn ${payload.turn ?? 0}</h1><div class="grid"><pre>${payload.latestResult ?? 'waiting...'}</pre><pre>focus=${payload.focus ?? '-'}\nnerve=${payload.nerve ?? '-'}\ndread=${payload.dread ?? '-'}\nevidence=${payload.evidence ?? '-'}\noutcome=${payload.outcome ?? 'ongoing'}</pre></div><h2>Latest Witness</h2><pre>${payload.latestWitness ?? 'none'}</pre><h2>ASCII Witness</h2><pre>${ascii}</pre><h2>Timeline</h2><pre>${history || 'none yet'}</pre></body></html>`;
}

export function runObserverDaemon(port: number): void {
  ensureRoot();
  const server = http.createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(htmlPage());
  });
  server.listen(port, '127.0.0.1');
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}
