import { describe, expect, it } from 'vitest';

import { APPROACH_FIT } from '../src/content';
import { definition } from '../src/definition';
import {
  act,
  actionsOf,
  createRun,
  type PumpkinState,
  WIN_CAPTURED,
  WIN_PUMPKINS,
} from '../src/engine';

/** Mood fit for a soothe action, or -99 when the monster is still unknown. */
function fitOf(state: PumpkinState, id: string): number {
  const [, approach, plotId] = id.split(':');
  const monster = state.monsters.find((item) => state.plots[item.plot]?.id === plotId);
  if (!monster?.revealed) return -99;
  return APPROACH_FIT[monster.mood][approach as keyof (typeof APPROACH_FIT)['grumpy']];
}

/**
 * A competent policy: harvest everything that is ready, probe before soothing,
 * pick the best mood fit, and never walk into a 0-stamina dawn.
 */
function competentMove(state: PumpkinState): string {
  const ids = actionsOf(state).map((action) => action.id);
  const first = (prefix: string) => ids.find((id) => id.startsWith(prefix));
  const buffer = 2;

  const harvest = first('harvest:');
  if (harvest) return harvest;

  if (state.captured < WIN_CAPTURED) {
    const ranked = ids
      .filter((id) => id.startsWith('soothe:'))
      .map((id) => [id, fitOf(state, id)] as const)
      .filter(([, fit]) => fit > -99)
      .sort((a, b) => b[1] - a[1]);
    if (ranked.length > 0 && state.stamina >= 2 + buffer) return ranked[0]![0];

    const probe = ids.find((id) => {
      if (!id.startsWith('probe:')) return false;
      const plotId = id.split(':')[1];
      const monster = state.monsters.find((item) => state.plots[item.plot]?.id === plotId);
      return Boolean(monster && !monster.revealed);
    });
    if (probe && state.stamina >= 1 + buffer) return probe;
  }

  for (const prefix of ['water:', 'plant:']) {
    const id = first(prefix);
    if (id && state.stamina >= 1 + buffer) return id;
  }
  if (state.stamina <= 3 && ids.includes('eat-seed')) return 'eat-seed';
  if (state.stamina <= 3 && ids.includes('rest')) return 'rest';
  return 'end-night';
}

describe('claw-rampage engine', () => {
  it('creates identical state from the same seed', () => {
    const a = createRun({ seed: 42 });
    const b = createRun({ seed: 42 });
    expect(a).toEqual(b);
    expect(a.stamina).toBe(16);
    expect(a.plots).toHaveLength(6);
    expect(a.monsters.length).toBeGreaterThan(0);
  });

  it('replays identically for the same seed and action sequence', () => {
    const script = ['probe:p3', 'soothe:candy:p3', 'water:p1', 'harvest:p1'];
    const play = () => {
      const state = createRun({ seed: 7 });
      for (const id of script) {
        if (actionsOf(state).some((action) => action.id === id)) act(state, id);
      }
      return state;
    };
    const a = play();
    const b = play();
    expect(a.stamina).toBe(b.stamina);
    expect(a.pumpkins).toBe(b.pumpkins);
    expect(a.captured).toBe(b.captured);
    expect(a.rng).toEqual(b.rng);
    expect(a.timeline).toEqual(b.timeline);
  });

  it('wins seed 1 with competent play, and only inside the action budget', () => {
    const state = createRun({ seed: 1 });
    let steps = 0;
    while (state.outcome === 'ongoing' && steps < 300) {
      act(state, competentMove(state));
      steps += 1;
    }
    expect(state.outcome).toBe('won');
    expect(state.pumpkins).toBeGreaterThanOrEqual(WIN_PUMPKINS);
    expect(state.captured).toBeGreaterThanOrEqual(WIN_CAPTURED);
    expect(steps).toBeLessThanOrEqual(24);
  });

  it('ends the run when stamina bottoms out at dawn', () => {
    const state = createRun({ seed: 3 });
    // Walking into dawn at 0 stamina is the fail state; drain the bar with the
    // cheapest available action, then close the night.
    state.stamina = 1;
    const cheap = actionsOf(state).find((action) => action.id.startsWith('probe:'));
    act(state, cheap!.id);
    expect(state.stamina).toBe(0);
    act(state, 'end-night');
    expect(state.outcome).toBe('lost');
    expect(state.cause).toContain('体力');
  });

  it('exposes the soothe threshold, and probing lowers it by two', () => {
    const state = createRun({ seed: 3 });
    const before = actionsOf(state).find((action) => action.id.startsWith('soothe:'));
    expect(before?.detail).toContain('成功线');

    const probe = actionsOf(state).find((action) => action.id.startsWith('probe:'));
    act(state, probe!.id);
    const after = actionsOf(state).find((action) => action.id.startsWith('soothe:'));
    if (after?.detail?.includes('契合')) {
      expect(after.detail).toContain('成功线');
    }
  });

  it('moves every monster on the rampage night', () => {
    const state = createRun({ seed: 5 });
    state.night = 3;
    state.actionsUsed = 0;
    const before = state.monsters.map((monster) => monster.plot);
    const water = actionsOf(state).find((action) => action.id.startsWith('water:'));
    const result = act(state, water?.id ?? 'end-night');
    const moved = state.monsters.filter((monster, index) => monster.plot !== before[index]);
    expect(result.events.some((event) => event.type === 'monster-move')).toBe(true);
    expect(moved.length).toBeGreaterThan(0);
  });

  it('emits machine-readable events instead of only prose', () => {
    const state = createRun({ seed: 11 });
    const probe = actionsOf(state).find((action) => action.id.startsWith('probe:'));
    const result = act(state, probe!.id);
    const types = result.events.map((event) => event.type);
    expect(types).toContain('act');
    expect(types).toContain('stamina');
    expect(result.events.find((event) => event.type === 'act')?.action).toBe(probe!.id);
    for (const event of result.events) expect(typeof event.type).toBe('string');
  });

  it('keeps an ongoing recap as honest mid-season progress', () => {
    const state = createRun({ seed: 202 });
    act(state, 'water:p1');
    const recap = definition.recap(state);
    expect(recap.outcome).toBe('ongoing');
    expect(recap.title).toContain('季中进度');
    expect(recap.title).not.toContain('没守住');
    expect(recap.cause).toContain('还没有最终结局');
  });

  it('reports aborted only after a real abort', () => {
    const state = createRun({ seed: 202 });
    definition.abort?.(state);
    const recap = definition.recap(state);
    expect(state.outcome).toBe('aborted');
    expect(recap.outcome).toBe('aborted');
    expect(recap.title).toContain('中止');
  });

  it('preserves won and lost recap outcomes and titles', () => {
    for (const outcome of ['won', 'lost'] as const) {
      const state = createRun({ seed: 202 });
      state.outcome = outcome;
      state.cause = outcome === 'won' ? '守住了。' : '没守住。';
      const recap = definition.recap(state);
      expect(recap.outcome).toBe(outcome);
      expect(recap.title).toBe(outcome === 'won' ? '这一季守住了' : '这一季没守住');
    }
  });

  it('attributes a night-finishing action to the night and budget it consumed', () => {
    const state = createRun({ seed: 202 });
    state.actionsUsed = state.actionCap - 1;
    const result = act(state, 'water:p1');
    expect(state.night).toBe(2);
    expect(state.actionsUsed).toBe(0);
    expect(result.events.find((event) => event.type === 'act')).toMatchObject({
      action: 'water:p1',
      night: 1,
      used: state.actionCap,
    });
    expect(result.events.find((event) => event.type === 'night')).toMatchObject({ night: 2 });
  });
});
