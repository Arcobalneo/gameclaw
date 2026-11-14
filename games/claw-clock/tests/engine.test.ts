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

describe('claw-clock engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(createRun({ seed: 7 })).toEqual(createRun({ seed: 7 }));
    expect(createRun({ seed: 2 }).ring).not.toEqual(createRun({ seed: 3 }).ring);
    expect(createRun({ seed: 1 }).rng).toHaveLength(4);
    const again = createRun({ seed: 4 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
    expect(again.ring.filter((token) => token === 'foe')).toHaveLength(2);
  });

  it('eats a foe placed on the next cell and wounds you there', () => {
    const state = createRun({ seed: 1 });
    state.hand = 0;
    state.ring = ['empty', 'foe', 'you', 'gem', 'empty', 'empty', 'empty', 'foe'];
    act(state, 'cross');
    expect(state.kills + state.wounds + state.shattered).toBeGreaterThan(0);
  });

  it('clears a ring when the last foe is eaten', () => {
    const state = createRun({ seed: 1 });
    state.rings = 1;
    state.hand = 0;
    state.ring = ['you', 'foe', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'];
    state.stepCap = 8;
    let guard = 0;
    while (state.outcome === 'ongoing' && guard < 12) {
      act(state, suggest(state));
      guard += 1;
    }
    expect(state.outcome).toBe('won');
    expect(state.kills).toBeGreaterThanOrEqual(1);
  });

  it('lets the careful line win more seeds than always turning one way', () => {
    let careful = 0;
    let spin = 0;
    for (let seed = 1; seed <= 8; seed += 1) {
      if (play(seed, suggest).outcome === 'won') careful += 1;
      if (play(seed, () => 'rotate:1').outcome === 'won') spin += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(5);
    expect(spin).toBeLessThan(careful);
  });

  it('scores zero on abort', () => {
    const session = MemorySession.create(definition, { seed: 6 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().score).toBe(0);
    const won = createRun({ seed: 1 });
    won.outcome = 'won';
    won.rings = 4;
    won.kills = 8;
    won.shattered = 1;
    won.wounds = 0;
    expect(ladderScore(won)).toBe(400 + 96 - 28 + 340);
  });
});
