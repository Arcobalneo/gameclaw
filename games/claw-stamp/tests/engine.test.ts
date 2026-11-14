import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { definition } from '../src/definition';
import {
  act,
  actionsOf,
  createRun,
  ladderScore,
  recapOf,
  type StampState,
  suggest,
} from '../src/engine';

function fresh(seed = 7, difficulty?: string): StampState {
  return createRun({ seed, difficulty });
}

function play(state: StampState, policy: (state: StampState) => string, limit = 40): StampState {
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < limit) {
    act(state, policy(state));
    guard += 1;
  }
  return state;
}

describe('claw-stamp engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(fresh(7)).toEqual(fresh(7));
    expect(fresh(7).deck).not.toEqual(fresh(8).deck);
    expect(fresh(7).rng).toHaveLength(4);
    const again = fresh(4);
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
  });

  it('stamps a legal guest without a strike and refuses a banned one cleanly', () => {
    const state = fresh(1);
    state.traveler = { name: '潮生', kind: 'clear', fare: 3 };
    act(state, 'stamp');
    expect(state.approvals).toBe(1);
    expect(state.fares).toBe(3);
    expect(state.strikes).toBe(0);
    expect(state.streak).toBe(1);
    state.traveler = { name: '灯下', kind: 'banned', fare: 2 };
    act(state, 'refuse');
    expect(state.catches).toBe(1);
    expect(state.streak).toBe(2);
    expect(state.strikes).toBe(0);
  });

  it('makes an edge stamp a strike and a pardon a fareless approval', () => {
    const state = fresh(2);
    state.traveler = { name: '壳市', kind: 'edge', fare: 6 };
    state.streak = 2;
    act(state, 'stamp');
    expect(state.strikes).toBe(1);
    expect(state.streak).toBe(0);
    expect(state.fares).toBe(6);
    expect(state.approvals).toBe(0);
    state.traveler = { name: '网尾', kind: 'edge', fare: 5 };
    act(state, 'pardon');
    expect(state.pardons).toBe(0);
    expect(state.fares).toBe(6);
    expect(state.approvals).toBe(1);
    expect(state.streak).toBe(1);
    expect(actionsOf(state).some((action) => action.id === 'pardon')).toBe(false);
  });

  it('turns an edge legal when you listen, and refuses to listen without patience', () => {
    const state = fresh(3);
    state.traveler = { name: '盐摊', kind: 'edge', fare: 4 };
    state.patience = 4;
    act(state, 'listen');
    expect(state.traveler?.kind).toBe('clear');
    expect(state.patience).toBe(2);
    expect(state.index).toBe(0);
    state.patience = 1;
    expect(actionsOf(state).some((action) => action.id === 'listen')).toBe(false);
  });

  it('loses at the strike cap and wins when the quota is met', () => {
    const state = fresh(5);
    state.strikeLimit = 2;
    state.traveler = { name: '甲', kind: 'banned', fare: 1 };
    act(state, 'stamp');
    state.traveler = { name: '乙', kind: 'clear', fare: 2 };
    act(state, 'refuse');
    expect(state.outcome).toBe('lost');
    expect(state.cause).toBe('记过满了');
    expect(ladderScore(state)).toBeGreaterThanOrEqual(0);

    const win = fresh(6);
    win.quota = 1;
    win.total = 1;
    win.index = 0;
    win.traveler = { name: '丙', kind: 'clear', fare: 4 };
    win.next = null;
    act(win, 'stamp');
    expect(win.outcome).toBe('won');
    expect(win.cause).toBe('船开走了');
    expect(ladderScore(win)).toBeGreaterThan(400);
  });

  it('rejects a stamp after the shift ends', () => {
    const state = fresh(7);
    state.outcome = 'lost';
    expect(() => act(state, 'stamp')).toThrow(/收尾/);
  });

  it('lets the careful line win more seeds than stamping every pass', () => {
    let careful = 0;
    let greedy = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      if (play(fresh(seed), suggest).outcome === 'won') careful += 1;
      if (play(fresh(seed), () => 'stamp').outcome === 'won') greedy += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(12);
    expect(greedy).toBeLessThan(careful);
    let fare = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      const fareLine = play(fresh(seed), (state) => {
        const traveler = state.traveler;
        if (!traveler || traveler.kind === 'clear') return 'stamp';
        if (traveler.kind === 'banned') return 'refuse';
        return traveler.fare >= 5 ? 'stamp' : 'refuse';
      });
      if (fareLine.outcome === 'won') fare += 1;
    }
    let carefulDozen = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      if (play(fresh(seed), suggest).outcome === 'won') carefulDozen += 1;
    }
    expect(carefulDozen).toBeGreaterThanOrEqual(fare + 5);
  });

  it('scores zero until the run ends, including an abort', () => {
    const session = MemorySession.create(definition, { seed: 9 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().outcome).toBe('aborted');
    expect(session.recap().score).toBe(0);
    expect(recapOf(fresh(1)).score).toBe(0);
  });
});
