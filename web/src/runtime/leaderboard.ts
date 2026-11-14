import { canonicalGameId } from '../../../relay/src/games';
import { leaderboardUrl, leaderboardWsUrl } from './config';

export interface BoardRow {
  name: string;
  score: number;
  attempts: number;
  updatedAt: number;
}

export interface BoardSnapshot {
  rule: string;
  games: Record<string, BoardRow[]>;
  total: BoardRow[];
}

export interface SubmitBody {
  name: string;
  game: string;
  score: number;
  outcome: 'won' | 'lost';
  turn: number;
  run: string;
}

export type SubmitResponse =
  | {
      ok: true;
      accepted: boolean;
      reason: string;
      best: number;
      attempts: number;
      boards?: BoardSnapshot;
    }
  | { ok: false; error: string };

const CACHE_KEY = 'gameclaw:leaderboard';
const listeners = new Set<(snap: BoardSnapshot) => void>();

function empty(): BoardSnapshot {
  return { rule: 'best-per-game', games: {}, total: [] };
}

function mergeRows(left: BoardRow[], right: BoardRow[]): BoardRow[] {
  const byName = new Map<string, BoardRow>();
  for (const row of [...left, ...right]) {
    const prev = byName.get(row.name);
    if (
      !prev ||
      row.score > prev.score ||
      (row.score === prev.score && row.updatedAt > prev.updatedAt)
    ) {
      byName.set(row.name, row);
    }
  }
  return [...byName.values()].sort(
    (a, b) => b.score - a.score || a.updatedAt - b.updatedAt || a.name.localeCompare(b.name),
  );
}

/** Move boards stored under a former id onto the current id. */
export function foldBoards(snap: BoardSnapshot): BoardSnapshot {
  const games: Record<string, BoardRow[]> = {};
  for (const [id, rows] of Object.entries(snap.games)) {
    if (!Array.isArray(rows)) continue;
    const canon = canonicalGameId(id);
    games[canon] = mergeRows(games[canon] ?? [], rows);
  }
  return { rule: snap.rule, games, total: snap.total };
}

function readCache(): BoardSnapshot {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as BoardSnapshot;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.total)) return empty();
    return foldBoards({
      rule: typeof parsed.rule === 'string' ? parsed.rule : 'best-per-game',
      games: parsed.games ?? {},
      total: parsed.total,
    });
  } catch {
    return empty();
  }
}

let snap: BoardSnapshot = readCache();
let started = false;
let ws: WebSocket | null = null;

export function currentBoard(): BoardSnapshot {
  return snap;
}

export function rowsFor(gameId: string | 'total'): BoardRow[] {
  if (gameId === 'total') return snap.total;
  return snap.games[gameId] ?? [];
}

export function onBoard(fn: (snap: BoardSnapshot) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function apply(next: BoardSnapshot): void {
  const folded = foldBoards(next);
  snap = {
    rule: folded.rule,
    games: { ...folded.games },
    total: [...folded.total],
  };
  try {
    globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
  for (const fn of listeners) fn(snap);
}

function asSnapshot(body: Partial<BoardSnapshot> & { ok?: boolean }): BoardSnapshot | null {
  if (!body || body.ok === false) return null;
  if (!Array.isArray(body.total)) return null;
  return {
    rule: typeof body.rule === 'string' ? body.rule : 'best-per-game',
    games: body.games ?? {},
    total: body.total,
  };
}

export async function refreshBoard(): Promise<void> {
  try {
    const res = await fetch(leaderboardUrl());
    if (!res.ok) return;
    const body = (await res.json()) as Partial<BoardSnapshot> & { ok?: boolean };
    const next = asSnapshot(body);
    if (next) apply(next);
  } catch {
    /* offline */
  }
}

export async function submitScore(body: SubmitBody): Promise<SubmitResponse> {
  try {
    const res = await fetch(leaderboardUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as SubmitResponse & { boards?: BoardSnapshot };
    if (payload.ok && payload.boards) apply(payload.boards);
    if (!res.ok && payload.ok !== true) {
      return { ok: false, error: 'error' in payload ? payload.error : 'Submit failed.' };
    }
    return payload;
  } catch {
    return { ok: false, error: 'Leaderboard is offline.' };
  }
}

function connectLive(): void {
  let delay = 1000;
  const open = () => {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(leaderboardWsUrl());
    } catch {
      return;
    }
    ws = socket;
    socket.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type?: string } & Partial<BoardSnapshot>;
        if (msg.type !== 'leaderboard') return;
        const next = asSnapshot({ ...msg, ok: true });
        if (next) apply(next);
      } catch {
        /* ignore */
      }
    });
    socket.addEventListener('close', () => {
      if (ws !== socket) return;
      ws = null;
      window.setTimeout(open, delay);
      delay = Math.min(delay * 2, 8000);
    });
  };
  open();
}

/** First paint from cache, then a GET, then live updates. */
export function startLeaderboard(): void {
  if (started) return;
  started = true;
  void refreshBoard();
  connectLive();
}
