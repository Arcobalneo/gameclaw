import { describe, expect, it } from 'vitest';

import { Rng } from '../src/rng';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = Rng.fromSeed(42);
    const b = Rng.fromSeed(42);
    const sequenceA = Array.from({ length: 20 }, () => a.nextUint32());
    const sequenceB = Array.from({ length: 20 }, () => b.nextUint32());
    expect(sequenceA).toEqual(sequenceB);
  });

  it('produces different sequences for different seeds', () => {
    const a = Rng.fromSeed(1);
    const b = Rng.fromSeed(2);
    expect(a.nextUint32()).not.toBe(b.nextUint32());
  });

  it('round-trips its state', () => {
    const rng = Rng.fromSeed(7);
    for (let i = 0; i < 5; i += 1) rng.nextUint32();
    const restored = Rng.restore(rng.serialize());
    expect(restored.nextUint32()).toBe(rng.nextUint32());
  });

  it('samples without replacement', () => {
    const rng = Rng.fromSeed(3);
    const sample = rng.sample([1, 2, 3, 4, 5], 5);
    expect([...sample].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps ints inside the requested range', () => {
    const rng = Rng.fromSeed(9);
    for (let i = 0; i < 200; i += 1) {
      const value = rng.int(2, 4);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThanOrEqual(4);
    }
  });
});
