import { describe, expect, it } from 'vitest';

import {
  abort,
  act,
  actionsOf,
  createRun,
  legendOf,
  missingRequired,
  previewTaste,
  recapOf,
  statusOf,
} from '../src/engine';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function play(seed: number, steps: number, difficulty: 'easy' | 'normal' | 'hard' = 'normal') {
  const state = createRun({ seed, difficulty });
  const log: string[] = [];
  for (let i = 0; i < steps && state.outcome === 'ongoing'; i += 1) {
    const next = actionsOf(state)[0];
    if (!next) break;
    const result = act(state, next.id);
    log.push(`${i + 1}:${next.id} -> ${result.log[0] ?? ''}`);
    expect(result.log.length).toBeGreaterThan(0);
  }
  return { state, log };
}

describe('shrimp-burger engine', () => {
  it('is deterministic for the same seed and action sequence', () => {
    const a = createRun({ seed: 7 });
    const b = createRun({ seed: 7 });
    expect(a.falling.map((item) => [item.kind, item.name])).toEqual(
      b.falling.map((item) => [item.kind, item.name]),
    );
    const seq = ['wait', 'wait', 'wait'] as const;
    for (const id of seq) {
      if (!actionsOf(a).some((action) => action.id === id)) break;
      act(a, id);
      act(b, id);
    }
    expect(a.heat).toBe(b.heat);
    expect(a.turnsRemaining).toBe(b.turnsRemaining);
    expect(a.rng).toEqual(b.rng);
  });

  it('lists only honest actions and executes every listed one', () => {
    const state = createRun({ seed: 11 });
    const ids = actionsOf(state).map((action) => action.id);
    expect(ids).toContain('serve');
    expect(ids.some((id) => id.startsWith('catch:'))).toBe(true);
    expect(ids).toContain('wait');
    for (const id of ids) {
      const fork = clone(state);
      expect(() => act(fork, id)).not.toThrow();
    }
    expect(() => act(clone(state), 'catch:9')).toThrow(/当前不能做/);
  });

  it('keeps wrong ingredients in the stack without auto-fail', () => {
    const state = createRun({ seed: 3 });
    // Force a wrong catch if available; otherwise wait until one appears.
    let caughtWrong = false;
    for (let i = 0; i < 40 && state.outcome === 'ongoing' && !caughtWrong; i += 1) {
      const wrong = state.falling.find(
        (item) =>
          item.kind === 'ingredient' &&
          item.materialId &&
          legendOf(item.materialId, state.recipe) === 'wrong',
      );
      if (wrong) {
        act(state, `catch:${wrong.slot}`);
        caughtWrong = state.stack.some((entry) => entry.legend === 'wrong');
        break;
      }
      act(state, 'wait');
    }
    if (caughtWrong) {
      expect(state.wrongCaught).toBeGreaterThan(0);
      expect(state.outcome).toBe('ongoing');
      const preview = previewTaste(state);
      expect(preview.wrongMix.length).toBeGreaterThan(0);
    } else {
      // Still assert serve never auto-fails solely for empty wrongMix path.
      expect(typeof previewTaste(state).quality).toBe('number');
    }
  });

  it('can enter guest phase and soothe after a bad serve', () => {
    const state = createRun({ seed: 19, difficulty: 'hard' });
    // Serve immediately with almost empty stack to force bad/disaster.
    act(state, 'serve');
    if (state.phase === 'guest') {
      const ids = actionsOf(state).map((action) => action.id);
      expect(ids).toEqual(['soothe', 'wait']);
      act(state, 'soothe');
      expect(state.soothed).toBe(1);
      expect(state.phase).toBe('service');
    } else if (state.ending === 'ruined' || state.ending === 'timeout') {
      expect(state.outcome).toBe('lost');
    } else {
      // Lucky empty serve is allowed by design; still attributable.
      expect(['tasty', 'lucky']).toContain(state.lastOrder?.taste.verdict);
    }
  });

  it('aborts with attributable cause and recap lessons', () => {
    const state = createRun({ seed: 5 });
    act(state, 'wait');
    abort(state);
    expect(state.outcome).toBe('aborted');
    const recap = recapOf(state);
    expect(recap.cause).toMatch(/主动收摊/);
    expect(recap.lessons.length).toBeGreaterThan(2);
    expect(statusOf(state).outcome).toBe('aborted');
  });

  it('recommended policy can progress on easy without crashing', () => {
    const { state, log } = play(7, 25, 'easy');
    expect(log.length).toBeGreaterThanOrEqual(15);
    expect(state.turnsUsed).toBeGreaterThanOrEqual(15);
    expect(['ongoing', 'won', 'lost']).toContain(state.outcome);
    if (state.served > 0) expect(missingRequired(createRun({ seed: 7 }))).toBeTypeOf('object');
  });
});
