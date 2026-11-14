import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { definition } from '../src/definition';
import {
  act,
  actionsOf,
  beamEnd,
  createRun,
  type GlassState,
  ladderScore,
  suggest,
} from '../src/engine';

function play(seed: number, policy: (state: GlassState) => string) {
  const state = createRun({ seed });
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < 80) {
    act(state, policy(state));
    guard += 1;
  }
  return state;
}

describe('claw-glass engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(createRun({ seed: 7 })).toEqual(createRun({ seed: 7 }));
    expect(createRun({ seed: 1 }).rng).toHaveLength(4);
    const again = createRun({ seed: 4 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
    let differ = false;
    for (let seed = 1; seed <= 8; seed += 1) {
      if (createRun({ seed }).cloud !== createRun({ seed: seed + 3 }).cloud) differ = true;
    }
    expect(differ).toBe(true);
  });

  it('lights a shrine only when the beam reaches it', () => {
    const state = createRun({ seed: 1 });
    state.stage = 1;
    state.stages = 1;
    state.moon = { x: 0, y: 2, dir: 1 };
    state.shrine = { x: 6, y: 2 };
    state.mirrors = [
      { x: 2, y: 0, tilt: 0 },
      { x: 5, y: 0, tilt: 1 },
      { x: 1, y: 4, tilt: 0 },
    ];
    state.rocks = [];
    state.clouds = [{ x: 0, y: 0 }];
    state.cloud = 0;
    state.beats = 3;
    expect(beamEnd(state)).toBe('shrine');
    act(state, 'fire');
    expect(state.outcome).toBe('won');
    expect(state.faults).toBe(0);
  });

  it('lets the careful line light more courts than spinning the first mirror', () => {
    let careful = 0;
    let blind = 0;
    for (let seed = 1; seed <= 8; seed += 1) {
      if (play(seed, suggest).outcome === 'won') careful += 1;
      if (
        play(seed, (state) =>
          actionsOf(state).some((action) => action.id === 'turn:0') ? 'turn:0' : 'wait',
        ).outcome === 'won'
      )
        blind += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(6);
    expect(blind).toBeLessThan(careful);
  });

  it('scores zero on abort and uses the win formula', () => {
    const session = MemorySession.create(definition, { seed: 3 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().score).toBe(0);
    const won = createRun({ seed: 1 });
    won.outcome = 'won';
    won.lit = 4;
    won.faults = 1;
    expect(ladderScore(won)).toBe(4 * 80 - 180 + 320);
  });
});
