import { describe, expect, it } from 'vitest';
import { GameError } from '../src/errors';
import { MemorySession } from '../src/memory-session';
import { counterGame } from './fixture';

describe('MemorySession', () => {
  it('creates, acts and is deterministic for a seed', () => {
    const a = MemorySession.create(counterGame, { seed: 7, now: '2026-01-01T00:00:00.000Z' });
    const b = MemorySession.create(counterGame, { seed: 7, now: '2026-01-01T00:00:00.000Z' });
    expect(a.snapshot).toEqual(b.snapshot);
    const first = a.actions()[0]!;
    const out = a.act(first.id);
    expect(out.status.turn).toBe(1);
    expect(a.snapshot.turn).toBe(1);
    expect(out.previous).not.toBe(out.state);
  });

  it('resolves 1-based indices and rejects junk', () => {
    const s = MemorySession.create(counterGame, { seed: 3 });
    expect(s.resolve('1').id).toBe(s.actions()[0]!.id);
    expect(() => s.resolve('definitely-not-an-action')).toThrow(GameError);
  });

  it('abort settles the run and blocks further acts', () => {
    const s = MemorySession.create(counterGame, { seed: 3 });
    expect(s.actions().some((a) => a.id === 'abort')).toBe(true);
    s.act('abort');
    expect(s.status().outcome).toBe('aborted');
    expect(s.actions()).toEqual([]);
    expect(() => s.act('1')).toThrow(/already ended/);
  });

  it('restores only matching snapshots', () => {
    const s = MemorySession.create(counterGame, { seed: 5 });
    const raw = JSON.parse(JSON.stringify(s.snapshot));
    expect(MemorySession.restore(counterGame, raw)?.snapshot.seed).toBe(5);
    expect(MemorySession.restore(counterGame, { ...raw, game: 'other' })).toBeNull();
    expect(MemorySession.restore(counterGame, null)).toBeNull();
  });
});
