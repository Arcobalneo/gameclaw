import { describe, expect, it } from 'vitest';

import { LINEAGES, MUTATIONS } from '../src/content.js';
import {
  act,
  createRun,
  currentEncounter,
  offeredMutations,
  type RoguelikeState,
} from '../src/engine.js';

function runToEnd(seed: number, maxActions = 400): RoguelikeState {
  const state = createRun({ seed, content: 'three-cycles', difficulty: 'easy' });
  act(state, 'lineage:crusher');
  for (let i = 0; i < maxActions; i += 1) {
    if (state.outcome !== 'ongoing') break;
    if (state.phase === 'mutation') {
      const offer = offeredMutations(state)[0];
      if (!offer) throw new Error('mutation phase without offers');
      act(state, `mutation:${offer.key}`);
    } else if (state.phase === 'encounter') {
      act(state, 'enc:1');
    } else {
      throw new Error(`unexpected phase ${state.phase}`);
    }
  }
  return state;
}

describe('roguelike engine', () => {
  it('starts in the lineage phase with three legal choices', () => {
    const state = createRun({ seed: 7 });
    expect(state.phase).toBe('lineage');
    expect(state.outcome).toBe('ongoing');
    act(state, 'lineage:oracle');
    expect(state.phase).toBe('encounter');
    expect(state.lineage).toBe('oracle');
    expect(state.depth).toBe(1);
    expect(state.stats.sense).toBe(4);
  });

  it('is deterministic for the same seed and action sequence', () => {
    const a = runToEnd(11);
    const b = runToEnd(11);
    expect(a.outcome).toBe(b.outcome);
    expect(a.turn).toBe(b.turn);
    expect(a.stats).toEqual(b.stats);
    expect(a.encounterKey).toBe(b.encounterKey);
  });

  it('reaches a terminal state or a full three-cycle run', () => {
    const state = runToEnd(3);
    expect(['won', 'lost']).toContain(state.outcome);
    expect(state.turn).toBeGreaterThan(0);
  });

  it('offers exactly three mutations after the second encounter', () => {
    const state = createRun({ seed: 21 });
    act(state, 'lineage:crusher');
    act(state, 'enc:1');
    if (state.outcome === 'ongoing') {
      act(state, 'enc:1');
    }
    if (state.outcome === 'ongoing') {
      expect(state.phase).toBe('mutation');
      expect(offeredMutations(state)).toHaveLength(3);
      expect(MUTATIONS.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('never exposes an unknown encounter', () => {
    const state = createRun({ seed: 5 });
    act(state, 'lineage:gambler');
    const encounter = currentEncounter(state);
    expect(encounter.actions).toHaveLength(3);
  });

  it('has three lineages with distinct starting stats', () => {
    const shells = new Set(LINEAGES.map((lineage) => `${lineage.shell}/${lineage.energy}`));
    expect(shells.size).toBe(3);
  });
});
