import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { definition } from '../src/definition';
import { act, covered, createRun, ladderScore, suggest, visible } from '../src/engine';

function play(seed: number, policy: (state: ReturnType<typeof createRun>) => string) {
  const state = createRun({ seed });
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < 120) {
    act(state, policy(state));
    guard += 1;
  }
  return state;
}

describe('claw-mask engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(createRun({ seed: 7 })).toEqual(createRun({ seed: 7 }));
    expect(createRun({ seed: 3 }).ink).not.toEqual(createRun({ seed: 9 }).ink);
    expect(createRun({ seed: 1 }).rng).toHaveLength(4);
    const again = createRun({ seed: 4 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
  });

  it('shows ink inside the window and tide outside', () => {
    const state = createRun({ seed: 1 });
    state.ink = ['walk', 'gap', 'walk', 'walk', 'walk', 'walk', 'walk', 'walk'];
    state.tide = ['gap', 'walk', 'gap', 'gap', 'gap', 'gap', 'gap', 'gap'];
    state.mask = 0;
    expect(covered(0, 0)).toBe(true);
    expect(covered(0, 3)).toBe(false);
    expect(visible(state, 1)).toBe('gap');
    expect(visible(state, 3)).toBe('gap');
    state.mask = 1;
    expect(visible(state, 3)).toBe('walk');
  });

  it('falls through a gap and does not move', () => {
    const state = createRun({ seed: 2 });
    state.ink = Array.from({ length: 8 }, () => 'gap' as const);
    state.tide = Array.from({ length: 8 }, () => 'gap' as const);
    act(state, 'step');
    expect(state.falls).toBe(1);
    expect(state.pos).toBe(-1);
  });

  it('lets the careful line win more seeds than stepping blind', () => {
    let careful = 0;
    let blind = 0;
    for (let seed = 1; seed <= 8; seed += 1) {
      if (play(seed, suggest).outcome === 'won') careful += 1;
      if (play(seed, () => 'step').outcome === 'won') blind += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(6);
    expect(blind).toBeLessThan(careful);
  });

  it('scores zero on abort', () => {
    const session = MemorySession.create(definition, { seed: 5 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().score).toBe(0);
    const won = createRun({ seed: 1 });
    won.outcome = 'won';
    won.corridors = 4;
    won.slides = 5;
    won.falls = 0;
    expect(ladderScore(won)).toBe(4 * 90 - 20 + 360);
  });
});
