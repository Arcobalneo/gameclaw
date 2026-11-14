import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { definition } from '../src/definition';

describe('ladder score', () => {
  it('is zero until the run is won or lost, and is a finite integer afterwards', () => {
    const session = MemorySession.create(definition, { seed: 11 });
    expect(session.recap().score).toBe(0);
    expect(session.status().outcome).toBe('ongoing');
    for (let i = 0; i < 40 && session.status().outcome === 'ongoing'; i += 1) {
      const actions = session.actions().filter((action) => action.id !== 'abort');
      if (!actions.length) break;
      session.act(actions[i % actions.length]!.id);
    }
    const recap = session.recap();
    expect(Number.isInteger(recap.score)).toBe(true);
    expect(recap.score).toBeGreaterThanOrEqual(0);
    expect(recap.score).toBeLessThanOrEqual(999_999);
    if (recap.outcome === 'ongoing' || recap.outcome === 'aborted') expect(recap.score).toBe(0);
  });
});
