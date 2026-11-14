import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { definition } from '../src/definition';
import { act, createRun, ladderScore, type RaftState, suggest } from '../src/engine';

function play(seed: number, policy: (state: RaftState) => string) {
  const state = createRun({ seed });
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < 40) {
    act(state, policy(state));
    guard += 1;
  }
  return state;
}

describe('claw-raft engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(createRun({ seed: 7 })).toEqual(createRun({ seed: 7 }));
    expect(createRun({ seed: 7 }).crates).not.toEqual(createRun({ seed: 8 }).crates);
    expect(createRun({ seed: 1 }).rng).toHaveLength(4);
    const again = createRun({ seed: 4 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
  });

  it('dumps the heavy side and can capsize', () => {
    const state = createRun({ seed: 1 });
    state.crates[0] = { w: 2, pref: 'port' };
    state.holds = { port: 2, mid: 0, starboard: 0 };
    state.gust = 0;
    act(state, 'port');
    expect(state.outcome).toBe('ongoing');
    expect(state.dumps).toBe(1);
    expect(state.holds.port).toBe(2);
    state.holds = { port: 4, mid: 0, starboard: 0 };
    state.gust = 1;
    const crate = state.crates[state.index];
    if (crate) crate.w = 3;
    act(state, 'port');
    expect(state.outcome).toBe('lost');
    expect(state.cause).toBe('筏翻了');
  });

  it('lets the careful line deliver more often than always using port', () => {
    let careful = 0;
    let blind = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      if (play(seed, suggest).outcome === 'won') careful += 1;
      if (play(seed, () => 'port').outcome === 'won') blind += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(8);
    expect(blind).toBeLessThan(careful);
  });

  it('scores zero on abort and uses the win formula', () => {
    const session = MemorySession.create(definition, { seed: 3 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().score).toBe(0);
    const won = createRun({ seed: 1 });
    won.outcome = 'won';
    won.holds = { port: 4, mid: 2, starboard: 4 };
    won.calm = 3;
    won.dumps = 1;
    expect(ladderScore(won)).toBe(10 * 25 + 3 * 20 - 60 + 380);
  });
});
