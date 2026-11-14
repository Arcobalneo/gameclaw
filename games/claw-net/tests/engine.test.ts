import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import type { Knot } from '../src/content';
import { definition } from '../src/definition';
import {
  act,
  actionsOf,
  countKind,
  createRun,
  fishOf,
  ladderScore,
  type NetState,
  pulse,
  suggest,
} from '../src/engine';

function fresh(seed = 7, difficulty?: string): NetState {
  return createRun({ seed, difficulty });
}

function play(state: NetState, limit = 80): NetState {
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < limit) {
    act(state, suggest(state));
    guard += 1;
  }
  return state;
}

describe('claw-net engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(fresh(7)).toEqual(fresh(7));
    expect(fresh(7).cells).not.toEqual(fresh(9).cells);
    expect(fresh(2).rng).toHaveLength(4);
    const again = fresh(4);
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
    expect(countKind(fresh(1).cells, 'torn')).toBe(5);
  });

  it('wets a sound knot between two tears and rips a wet knot on the next pulse', () => {
    const cells: Knot[] = Array.from({ length: 20 }, () => 'tied');
    cells[0] = 'torn';
    cells[2] = 'torn';
    const once = pulse(cells);
    expect(once.cells[1]).toBe('wet');
    const twice = pulse(once.cells);
    expect(twice.cells[1]).toBe('torn');
  });

  it('dries a wet knot that no longer touches a tear', () => {
    const cells: Knot[] = Array.from({ length: 20 }, () => 'tied');
    cells[6] = 'wet';
    expect(pulse(cells).cells[6]).toBe('tied');
  });

  it('scores a haul from sound knots and spends thread on a tie', () => {
    const state = fresh(3);
    const before = fishOf(state.cells);
    const torn = state.cells.indexOf('torn');
    expect(torn).toBeGreaterThanOrEqual(0);
    const x = torn % 5;
    const y = Math.floor(torn / 5);
    act(state, `tie:${x}:${y}`);
    expect(state.thread).toBe(2);
    act(state, 'haul');
    expect(state.basket).toBeGreaterThan(0);
    expect(state.night).toBe(2);
    expect(before).toBeGreaterThan(0);
  });

  it('rips at eight tears and refuses a tie with no thread', () => {
    const state = fresh(4);
    state.thread = 0;
    expect(actionsOf(state).some((action) => action.id.startsWith('tie:'))).toBe(false);
    state.thread = 3;
    for (let i = 0; i < 9; i += 1) state.cells[i] = 'torn';
    act(state, 'tie:0:0');
    expect(state.outcome).toBe('lost');
    expect(state.cause).toBe('网破了');
  });

  it('lets a mending policy clear more seeds than hauling immediately', () => {
    let mended = 0;
    let rushed = 0;
    for (let seed = 1; seed <= 16; seed += 1) {
      if (play(fresh(seed)).outcome === 'won') mended += 1;
      const rush = fresh(seed);
      let guard = 0;
      while (rush.outcome === 'ongoing' && guard < 8) {
        act(rush, 'haul');
        guard += 1;
      }
      if (rush.outcome === 'won') rushed += 1;
    }
    expect(mended).toBeGreaterThanOrEqual(10);
    expect(rushed).toBeLessThan(mended);
    let ordered = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      const state = fresh(seed);
      let guard = 0;
      while (state.outcome === 'ongoing' && guard < 80) {
        const index =
          state.thread > 0
            ? state.cells.findIndex((cell) => cell === 'torn' || cell === 'wet')
            : -1;
        const id = index >= 0 ? `tie:${index % 5}:${Math.floor(index / 5)}` : 'haul';
        act(state, id);
        guard += 1;
      }
      if (state.outcome === 'won') ordered += 1;
    }
    expect(ordered).toBeLessThanOrEqual(3);
  });

  it('scores zero on abort and pays the documented win formula', () => {
    const session = MemorySession.create(definition, { seed: 5 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().score).toBe(0);
    const state = fresh(1);
    state.outcome = 'won';
    state.basket = 40;
    state.thread = 2;
    state.cuts = 1;
    expect(ladderScore(state)).toBe(40 * 12 + 12 - 18 + 340);
  });
});
