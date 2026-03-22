import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import type { GameState } from './model.js';
import { ensureRoot, getSaveRoot } from './storage.js';

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function detectPort(start = 8000): Promise<number> {
  for (let port = start; port < start + 30; port += 1) {
    if (await portFree(port)) return port;
  }
  throw new Error('No observer port available in localhost:8000-8029');
}

export async function ensureObserver(state: GameState): Promise<{ port?: number; pid?: number; started: boolean }> {
  ensureRoot();
  const daemonFile = path.join(getSaveRoot(), 'observer', 'daemon.json');
  if (fs.existsSync(daemonFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(daemonFile, 'utf8')) as { port: number; pid: number };
      process.kill(data.pid, 0);
      return { ...data, started: false };
    } catch {
      // fallthrough
    }
  }
  const port = await detectPort(8000);
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1]!, 'observer-daemon', '--port', String(port)], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  const payload = { port, pid: child.pid };
  fs.writeFileSync(daemonFile, JSON.stringify(payload, null, 2), 'utf8');
  return { ...payload, started: true };
}

export function stopObserver(): void {
  const daemonFile = path.join(getSaveRoot(), 'observer', 'daemon.json');
  if (!fs.existsSync(daemonFile)) return;
  try {
    const data = JSON.parse(fs.readFileSync(daemonFile, 'utf8')) as { pid: number };
    process.kill(data.pid, 'SIGTERM');
  } catch {
    // ignore
  }
  try { fs.unlinkSync(daemonFile); } catch {}
}
