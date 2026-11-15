import { describe, expect, it } from 'vitest';
import { act, actionsOf, createRun, forecastStep, suggest } from '../src/engine';

function play(seed: number, policy: (state: ReturnType<typeof createRun>) => string) {
  const state = createRun({ seed });
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < 30) {
    const id = policy(state);
    const legal = state.outcome === 'ongoing';
    if (!legal) break;
    try {
      act(state, id);
    } catch {
      break;
    }
    guard += 1;
  }
  return state;
}

describe('claw-reef engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(createRun({ seed: 3 })).toEqual(createRun({ seed: 3 }));
    expect(createRun({ seed: 1 }).goals).not.toEqual(createRun({ seed: 2 }).goals);
    expect(createRun({ seed: 4 }).rng).toHaveLength(4);
    const again = createRun({ seed: 7 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
  });

  it('counts a goal only after the push, and an anchor stays put', () => {
    const state = createRun({ seed: 1 });
    state.goals = [[1, 1]];
    state.x = 1;
    state.y = 1;
    state.tide = 0;
    act(state, 'anchor');
    expect(state.got).toEqual(['1,1']);
    expect(state.x).toBe(1);
    expect(state.anchors).toBe(3);
  });

  it('says whether the landing is still an open mark', () => {
    const state = createRun({ seed: 1 });
    state.x = 1;
    state.y = 1;
    state.tide = 0;
    state.goals = [[3, 1]];
    state.got = [];
    state.urchins = [];
    const east = actionsOf(state).find((action) => action.id === 'step:e');
    expect(east?.detail).toContain('还没踩的标');
    state.goals = [[1, 2]];
    const empty = actionsOf(state).find((action) => action.id === 'step:e');
    expect(empty?.detail).toContain('没有标');
  });

  it('forecasts the cell you occupy after the tide', () => {
    const state = createRun({ seed: 1 });
    state.x = 1;
    state.y = 1;
    state.tide = 0;
    state.urchins = [[3, 1]];
    expect(forecastStep(state, 'e')).toEqual({ x: 3, y: 1, kind: 'urchin' });
    expect(forecastStep(state, 's')?.kind).toBe('open');
  });

  it('sweeps when the tide pushes into a wall', () => {
    const state = createRun({ seed: 1 });
    state.x = 5;
    state.y = 1;
    state.tide = 0;
    act(state, 'step:e');
    expect(state.swept).toBe(1);
    expect(state.x).toBe(6);
  });

  it('stings an urchin after the push and lets an anchor brace it', () => {
    const state = createRun({ seed: 1 });
    state.goals = [[1, 2]];
    state.urchins = [[3, 1]];
    state.x = 1;
    state.y = 1;
    state.tide = 0;
    state.got = [];
    act(state, 'step:e');
    expect(state.x).toBe(3);
    expect(state.y).toBe(1);
    expect(state.swept).toBe(1);
    expect(state.outcome).toBe('ongoing');
    state.swept = 0;
    state.tide = 0;
    const anchors = state.anchors;
    act(state, 'anchor');
    expect(state.swept).toBe(0);
    expect(state.x).toBe(3);
    expect(state.anchors).toBe(anchors - 1);
  });

  it('pushes two cells once half the tides have passed', () => {
    const state = createRun({ seed: 1 });
    state.tide = Math.floor(state.tideCap / 2);
    state.tide += (4 - (state.tide % 4)) % 4;
    state.x = 1;
    state.y = 1;
    state.urchins = [];
    act(state, 'step:e');
    expect(state.x).toBe(4);
    expect(state.y).toBe(1);
  });

  it('lets the careful line win more seeds than always stepping east', () => {
    let careful = 0;
    let east = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      if (play(seed, suggest).outcome === 'won') careful += 1;
      if (play(seed, () => 'step:e').outcome === 'won') east += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(8);
    expect(careful).toBeGreaterThan(east);
  });
});
