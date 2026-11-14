import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { definition } from '../src/definition';
import { act, createRun, ladderScore, suggest } from '../src/engine';

function play(seed: number, policy: (state: ReturnType<typeof createRun>) => string) {
  const state = createRun({ seed });
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < 80) {
    act(state, policy(state));
    guard += 1;
  }
  return state;
}

describe('claw-count engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(createRun({ seed: 7 })).toEqual(createRun({ seed: 7 }));
    expect(createRun({ seed: 7 }).tiles).not.toEqual(createRun({ seed: 8 }).tiles);
    expect(createRun({ seed: 1 }).rng).toHaveLength(4);
    const again = createRun({ seed: 4 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
    expect(again.tiles[0]).toContain(0);
  });

  it('steps a matching plank and falls when the number is wrong', () => {
    const state = createRun({ seed: 1 });
    state.tiles = [
      [0, 1],
      [2, 3],
    ];
    state.count = 0;
    act(state, 'step');
    expect(state.pos).toBe(1);
    expect(state.falls).toBe(0);
    act(state, 'step');
    expect(state.falls).toBe(1);
    expect(state.pos).toBe(0);
  });

  it('crosses a blank plank only with a magnet', () => {
    const opened = createRun({ seed: 5 });
    expect(opened.tiles.every((tile) => tile.length > 0)).toBe(true);
    const state = createRun({ seed: 5 });
    while (state.level < 2 && state.outcome === 'ongoing') act(state, suggest(state));
    expect(state.level).toBe(2);
    expect(state.tiles.filter((tile) => tile.length === 0)).toHaveLength(1);
    const index = state.tiles.findIndex((tile) => tile.length === 0);
    while (state.pos < index && state.outcome === 'ongoing') act(state, suggest(state));
    expect(state.pos).toBe(index);
    expect(suggest(state)).toBe('magnet');
    const before = state.magnets;
    act(state, 'step');
    expect(state.falls).toBe(1);
    state.tiles = [[]];
    state.pos = 0;
    state.falls = 0;
    state.magnets = before;
    act(state, 'magnet');
    expect(state.magnets).toBe(before - 1);
    expect(state.falls).toBe(0);
  });

  it('spends a magnet to cross an unsafe plank', () => {
    const state = createRun({ seed: 2 });
    state.tiles = [[2, 3]];
    state.count = 0;
    state.magnets = 1;
    state.levels = 1;
    act(state, 'magnet');
    expect(state.outcome).toBe('won');
    expect(state.magnets).toBe(0);
  });

  it('lets the careful line win more seeds than stepping blind', () => {
    let careful = 0;
    let blind = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      if (play(seed, suggest).outcome === 'won') careful += 1;
      if (play(seed, () => 'step').outcome === 'won') blind += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(8);
    expect(blind).toBeLessThan(careful);
  });

  it('scores zero on abort and uses the win formula', () => {
    const session = MemorySession.create(definition, { seed: 3 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().score).toBe(0);
    const won = createRun({ seed: 1 });
    won.outcome = 'won';
    won.levels = 4;
    won.magnets = 1;
    won.falls = 0;
    won.changes = 5;
    expect(ladderScore(won)).toBe(4 * 90 + 35 - 20 + 380);
  });
});
