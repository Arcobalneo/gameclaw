import { describe, expect, it } from 'vitest';
import { HeadlessDesk } from '../src/headless';
import { LeaderboardCore, MemoryBoardStore } from '../src/leaderboard';
import { legacyGameId } from '../src/games';
import { generateSessionId } from '../src/ids';
import { hashPlayer, MemoryStatsStore, PlayStatsCore } from '../src/stats';

const trek = 'claw-trek';
const guard = 'claw-guard';

describe('legacy game ids', () => {
  it('folds a leaderboard stored under the former id and accepts that id on submit', async () => {
    const old = legacyGameId(trek);
    expect(old).toBeTruthy();
    const store = new MemoryBoardStore();
    store.file.games[old!] = [{ name: 'Ace', key: 'ace', score: 400, attempts: 2, updatedAt: 5 }];
    store.file.games[trek] = [{ name: 'Ace', key: 'ace', score: 100, attempts: 1, updatedAt: 1 }];
    const core = new LeaderboardCore(store, () => 9);
    const snap = await core.get();
    expect(snap.games[trek]?.[0]).toMatchObject({ name: 'Ace', score: 400, attempts: 3 });
    expect(snap.games[old!]).toBeUndefined();
    expect(store.file.games[old!]).toBeUndefined();

    const submitted = await core.submit(
      {
        name: 'Bea',
        game: old!,
        score: 50,
        outcome: 'won',
        turn: 3,
        run: 'run-legacy-xxxxxxxx',
      },
      '1.1.1.1',
    );
    expect(submitted.ok).toBe(true);
    if (submitted.ok) expect(submitted.game).toBe(trek);
    expect(store.file.games[trek]?.some((row) => row.name === 'Bea')).toBe(true);
  });

  it('keeps a play count stored under the former id and does not count that player again', async () => {
    const old = legacyGameId(guard);
    expect(old).toBeTruthy();
    const store = new MemoryStatsStore();
    store.setGame(old!, 4);
    const player = generateSessionId();
    store.markSeen(`p:${await hashPlayer(player)}:${old}`);
    const core = new PlayStatsCore(store);
    const counts = await core.get();
    expect(counts.games[guard]).toBe(4);
    expect(counts.games[old!]).toBeUndefined();

    const again = await core.hello(player, old, '9.9.9.9');
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.counts.games[guard]).toBe(4);
    expect(store.getGame(old!)).toBe(0);
  });

  it('plays a former id on the headless desk and restores a desk stored under that id', () => {
    const old = legacyGameId('claw-leap');
    expect(old).toBeTruthy();
    const desk = new HeadlessDesk();
    const started = desk.call('new_game', { game_id: old!, seed: 7 });
    expect(started).toMatchObject({ ok: true, game_id: 'claw-leap' });
    const exported = desk.exportDesk();
    expect(exported.focused).toBe('claw-leap');
    expect(exported.games[old!]).toBeUndefined();

    const stored = structuredClone(exported);
    const slot = stored.games['claw-leap'];
    expect(slot).toBeTruthy();
    stored.focused = old;
    stored.games[old!] = slot!;
    delete stored.games['claw-leap'];
    (stored.games[old!]!.snapshot as { game: string }).game = old!;

    const restored = new HeadlessDesk();
    expect(restored.load(stored)).toBe(true);
    const out = restored.exportDesk();
    expect(out.focused).toBe('claw-leap');
    expect(out.games['claw-leap']?.snapshot.game).toBe('claw-leap');
    expect(out.games[old!]).toBeUndefined();
    expect(restored.load(out)).toBe(false);
  });
});
