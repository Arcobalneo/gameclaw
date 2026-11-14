import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { definition } from '../src/definition';
import { act, createRun, ladderScore, suggest } from '../src/engine';

function play(seed: number, policy: (state: ReturnType<typeof createRun>) => string) {
  const state = createRun({ seed });
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < 30) {
    act(state, policy(state));
    guard += 1;
  }
  return state;
}

describe('claw-berth engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(createRun({ seed: 7 })).toEqual(createRun({ seed: 7 }));
    expect(createRun({ seed: 1 }).current).not.toEqual(createRun({ seed: 2 }).current);
    expect(createRun({ seed: 3 }).rng).toHaveLength(4);
    const again = createRun({ seed: 4 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
  });

  it('refuses a berth that is too shallow and counts adjacent hazards', () => {
    const state = createRun({ seed: 1 });
    state.current = { draft: 3, hazard: true, value: 4, patience: 4 };
    state.berths[3] = { left: 2, value: 3, hazard: true };
    expect(state.depths[0]).toBe(1);
    act(state, 'tug:2');
    expect(state.berths[2]?.hazard).toBe(true);
    expect(state.incidents).toBe(1);
  });

  it('lets the harbor line win more often than only waiting', () => {
    let careful = 0;
    let waited = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      if (play(seed, suggest).outcome === 'won') careful += 1;
      if (play(seed, () => 'wait').outcome === 'won') waited += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(8);
    expect(waited).toBeLessThan(careful);
  });

  it('scores zero on abort', () => {
    const session = MemorySession.create(definition, { seed: 9 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().score).toBe(0);
    const won = createRun({ seed: 1 });
    won.outcome = 'won';
    won.cargo = 14;
    won.sailed = 4;
    won.angry = 0;
    won.incidents = 0;
    expect(ladderScore(won)).toBe(14 * 12 + 4 * 15 + 320);
  });
});
