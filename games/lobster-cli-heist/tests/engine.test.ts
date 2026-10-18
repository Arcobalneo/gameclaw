import { describe, expect, it } from 'vitest';

import {
  abort,
  act,
  availableActions,
  createRun,
  forecastExposure,
  type HeistState,
  missionOf,
} from '../src/engine';

function freshRun(seed = 7, content?: string): HeistState {
  return createRun({ seed, content });
}

function playableRun(seed = 7, content?: string, profile = 'shade'): HeistState {
  const state = freshRun(seed, content);
  act(state, `choose:${profile}`);
  return state;
}

describe('heist engine', () => {
  it('starts in setup and only offers profile choices', () => {
    const state = freshRun();
    expect(state.phase).toBe('setup');
    expect(state.outcome).toBe('ongoing');
    expect(state.turn).toBe(0);
    const ids = availableActions(state).map((action) => action.id);
    expect(ids).toEqual(['choose:shade', 'choose:breaker', 'choose:runner']);
  });

  it('replays deterministically and keeps a JSON-serialisable state', () => {
    const script = ['choose:shade', 'move:e', 'move:e', 'move:n', 'observe'];
    const a = freshRun(7);
    const b = freshRun(7);
    for (const id of script) {
      act(a, id);
      act(b, id);
    }
    expect(a).toEqual(b);
    expect(a.rng).toHaveLength(4);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(a.phase).toBe('infiltrate');
    expect(a.turn).toBe(script.length);
  });

  it('blocks out-of-bounds and non-climb vertical moves', () => {
    const state = playableRun(7, 'cold-rack');
    expect(state.position).toEqual([1, 0]);
    expect(() => act(state, 'move:w')).toThrow(/Blocked move/);
    expect(() => act(state, 'move:n')).toThrow(/Blocked move/);
    act(state, 'move:e');
    expect(state.position).toEqual([1, 1]);
  });

  it('uses a vent slide only while empty-handed', () => {
    const state = playableRun(7, 'cold-rack');
    state.mission.security = 'line-watch';
    state.patrolIndex = 0;
    state.alert = 0;
    state.responderPos = null;
    state.position = [1, 2];
    expect(state.carrying).toBe(false);
    act(state, 'move:e');
    expect(state.position).toEqual([1, 5]);

    state.position = [1, 2];
    state.carrying = true;
    state.patrolIndex = 4;
    act(state, 'move:e');
    expect(state.position).toEqual([1, 3]);
  });

  it('refuses to walk into an occupied threat cell', () => {
    const state = playableRun(7, 'cold-rack');
    state.mission.security = 'line-watch';
    state.patrolIndex = 0; // patroller at [1, 2]
    state.position = [1, 1];
    expect(() => act(state, 'move:e')).toThrow(/Blocked move/);
  });

  it('raises exposure while standing in a watcher line', () => {
    const state = playableRun(7, 'cold-rack');
    state.mission.security = 'line-watch';
    state.patrolIndex = 0;
    state.cameraDown = 0;
    state.responderPos = null;
    state.alert = 0;
    state.position = [0, 2]; // open tile, inside the watcher's leftward cone
    expect(forecastExposure(state, [0, 2]).gain).toBe(1);
    act(state, 'observe');
    expect(state.exposure).toBe(1);
    act(state, 'observe');
    expect(state.exposure).toBeGreaterThanOrEqual(2);
  });

  it('turns a true objective into an extraction phase with a ticking window', () => {
    const state = playableRun(7, 'cold-rack');
    state.mission.security = 'line-watch';
    state.mission.objective = 'salt-ledger';
    state.mission.complication = 'slick-floor';
    state.mission.trueSite = [0, 5];
    state.position = [0, 5];
    act(state, 'interact:objective');
    expect(state.carrying).toBe(true);
    expect(state.objectiveTaken).toBe(true);
    expect(state.phase).toBe('extraction');
    expect(state.lockdown).toBe(8);
    act(state, 'wait');
    expect(state.lockdown).toBe(7);
  });

  it('wins by carrying the objective through the exit', () => {
    const state = playableRun(7, 'cold-rack');
    state.mission.security = 'line-watch';
    state.mission.objective = 'salt-ledger';
    state.mission.complication = 'slick-floor';
    state.mission.trueSite = [0, 5];
    state.position = [0, 5];
    act(state, 'interact:objective');
    state.position = [0, 0];
    act(state, 'interact:extract');
    expect(state.outcome).toBe('won');
    expect(state.phase).toBe('ended');
    expect(state.score).toBe(17);
  });

  it('loses when exposure reaches the limit', () => {
    const state = playableRun(7, 'cold-rack');
    state.mission.security = 'line-watch';
    state.mission.objective = 'salt-ledger';
    state.mission.complication = 'slick-floor';
    state.position = [0, 2];
    state.exposure = state.exposureLimit;
    act(state, 'observe');
    expect(state.outcome).toBe('lost');
    expect(state.cause).toMatch(/曝光/);
  });

  it('can be aborted honestly', () => {
    const state = playableRun(7);
    abort(state);
    expect(state.outcome).toBe('aborted');
    expect(state.phase).toBe('ended');
    expect(state.cause).toMatch(/收壳/);
  });
});

describe('heist content', () => {
  it('selects a deterministic mission from a seed', () => {
    const a = missionOf(freshRun(11));
    const b = missionOf(freshRun(11));
    expect(a.facility.key).toBe(b.facility.key);
    expect(a.security.key).toBe(b.security.key);
    expect(a.objective.key).toBe(b.objective.key);
    expect(a.complication.key).toBe(b.complication.key);
    expect(a.trueSite).toEqual(b.trueSite);
  });

  it('pins a facility through --content', () => {
    const state = freshRun(7, 'galley-backline');
    expect(missionOf(state).facility.key).toBe('galley-backline');
  });
});
