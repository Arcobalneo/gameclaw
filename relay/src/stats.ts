import { GAME_IDS, legacyGameId, resolveGameId, type GameId } from './games';
import { isSessionId } from './ids';
import { TokenBucket } from './rate-limit';
import type { SocketLike } from './room';

export interface PlayCounts {
  site: number;
  games: Record<string, number>;
}

export interface StatsStore {
  getSite(): Promise<number> | number;
  setSite(n: number): Promise<void> | void;
  getGame(id: string): Promise<number> | number;
  setGame(id: string, n: number): Promise<void> | void;
  hasSeen(key: string): Promise<boolean> | boolean;
  markSeen(key: string): Promise<void> | void;
}

/** In-memory store for tests and the local Bun server. */
export class MemoryStatsStore implements StatsStore {
  site = 0;
  readonly games = new Map<string, number>();
  readonly seen = new Set<string>();

  getSite(): number {
    return this.site;
  }
  setSite(n: number): void {
    this.site = n;
  }
  getGame(id: string): number {
    return this.games.get(id) ?? 0;
  }
  setGame(id: string, n: number): void {
    this.games.set(id, n);
  }
  hasSeen(key: string): boolean {
    return this.seen.has(key);
  }
  markSeen(key: string): void {
    this.seen.add(key);
  }
}

const textEncoder = new TextEncoder();

export async function hashPlayer(id: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', textEncoder.encode(`gameclaw:play:${id}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class PlayStatsCore {
  readonly sockets = new Set<SocketLike>();
  readonly #helloLimit = new TokenBucket(30, 30 / 60);
  readonly #newPlayerLimit = new TokenBucket(8, 8 / 600);

  constructor(readonly store: StatsStore) {}

  /** Move counts stored under a former id onto the current id. Seen-keys stay. */
  async #fold(): Promise<void> {
    for (const id of GAME_IDS) {
      const old = legacyGameId(id);
      if (!old) continue;
      const n = await this.store.getGame(old);
      if (n <= 0) continue;
      await this.store.setGame(id, (await this.store.getGame(id)) + n);
      await this.store.setGame(old, 0);
    }
  }

  async get(): Promise<PlayCounts> {
    await this.#fold();
    const games: Record<string, number> = {};
    for (const id of GAME_IDS) {
      const n = await this.store.getGame(id);
      if (n > 0) games[id] = n;
    }
    return { site: await this.store.getSite(), games };
  }

  /**
   * Record a unique anonymous player (and optionally a game they opened).
   * Idempotent per player / player+game. Floods of new ids from one IP are ignored.
   */
  async hello(
    playerId: string,
    game: string | undefined,
    ip: string,
  ): Promise<{ ok: true; counts: PlayCounts } | { ok: false; error: string; status: number }> {
    if (!isSessionId(playerId)) return { ok: false, error: 'Invalid player id.', status: 400 };
    let gameId: GameId | undefined;
    if (game !== undefined) {
      const resolved = resolveGameId(game);
      if (!resolved) return { ok: false, error: 'Unknown game.', status: 400 };
      gameId = resolved;
    }
    if (!this.#helloLimit.take(`hello:${ip}`))
      return { ok: false, error: 'Too many requests. Try again in a minute.', status: 429 };

    await this.#fold();
    const hash = await hashPlayer(playerId);
    const siteKey = `p:${hash}`;
    let changed = false;
    const alreadySite = await this.store.hasSeen(siteKey);
    if (!alreadySite) {
      if (!this.#newPlayerLimit.take(`new:${ip}`)) {
        // Ignore spoofed floods: do not increment, still return current counts.
        return { ok: true, counts: await this.get() };
      }
      await this.store.markSeen(siteKey);
      await this.store.setSite((await this.store.getSite()) + 1);
      changed = true;
    }
    if (gameId) {
      const old = legacyGameId(gameId);
      const gameKey = `p:${hash}:${gameId}`;
      const seen =
        (await this.store.hasSeen(gameKey)) ||
        (old !== undefined && (await this.store.hasSeen(`p:${hash}:${old}`)));
      if (!seen) {
        await this.store.markSeen(gameKey);
        await this.store.setGame(gameId, (await this.store.getGame(gameId)) + 1);
        changed = true;
      }
    }
    const counts = await this.get();
    if (changed) this.broadcast(counts);
    return { ok: true, counts };
  }

  attach(socket: SocketLike): void {
    this.sockets.add(socket);
  }

  async welcome(socket: SocketLike): Promise<void> {
    this.attach(socket);
    const counts = await this.get();
    if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'stats', ...counts }));
  }

  detach(socket: SocketLike): void {
    this.sockets.delete(socket);
  }

  broadcast(counts: PlayCounts): void {
    const raw = JSON.stringify({ type: 'stats', ...counts });
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
}
