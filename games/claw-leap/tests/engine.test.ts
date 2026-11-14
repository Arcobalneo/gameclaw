import { describe, expect, it } from 'vitest';

import { MAX_LEVEL, POWERS, STAT_CAP } from '../src/content';
import { definition } from '../src/definition';
import {
  abort,
  act,
  actionsOf,
  createRun,
  type LeapState,
  landingTolerance,
  maxFalls,
  previewJump,
  previewRescue,
  recapOf,
  speedOf,
  statsOf,
  statusOf,
  visionOf,
} from '../src/engine';

function fresh(seed = 7, content = 'steady:mint', difficulty?: string): LeapState {
  return createRun({ seed, content, difficulty });
}

function ids(state: LeapState): string[] {
  return actionsOf(state).map((action) => action.id);
}

function recommended(state: LeapState): string {
  const action = actionsOf(state)[0];
  if (!action) throw new Error('no legal action');
  return action.id;
}

function playUntil(state: LeapState, done: () => boolean, limit = 300): LeapState {
  let guard = 0;
  while (state.outcome === 'ongoing' && !done() && guard < limit) {
    act(state, recommended(state));
    guard += 1;
  }
  expect(guard, `policy stopped at ${state.phase} / level ${state.level}`).toBeLessThan(limit);
  return state;
}

function enterRescue(state: LeapState): void {
  state.sinceRescue = 7;
  const jump = actionsOf(state).find((action) => action.id.startsWith('jump:'));
  expect(jump).toBeDefined();
  act(state, jump!.id);
  expect(state.phase).toBe('rescue');
  expect(state.rescue).not.toBeNull();
}

describe('claw-leap opening and build', () => {
  it('replays the generated street and keeps the same seed different from another', () => {
    expect(fresh(7)).toEqual(fresh(7));
    expect(fresh(7).street).not.toEqual(fresh(8).street);
    expect(fresh(7).rng).toHaveLength(4);
    expect(JSON.stringify(fresh(7))).not.toContain('undefined');
  });

  it('lets the player choose nature then color and applies both to stats', () => {
    const state = fresh(3, '');
    expect(state.phase).toBe('nature');
    expect(ids(state)).toEqual(['nature:bold', 'nature:steady', 'nature:mellow']);
    act(state, 'nature:bold');
    expect(state.phase).toBe('color');
    expect(state.stamina).toBe(0);
    act(state, 'color:coral');
    expect(state.phase).toBe('leap');
    expect(statsOf(state)).toMatchObject({ spring: 6, control: 2, endurance: 4, grip: 3 });
    expect(state.stamina).toBe(18);
    expect(statusOf(state).headline).toContain('第 1/45 关');
  });

  it('gives colors real tradeoffs rather than cosmetic labels', () => {
    const coral = statsOf(fresh(4, 'steady:coral'));
    const mint = statsOf(fresh(4, 'steady:mint'));
    const amber = statsOf(fresh(4, 'steady:amber'));
    const lilac = statsOf(fresh(4, 'steady:lilac'));
    expect(coral.spring).toBe(mint.spring + 2);
    expect(mint.control).toBe(coral.control + 2);
    expect(amber.endurance).toBeGreaterThan(mint.endurance);
    expect(lilac.grip).toBeGreaterThan(mint.grip);
  });
});

