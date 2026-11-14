import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { WELL_W } from '../src/content';
import { definition } from '../src/definition';
import {
  act,
  actionsOf,
  createRun,
  fall,
  ladderScore,
  type MeltState,
  previewDrop,
  resolve,
  suggest,
  tilt,
} from '../src/engine';

function fresh(seed = 7, difficulty?: string): MeltState {
  return createRun({ seed, difficulty });
}

function play(state: MeltState, limit = 40): MeltState {
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < limit) {
    const id = suggest(state);
    expect(actionsOf(state).some((action) => action.id === id)).toBe(true);
    act(state, id);
    guard += 1;
  }
  return state;
}

describe('claw-melt engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(fresh(7)).toEqual(fresh(7));
    expect(fresh(7).piece).not.toBeUndefined();
    expect(fresh(3).rng).toHaveLength(4);
    const again = fresh(4);
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
  });

  it('melts a touching pair into the next size and lets it fall', () => {
    const cells = Array.from({ length: 36 }, () => 0);
    cells[5 * WELL_W + 0] = 2;
    cells[5 * WELL_W + 1] = 2;
    const resolved = resolve(cells);
    expect(resolved.merges).toBe(1);
    expect(cells[5 * WELL_W + 0]).toBe(3);
    expect(cells[5 * WELL_W + 1]).toBe(0);
    const stacked = Array.from({ length: 36 }, () => 0);
    stacked[5 * WELL_W + 2] = 2;
    stacked[4 * WELL_W + 2] = 2;
    expect(resolve(stacked).merges).toBe(0);
    fall(cells);
    expect(cells[5 * WELL_W + 0]).toBe(3);
  });

  it('slides a taller top toward a shorter neighbor and spills a tall edge', () => {
    const cells = Array.from({ length: 36 }, () => 0);
    cells[5 * WELL_W + 0] = 1;
    cells[4 * WELL_W + 0] = 1;
    cells[3 * WELL_W + 0] = 1;
    cells[5 * WELL_W + 1] = 1;
    const spilled = tilt(cells, -1);
    expect(spilled).toBe(1);
    expect(cells[3 * WELL_W + 0]).toBe(0);
  });

  it('publishes a preview that matches the drop', () => {
    const state = fresh(9);
    const preview = previewDrop(state, 2);
    expect(preview).not.toBeNull();
    const before = state.points;
    act(state, 'drop:2');
    expect(state.drops).toBe(1);
    expect(state.points - before).toBe(preview?.points);
    expect(state.last?.spill).toBe(preview?.spill);
  });

  it('rejects a full column and ends when the mouth is plugged', () => {
    const state = fresh(2);
    for (let y = 0; y < 6; y += 1) state.cells[y * WELL_W + 0] = 1;
    expect(actionsOf(state).some((action) => action.id === 'drop:0')).toBe(false);
    expect(() => act(state, 'drop:0')).toThrow(/落不进去/);
  });

  it('wins a careful well more often than stacking a single column', () => {
    let careful = 0;
    let stack = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      if (play(fresh(seed)).outcome === 'won') careful += 1;
      const greedy = fresh(seed);
      let guard = 0;
      while (greedy.outcome === 'ongoing' && guard < 40) {
        const actions = actionsOf(greedy);
        const pick = actions.find((action) => action.id === 'drop:0') ?? actions[0];
        if (!pick) break;
        act(greedy, pick.id);
        guard += 1;
      }
      if (greedy.outcome === 'won') stack += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(8);
    expect(stack).toBeLessThan(careful);
  });

  it('scores zero on an abort and a positive integer after a finished run', () => {
    const session = MemorySession.create(definition, { seed: 6 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().score).toBe(0);
    const state = fresh(8);
    state.outcome = 'won';
    state.cause = '撑过潮井';
    state.points = 120;
    state.bestChain = 2;
    state.maxSize = 5;
    state.spilled = 1;
    expect(ladderScore(state)).toBe(120 + 56 + 150 - 22 + 380);
  });
});
