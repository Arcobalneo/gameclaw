import { MemorySession } from '@gameclaw/gamekit';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { legacyGameId } from '../../relay/src/games';
import { findGame } from '../src/catalog';
import { applyDesk } from '../src/runtime/follow';
import { GameHost } from '../src/runtime/host';
import { foldBoards } from '../src/runtime/leaderboard';
import { loadGame } from '../src/runtime/registry';
import { foldCounts } from '../src/runtime/stats';

class MemoryStorage {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

const storage = new MemoryStorage();
const previous = globalThis.localStorage;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

afterEach(() => storage.map.clear());
afterAll(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
});

describe('legacy game ids on the page', () => {
  it('resolves a former id to the current catalog entry', () => {
    const old = legacyGameId('claw-trek');
    expect(old).toBeTruthy();
    expect(findGame(old!)?.id).toBe('claw-trek');
    expect(findGame('claw-trek')?.englishName).toBe('Claw Trek');
    expect(findGame('not-a-game')).toBeUndefined();
  });

  it('restores a local save stored under the former id and moves the key', async () => {
    const mod = await loadGame('claw-trek');
    const session = MemorySession.create(mod.definition, {
      seed: 11,
      now: '2026-01-01T00:00:00.000Z',
    });
    const action = session.actions().find((item) => item.id !== 'abort');
    expect(action).toBeTruthy();
    session.act(action!.id);
    const old = legacyGameId('claw-trek')!;
    const snapshot = structuredClone(session.snapshot);
    snapshot.game = old;
    storage.setItem(`gameclaw:v3:${old}`, JSON.stringify({ snapshot, log: [] }));

    const host = GameHost.fromModule(mod);
    expect(host.id).toBe('claw-trek');
    expect(host.session.snapshot.game).toBe('claw-trek');
    expect(host.session.snapshot.turn).toBe(session.snapshot.turn);
    expect(storage.getItem(`gameclaw:v3:${old}`)).toBeNull();
    expect(storage.getItem('gameclaw:v3:claw-trek')).toContain('"game":"claw-trek"');
  });

  it('adopts a watch snapshot whose game field is still the former id', async () => {
    const mod = await loadGame('claw-leap');
    const host = GameHost.fromModule(mod, { persist: false });
    const snapshot = structuredClone(host.session.snapshot);
    snapshot.game = legacyGameId('claw-leap')!;
    snapshot.turn = host.session.snapshot.turn + 1;
    expect(host.adopt(snapshot, [])).toBe(true);
    expect(host.session.snapshot.game).toBe('claw-leap');
    expect(host.session.snapshot.turn).toBe(snapshot.turn);
  });

  it('opens the current id when a watch desk is still keyed by the former id', async () => {
    const mod = await loadGame('claw-burger');
    const session = MemorySession.create(mod.definition, {
      seed: 4,
      now: '2026-01-02T00:00:00.000Z',
    });
    const old = legacyGameId('claw-burger')!;
    const snapshot = structuredClone(session.snapshot);
    snapshot.game = old;
    const opened: string[] = [];
    await applyDesk(
      {
        async open(id) {
          opened.push(id);
          return GameHost.fromModule(mod, { persist: false });
        },
        close() {},
        focused: () => opened.at(-1) ?? null,
      },
      {
        focused: old,
        lang: 'en',
        games: { [old]: { snapshot, log: [] } },
      },
    );
    expect(opened).toEqual(['claw-burger']);
  });

  it('folds cached play counts and boards onto the current id', () => {
    const old = legacyGameId('claw-ink')!;
    expect(foldCounts({ site: 3, games: { [old]: 2, 'claw-ink': 1 } })).toEqual({
      site: 3,
      games: { 'claw-ink': 3 },
    });
    const row = { name: 'Ace', score: 9, attempts: 1, updatedAt: 1 };
    expect(
      foldBoards({ rule: 'best-per-game', games: { [old]: [row] }, total: [row] }).games['claw-ink'],
    ).toEqual([row]);
  });
});
