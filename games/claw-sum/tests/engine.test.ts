import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { definition } from '../src/definition';
import { act, applyOp, createRun, ladderScore, suggest } from '../src/engine';

function play(seed: number, policy: (state: ReturnType<typeof createRun>) => string) {
  const state = createRun({ seed });
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < 40) {
    act(state, policy(state));
    guard += 1;
  }
  return state;
}

describe('claw-sum engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(createRun({ seed: 6 })).toEqual(createRun({ seed: 6 }));
    expect(createRun({ seed: 1 }).target).not.toBe(createRun({ seed: 2 }).target);
    expect(createRun({ seed: 3 }).rng).toHaveLength(4);
    const again = createRun({ seed: 4 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
  });

  it('refuses to halve an odd number and lands an exact add', () => {
    expect(applyOp(3, 'half')).toBeNull();
    const state = createRun({ seed: 1 });
    state.value = 4;
    state.target = 6;
    state.stages = 1;
    act(state, 'add2');
    expect(state.outcome).toBe('won');
    expect(state.exacts).toBe(1);
  });

  it('lets the search win more seeds than always doubling', () => {
    let careful = 0;
    let doubled = 0;
    for (let seed = 1; seed <= 10; seed += 1) {
      if (play(seed, suggest).outcome === 'won') careful += 1;
      if (play(seed, () => 'double').outcome === 'won') doubled += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(8);
    expect(doubled).toBeLessThan(careful);
  });

  it('scores zero on abort', () => {
    const session = MemorySession.create(definition, { seed: 8 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().score).toBe(0);
    const won = createRun({ seed: 1 });
    won.outcome = 'won';
    won.exacts = 4;
    won.misses = 0;
    expect(ladderScore(won)).toBe(4 * 80 + 340);
  });
});
