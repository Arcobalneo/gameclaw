import { describe, expect, it } from 'vitest';
import { act, actionsOf, createRun, suggest } from '../src/engine';

function play(seed: number, policy: (state: ReturnType<typeof createRun>) => string) {
  const state = createRun({ seed });
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < 40) {
    act(state, policy(state));
    guard += 1;
  }
  return state;
}

describe('claw-delve engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(createRun({ seed: 4 })).toEqual(createRun({ seed: 4 }));
    expect(createRun({ seed: 1 }).oreCol).not.toEqual(createRun({ seed: 2 }).oreCol);
    expect(createRun({ seed: 3 }).rng).toHaveLength(4);
    const again = createRun({ seed: 8 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
  });

  it('lists compass steps so WASD digs', () => {
    const ids = actionsOf(createRun({ seed: 1 })).map((action) => action.id);
    expect(ids).toEqual(expect.arrayContaining(['step:w', 'step:e', 'step:s']));
    expect(ids).not.toContain('cut');
    const state = createRun({ seed: 1 });
    act(state, 'cut');
    expect(state.layer).toBe(1);
  });

  it('collapses an unbraced layer and loses on the next one', () => {
    const state = createRun({ seed: 1 });
    state.collapseLimit = 1;
    state.braces = 0;
    act(state, 'cut');
    expect(state.collapses).toBe(1);
    expect(state.outcome).toBe('ongoing');
    act(state, 'cut');
    expect(state.outcome).toBe('lost');
    expect(state.cause).toBe('井塌了');
  });

  it('names the ore when the next cell holds it', () => {
    const state = createRun({ seed: 1 });
    state.oreCol[0] = 2;
    state.col = 1;
    const right = actionsOf(state).find((action) => action.id === 'step:e');
    const left = actionsOf(state).find((action) => action.id === 'step:w');
    expect(right?.detail).toBe('向右一格有矿。横挖不会塌。');
    expect(left?.detail).toBe('在这一层向左挖开一格。横挖不会塌。');
  });

  it('lets bracing before the drop keep the layer', () => {
    const state = createRun({ seed: 2 });
    act(state, 'brace');
    act(state, 'cut');
    expect(state.collapses).toBe(0);
    expect(state.layer).toBe(1);
  });

  it('lets the careful line win more seeds than cutting straight down', () => {
    let careful = 0;
    let blind = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      if (play(seed, suggest).outcome === 'won') careful += 1;
      if (play(seed, () => 'cut').outcome === 'won') blind += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(8);
    expect(careful).toBeGreaterThan(blind);
  });
});
