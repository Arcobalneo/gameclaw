import { normalizePlayerName, playerNameKey } from '@gameclaw/gamekit';
import { GAME_IDS, isGameId } from './games';
import { TokenBucket } from './rate-limit';
import type { SocketLike } from './room';

export const SCORE_CAP = 999_999;
export const BOARD_PUBLIC = 20;
export const BOARD_STORE = 100;
export const RULE_ID = 'best-per-game';

export interface BoardRow {
  name: string;
  score: number;
  attempts: number;
  updatedAt: number;
}

export interface StoredRow extends BoardRow {
  key: string;
}

export interface BoardSnapshot {
  rule: typeof RULE_ID;
  games: Record<string, BoardRow[]>;
  total: BoardRow[];
}

export interface SubmitInput {
  name: string;
  game: string;
  score: number;
  outcome: string;
  turn: number;
  run: string;
}

export type SubmitResult =
  | {
      ok: true;
      accepted: boolean;
      reason: 'best' | 'not_best' | 'duplicate' | 'below_board';
      game: string;
      name: string;
      score: number;
      best: number;
      attempts: number;
      boards: BoardSnapshot;
    }
  | { ok: false; error: string; status: number };

export interface BoardStore {
  load(): Promise<BoardFile> | BoardFile;
  save(file: BoardFile): Promise<void> | void;
}

export interface BoardFile {
  games: Record<string, StoredRow[]>;
  seen: string[];
}

export function emptyBoard(): BoardFile {
  return { games: {}, seen: [] };
}

/** In-memory store for tests and the local server. */
export class MemoryBoardStore implements BoardStore {
  file: BoardFile = emptyBoard();
  load(): BoardFile {
    return this.file;
  }
  save(file: BoardFile): void {
    this.file = file;
  }
}

function publicRow(row: StoredRow): BoardRow {
  return { name: row.name, score: row.score, attempts: row.attempts, updatedAt: row.updatedAt };
}

function byRank(a: StoredRow, b: StoredRow): number {
  return b.score - a.score || a.updatedAt - b.updatedAt || a.key.localeCompare(b.key);
}

export function snapshotOf(file: BoardFile): BoardSnapshot {
  const games: Record<string, BoardRow[]> = {};
  const totals = new Map<string, StoredRow>();
  for (const id of GAME_IDS) {
    const rows = [...(file.games[id] ?? [])].sort(byRank);
    if (rows.length) games[id] = rows.slice(0, BOARD_PUBLIC).map(publicRow);
    for (const row of rows) {
      const prev = totals.get(row.key);
      if (!prev) {
        totals.set(row.key, { ...row });
      } else {
        prev.score += row.score;
        prev.attempts += row.attempts;
        if (row.updatedAt > prev.updatedAt) {
          prev.updatedAt = row.updatedAt;
          prev.name = row.name;
        }
      }
    }
  }
  const total = [...totals.values()].sort(byRank).slice(0, BOARD_PUBLIC).map(publicRow);
  return { rule: RULE_ID, games, total };
}

export class LeaderboardCore {
  readonly sockets = new Set<SocketLike>();
  readonly #ipLimit = new TokenBucket(8, 8 / 60);
  readonly #nameHits = new Map<string, number[]>();

