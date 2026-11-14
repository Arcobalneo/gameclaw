import { describe, expect, it } from 'vitest';
import { act, createRun, suggest } from '../src/engine';

function play(seed: number, policy: (state: ReturnType<typeof createRun>) => string) {
  const state = createRun({ seed });
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < 20) {
    act(state, policy(state));
    guard += 1;
  }
  return state;
}

describe('claw-fair engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(createRun({ seed: 5 })).toEqual(createRun({ seed: 5 }));
    expect(createRun({ seed: 1 }).purse).not.toBe(createRun({ seed: 9 }).purse);
    expect(createRun({ seed: 3 }).rng).toHaveLength(4);
    const again = createRun({ seed: 6 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
  });

  it('does not move yesterday when a raise is refused', () => {
    const state = createRun({ seed: 1 });
    state.yesterday = 4;
    state.purse = 4;
    state.stock = 1;
    act(state, 'raise');
    expect(state.walkaways).toBe(1);
    expect(state.yesterday).toBe(4);
  });

  it('drops to the purse and sells', () => {
    const state = createRun({ seed: 1 });
    state.yesterday = 6;
    state.purse = 3;
    state.stock = 1;
    act(state, 'cut');
    expect(state.served).toBe(1);
    expect(state.yesterday).toBe(3);
    expect(state.coins).toBe(3);
  });

  it('lets the careful line win more often than always raising', () => {
    let careful = 0;
    let raised = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      if (play(seed, suggest).outcome === 'won') careful += 1;
      if (play(seed, (state) => (state.stock > 0 ? 'raise' : 'restock')).outcome === 'won')
        raised += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(8);
    expect(careful).toBeGreaterThan(raised);
  });
});