describe('claw-leap deterministic jumping', () => {
  it('uses public physics in both the preview and the resolved event', () => {
    const state = fresh();
    const action = actionsOf(state).find((candidate) => candidate.id.startsWith('jump:'))!;
    const [, power, angle, timing] = action.id.split(':');
    const preview = previewJump(state, power as never, angle as never, timing as never);
    expect(['perfect', 'clean', 'edge']).toContain(preview.result);
    const result = act(state, action.id);
    const event = result.events?.find((candidate) => candidate.type === 'jump');
    expect(event).toMatchObject({
      landing: preview.landing,
      error: preview.error,
      tolerance: preview.tolerance,
      result: preview.result,
    });
    expect(state.cleared).toBe(1);
    expect(state.level).toBe(2);
    expect(action.detail).toContain('预计落点');
  });

  it('resolves a predicted miss as a normal action with an attributable setback', () => {
    const state = fresh();
    const miss = actionsOf(state).find(
      (action) => action.tags?.includes('short') || action.tags?.includes('long'),
    )!;
    expect(miss).toBeDefined();
    const result = act(state, miss.id);
    expect(result.log.join('\n')).toContain('本关尚未完成');
    expect(state.level).toBe(1);
    expect(state.cleared).toBe(0);
    expect(state.falls).toBe(1);
    expect(state.outcome).toBe('ongoing');
    expect(state.lastSetback).toContain(miss.id);
    expect(recapOf(state).cause).toContain(miss.id);
    expect(recapOf(state).outcome).toBe('ongoing');
  });

  it('changes the landing forecast after a rest advances the wind beat', () => {
    const state = fresh(9);
    const before = previewJump(state, 'mid', 'arc', 'early');
    const stamina = state.stamina;
    act(state, 'rest');
    const after = previewJump(state, 'mid', 'arc', 'early');
    expect(state.stamina).toBe(stamina);
    expect(state.beat).toBe(speedOf(1));
    expect(after.window).not.toBe(before.window);
    expect(after.landing).not.toBe(before.landing);
  });

  it('spends sparks on permanent training and respects the stat cap', () => {
    const state = fresh();
    state.sparks = 6;
    const before = statsOf(state).spring;
    expect(ids(state)).toContain('train:spring');
    act(state, 'train:spring');
    expect(statsOf(state).spring).toBe(before + 1);
    expect(state.sparks).toBe(3);
    expect(state.trained).toBe(1);
    state.training.spring = STAT_CAP;
    expect(ids(state)).not.toContain('train:spring');
  });

  it('executes every listed setup, jump, recovery and training action without an illegal-action error', () => {
    const setup = fresh(2, '');
    for (const action of actionsOf(setup)) {
      const clone = structuredClone(setup);
      expect(() => act(clone, action.id), action.id).not.toThrow();
    }
    act(setup, 'nature:steady');
    for (const action of actionsOf(setup)) {
      const clone = structuredClone(setup);
      expect(() => act(clone, action.id), action.id).not.toThrow();
    }
    act(setup, 'color:mint');
    setup.sparks = 3;
    for (const action of actionsOf(setup)) {
      const clone = structuredClone(setup);
      expect(() => act(clone, action.id), action.id).not.toThrow();
      expect(clone.rng).toHaveLength(4);
    }
  });
});

describe('claw-leap street growth and complete runs', () => {
  it('extends the same street, increases vision and speed, and grows after fifteen clears', () => {
    const state = fresh(11, 'bold:coral');
    const initial = structuredClone(state.street);
    expect(visionOf(state.level)).toBe(2);
    expect(speedOf(state.level)).toBe(1);
    playUntil(state, () => state.cleared >= 15, 150);
    expect(state.size).toBe(1);
    expect(state.cleared).toBe(15);
    expect(state.level).toBe(16);
    expect(visionOf(state.level)).toBe(3);
    expect(speedOf(state.level)).toBe(2);
    expect(state.street.length).toBeGreaterThan(initial.length);
    expect(state.street.slice(0, initial.length)).toEqual(initial);
    for (let index = 1; index < state.street.length; index += 1) {
      expect(state.street[index]!.x).toBeGreaterThan(state.street[index - 1]!.x);
    }
    expect(state.timeline.join('\n')).toContain('第 15 关');
  });

  it('grows again at thirty and can reach dawn with several builds', () => {
    for (const [seed, content] of [
      [5, 'bold:coral'],
      [11, 'steady:mint'],
      [19, 'mellow:amber'],
    ] as const) {
      const state = fresh(seed, content);
      playUntil(state, () => state.outcome !== 'ongoing', 500);
      expect(state.outcome, `${seed}:${content}:${state.cause}`).toBe('won');
      expect(state.ending).toBe('dawn');
      expect(state.cleared).toBe(MAX_LEVEL);
      expect(state.size).toBe(2);
      expect(state.cause).toContain('第 45 根灯柱');
      expect(actionsOf(state)).toEqual([]);
      expect(recapOf(state).lessons.join('\n')).toContain('45 关');
    }
  });

  it('replays identical choices into byte-identical state', () => {
    const left = fresh(23, 'mellow:lilac');
    const right = fresh(23, 'mellow:lilac');
    for (let step = 0; step < 30 && left.outcome === 'ongoing'; step += 1) {
      const action = recommended(left);
      expect(recommended(right)).toBe(action);
      act(left, action);
      act(right, action);
      expect(left).toEqual(right);
    }
    expect(left.cleared).toBeGreaterThanOrEqual(15);
  });
});