  constructor(
    readonly store: BoardStore,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async get(): Promise<BoardSnapshot> {
    return snapshotOf(await this.store.load());
  }

  attach(socket: SocketLike): void {
    this.sockets.add(socket);
  }

  async welcome(socket: SocketLike): Promise<void> {
    this.attach(socket);
    if (socket.readyState === 1) {
      socket.send(JSON.stringify({ type: 'leaderboard', ...(await this.get()) }));
    }
  }

  detach(socket: SocketLike): void {
    this.sockets.delete(socket);
  }

  broadcast(boards: BoardSnapshot): void {
    const raw = JSON.stringify({ type: 'leaderboard', ...boards });
    for (const socket of [...this.sockets]) {
      if (socket.readyState === 1) {
        try {
          socket.send(raw);
        } catch {
          this.sockets.delete(socket);
        }
      } else this.sockets.delete(socket);
    }
  }

  async submit(input: SubmitInput, ip: string): Promise<SubmitResult> {
    const name = normalizePlayerName(input.name);
    if (!name) return { ok: false, error: 'Name is not allowed.', status: 400 };
    if (!isGameId(input.game)) return { ok: false, error: 'Unknown game.', status: 400 };
    if (input.outcome !== 'won' && input.outcome !== 'lost') {
      return { ok: false, error: 'Only a finished win or loss can be submitted.', status: 400 };
    }
    if (!Number.isInteger(input.score) || input.score < 1 || input.score > SCORE_CAP) {
      return { ok: false, error: 'Score is out of range.', status: 400 };
    }
    if (!Number.isInteger(input.turn) || input.turn < 1) {
      return { ok: false, error: 'Turn is out of range.', status: 400 };
    }
    const run = typeof input.run === 'string' ? input.run.trim() : '';
    if (run.length < 8 || run.length > 120) {
      return { ok: false, error: 'Run id is missing.', status: 400 };
    }
    if (!this.#ipLimit.take(`lb:${ip}`)) {
      return { ok: false, error: 'Too many submits. Try again in a minute.', status: 429 };
    }
    const key = playerNameKey(name);
    if (!this.#allowName(key)) {
      return { ok: false, error: 'Too many submits for this name. Try again later.', status: 429 };
    }

    const file = await this.store.load();
    if (file.seen.includes(run)) {
      const existing = (file.games[input.game] ?? []).find((row) => row.key === key);
      return {
        ok: true,
        accepted: false,
        reason: 'duplicate',
        game: input.game,
        name: existing?.name ?? name,
        score: input.score,
        best: existing?.score ?? 0,
        attempts: existing?.attempts ?? 0,
        boards: snapshotOf(file),
      };
    }

    const rows = file.games[input.game] ?? [];
    const index = rows.findIndex((row) => row.key === key);
    const current = index >= 0 ? rows[index]! : null;
    const at = this.now();
    let accepted = false;
    let reason: 'best' | 'not_best' | 'below_board' = 'not_best';

    if (!current) {
      const lowest = rows.length >= BOARD_STORE ? rows[rows.length - 1]! : null;
      if (rows.length >= BOARD_STORE && lowest && input.score <= lowest.score) {
        reason = 'below_board';
      } else {
        rows.push({ name, key, score: input.score, attempts: 1, updatedAt: at });
        accepted = true;
        reason = 'best';
      }
    } else if (input.score > current.score) {
      current.score = input.score;
      current.name = name;
      current.attempts += 1;
      current.updatedAt = at;
      accepted = true;
      reason = 'best';
    } else {
      current.attempts += 1;
      reason = 'not_best';
    }

    rows.sort(byRank);
    file.games[input.game] = rows.slice(0, BOARD_STORE);
    file.seen.push(run);
    if (file.seen.length > 4000) file.seen.splice(0, file.seen.length - 4000);
    await this.store.save(file);

    const boards = snapshotOf(file);
    if (accepted) this.broadcast(boards);
    const stored = (file.games[input.game] ?? []).find((row) => row.key === key);
    return {
      ok: true,
      accepted,
      reason,
      game: input.game,
      name: stored?.name ?? name,
      score: input.score,
      best: stored?.score ?? 0,
      attempts: stored?.attempts ?? 0,
      boards,
    };
  }

  #allowName(key: string): boolean {
    const now = this.now();
    const windowMs = 60 * 60 * 1000;
    const hits = (this.#nameHits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (hits.length >= 20) {
      this.#nameHits.set(key, hits);
      return false;
    }
    hits.push(now);
    this.#nameHits.set(key, hits);
    return true;
  }
}
