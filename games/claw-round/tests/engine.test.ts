import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { definition } from '../src/definition';
import { act, createRun, ladderScore, suggest } from '../src/engine';

function play(seed: number, policy: (state: ReturnType<typeof createRun>) => string) {
  const state = createRun({ seed });
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < 40) {
    act(state, policy(state));
    guard += 1;
  }
  return state;
}

describe('claw-round engine', () => {
  it('replays a seed and keeps the gate public', () => {
    expect(createRun({ seed: 4 })).toEqual(createRun({ seed: 4 }));
    expect(createRun({ seed: 4 }).need).toHaveLength(2);
    expect(createRun({ seed: 1 }).rng).toHaveLength(4);
    const again = createRun({ seed: 3 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
  });

  it('washes an item that was not pocketed', () => {
    const state = createRun({ seed: 1 });
    state.spots = ['ticket', 'lamp', 'coin', 'rope', 'bell'];
    state.need = ['bell', 'rope'];
    state.beats = 2;
    act(state, 'grab');
    expect(state.held).toBe('ticket');
    act(state, 'step:1');
    expect(state.outcome).toBe('ongoing');
    expect(state.held).toBeNull();
    expect(state.loop).toBe(2);
  });

  it('lets the careful line win more often than walking only', () => {
    let careful = 0;
    let walk = 0;
    for (let seed = 1; seed <= 10; seed += 1) {
      if (play(seed, suggest).outcome === 'won') careful += 1;
      if (play(seed, (state) => (state.pos < 4 ? 'step:1' : 'step:-1')).outcome === 'won')
        walk += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(8);
    expect(walk).toBeLessThan(careful);
  });

  it('scores zero on abort', () => {
    const session = MemorySession.create(definition, { seed: 2 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().score).toBe(0);
    const won = createRun({ seed: 1 });
    won.outcome = 'won';
    won.loop = 2;
    won.wrong = 1;
    expect(ladderScore(won)).toBe(460 - 30 - 60);
  });
});
