import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { definition } from '../src/definition';
import { act, createRun, isSafe, ladderScore, suggest } from '../src/engine';

function play(seed: number, policy: (state: ReturnType<typeof createRun>) => string) {
  const state = createRun({ seed });
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < 100) {
    act(state, policy(state));
    guard += 1;
  }
  return state;
}

describe('claw-flip engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(createRun({ seed: 7 })).toEqual(createRun({ seed: 7 }));
    expect(createRun({ seed: 1 }).tiles).not.toEqual(createRun({ seed: 2 }).tiles);
    expect(createRun({ seed: 3 }).rng).toHaveLength(4);
    const again = createRun({ seed: 4 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
    expect(again.tiles[0]).toBe('plate');
    expect(again.tiles).toContain('stone');
  });

  it('swaps plates and gaps and never makes a stone safe', () => {
    expect(isSafe('plate', false)).toBe(true);
    expect(isSafe('plate', true)).toBe(false);
    expect(isSafe('gap', true)).toBe(true);
    expect(isSafe('stone', false)).toBe(false);
    expect(isSafe('stone', true)).toBe(false);
    const state = createRun({ seed: 1 });
    act(state, 'flip');
    expect(state.flipped).toBe(true);
    expect(state.flips).toBe(1);
  });

  it('wounds a step onto a stone and hops over it', () => {
    const state = createRun({ seed: 1 });
    state.tiles = ['plate', 'stone', 'plate', 'plate', 'plate', 'plate', 'plate', 'plate'];
    state.stages = 1;
    state.springs = 1;
    act(state, 'step');
    expect(state.pos).toBe(0);
    act(state, 'hop');
    expect(state.pos).toBe(2);
    expect(state.springs).toBe(0);
  });

  it('lets the careful line win more seeds than stepping blind', () => {
    let careful = 0;
    let blind = 0;
    for (let seed = 1; seed <= 10; seed += 1) {
      if (play(seed, suggest).outcome === 'won') careful += 1;
      if (play(seed, () => 'step').outcome === 'won') blind += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(7);
    expect(blind).toBeLessThan(careful);
  });

  it('scores zero on abort', () => {
    const session = MemorySession.create(definition, { seed: 8 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().score).toBe(0);
    const won = createRun({ seed: 1 });
    won.outcome = 'won';
    won.stages = 4;
    won.springs = 1;
    won.wounds = 0;
    won.flips = 6;
    expect(ladderScore(won)).toBe(400 + 20 - 36 + 320);
  });
});