describe('claw-leap offline rescue', () => {
  it('uses a same-nature offline partner, rewards rescue, and executes every listed rescue input', () => {
    const state = fresh(7, 'mellow:lilac');
    enterRescue(state);
    const network = statusOf(state).sections.find((section) => section.title.includes('离线夜频'));
    expect(network?.lines.join('\n')).toContain('绵韧');
    expect(network?.lines.join('\n')).toContain('没有连接网络');
    for (const action of actionsOf(state)) {
      const clone = structuredClone(state);
      expect(() => act(clone, action.id), action.id).not.toThrow();
    }
    expect(state.rescue?.need).toBe(7);
    act(state, recommended(state));
    expect(state.phase).toBe('rescue');
    playUntil(state, () => state.phase === 'leap', 10);
    expect(state.rescues).toBe(1);
    expect(state.phase).toBe('leap');
    expect(state.bond).toBe(1);
    const assisted = landingTolerance(state);
    act(state, recommended(state));
    expect(state.bond).toBe(0);
    expect(landingTolerance(state)).toBeLessThan(assisted);
  });

  it('makes rescue progress and tension public and can fail with its own death cause', () => {
    const state = fresh(8);
    enterRescue(state);
    const preview = previewRescue(state, 'high', state.rescue!.cue);
    expect(preview.force).toBeGreaterThan(0);
    state.falls = maxFalls(state) - 1;
    state.rescue!.roundsLeft = 1;
    state.rescue!.cue = 'on';
    const losing = 'rescue:low:late';
    expect(ids(state)).toContain(losing);
    const result = act(state, losing);
    expect(state.ending).toBe('rescue-fall');
    expect(state.outcome).toBe('lost');
    expect(state.cause).toContain('救援');
    expect(state.cause).toContain('最后一次摔落');
    expect(result.log.join('\n')).toContain('救援');
    expect(recapOf(state).lessons.join('\n')).toContain('拉力');
  });
});

describe('claw-leap endings and recap', () => {
  it('distinguishes exhaustion from an ordinary fall', () => {
    const state = fresh();
    const miss = actionsOf(state).find(
      (action) => action.tags?.includes('short') || action.tags?.includes('long'),
    )!;
    const power = miss.id.split(':')[1] as keyof typeof POWERS;
    state.stamina = POWERS[power].cost;
    act(state, miss.id);
    expect(state.stamina).toBe(0);
    expect(state.ending).toBe('exhausted');
    expect(state.cause).toContain('力竭');
    expect(state.cause).toContain(miss.id);
    expect(recapOf(state).cause).toContain('误差');
  });

  it('ends an ordinary fall at the visible fall limit', () => {
    const state = fresh();
    const miss = actionsOf(state).find(
      (action) => action.tags?.includes('short') || action.tags?.includes('long'),
    )!;
    state.falls = maxFalls(state) - 1;
    act(state, miss.id);
    expect(state.ending).toBe('fall');
    expect(state.cause).toContain('摔落次数到上限');
    expect(definition.recap(state).outcome).toBe('lost');
  });

  it('keeps abort separate and hides all actions after settlement', () => {
    const state = fresh();
    abort(state);
    expect(state.outcome).toBe('aborted');
    expect(state.ending).toBe('aborted');
    expect(state.cause).toContain('不是摔死');
    expect(actionsOf(state)).toEqual([]);
    expect(recapOf(state).memoryPrompt).toContain('重新验证');
  });
});
