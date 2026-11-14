import { statsHelloUrl, statsUrl, statsWsUrl } from './config';
import { loadOrCreatePlayer } from './player';

export interface PlayCounts {
  site: number;
  games: Record<string, number>;
}

const CACHE_KEY = 'gameclaw:play-counts';
const listeners = new Set<(counts: PlayCounts) => void>();

function empty(): PlayCounts {
  return { site: 0, games: {} };
}

function readCache(): PlayCounts {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as PlayCounts;
    if (typeof parsed?.site !== 'number' || typeof parsed.games !== 'object' || !parsed.games)
      return empty();
    return { site: Math.max(0, Math.floor(parsed.site)), games: { ...parsed.games } };
  } catch {
    return empty();
  }
}

function writeCache(counts: PlayCounts): void {
  try {
    globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify(counts));
  } catch {
    /* ignore */
  }
}

let counts: PlayCounts = readCache();
let started = false;
let ws: WebSocket | null = null;
const reportedGames = new Set<string>();

export function currentCounts(): PlayCounts {
  return counts;
}

export function onCounts(fn: (counts: PlayCounts) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function apply(next: PlayCounts): void {
  counts = { site: next.site, games: { ...next.games } };
  writeCache(counts);
  for (const fn of listeners) fn(counts);
}

async function hello(game?: string): Promise<void> {
  const player = loadOrCreatePlayer();
  try {
    const res = await fetch(statsHelloUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(game ? { player, game } : { player }),
    });
    if (!res.ok) return;
    const body = (await res.json()) as {
      ok?: boolean;
      site?: number;
      games?: Record<string, number>;
    };
    if (body.ok && typeof body.site === 'number')
      apply({ site: body.site, games: body.games ?? {} });
  } catch {
    /* offline */
  }
}

function connectLive(): void {
  let delay = 1000;
  const open = () => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(statsWsUrl());
    } catch {
      setTimeout(open, delay);
      delay = Math.min(delay * 2, 8000);
      return;
    }
    ws = socket;
    socket.addEventListener('open', () => {
      delay = 1000;
    });
    socket.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          type?: string;
          site?: number;
          games?: Record<string, number>;
        };
        if (msg.type === 'stats' && typeof msg.site === 'number') {
          apply({ site: msg.site, games: msg.games ?? {} });
        }
      } catch {
        /* ignore */
      }
    });
    socket.addEventListener('close', () => {
      if (ws === socket) ws = null;
      setTimeout(open, delay);
      delay = Math.min(delay * 2, 8000);
    });
  };
  open();
}

/** First paint uses the cached count; then GET /stats, POST hello, and a live socket. */
export function startStats(): void {
  if (started) return;
  started = true;
  counts = readCache();
  void (async () => {
    try {
      const res = await fetch(statsUrl());
      if (res.ok) {
        const body = (await res.json()) as {
          ok?: boolean;
          site?: number;
          games?: Record<string, number>;
        };
        if (body.ok && typeof body.site === 'number')
          apply({ site: body.site, games: body.games ?? {} });
      }
    } catch {
      /* offline */
    }
    await hello();
    connectLive();
  })();
}

export function reportGame(id: string): void {
  if (reportedGames.has(id)) return;
  reportedGames.add(id);
  void hello(id);
}

export function stopStats(): void {
  started = false;
  ws?.close();
  ws = null;
}
