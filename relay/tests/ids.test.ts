import { describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  generateRoomCode,
  generateSessionId,
  isRoomCode,
  isSessionId,
  normalizeRoomCode,
  SESSION_LENGTH,
} from '../src/ids';

function sequence(bytes: number[]): (n: number) => Uint8Array {
  let i = 0;
  return (n) => {
    const out = new Uint8Array(n);
    for (let k = 0; k < n; k += 1) {
      out[k] = bytes[i % bytes.length]!;
      i += 1;
    }
    return out;
  };
}

describe('session ids', () => {
  it('are 22-char url-safe tokens and validate tight', () => {
    const id = generateSessionId();
    expect(id).toHaveLength(SESSION_LENGTH);
    expect(isSessionId(id)).toBe(true);
    expect(isSessionId(id.slice(1))).toBe(false);
    expect(isSessionId(`${id}x`)).toBe(false);
    expect(isSessionId('not a token')).toBe(false);
  });

  it('are unique across many draws', () => {
    const seen = new Set(Array.from({ length: 400 }, () => generateSessionId()));
    expect(seen.size).toBe(400);
  });

  it('avoids modulo bias with a deterministic stream', () => {
    const id = generateSessionId(sequence([0, 1, 2, 255, 64, 128]));
    expect(isSessionId(id)).toBe(true);
    expect(id).toHaveLength(22);
  });
});

describe('room codes', () => {
  it('are 7-char unambiguous codes', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(CODE_LENGTH);
    expect(isRoomCode(code)).toBe(true);
    for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    expect(isRoomCode('OIL01AB')).toBe(false);
    expect(isRoomCode('abc')).toBe(false);
  });

  it('normalizes spaces, dashes and case', () => {
    expect(normalizeRoomCode('ab-3k 7m')).toBe('AB3K7M');
    expect(isRoomCode('ab3-k7mn')).toBe(true);
    expect(normalizeRoomCode('ab3-k7mn')).toBe('AB3K7MN');
  });

  it('are unique across many draws', () => {
    const seen = new Set(Array.from({ length: 400 }, () => generateRoomCode()));
    expect(seen.size).toBe(400);
  });
});
