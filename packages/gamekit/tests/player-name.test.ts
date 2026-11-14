import { describe, expect, it } from 'vitest';
import { normalizePlayerName, playerNameKey } from '../src/player-name';

describe('player names', () => {
  it('trims, collapses space, and keeps CJK', () => {
    expect(normalizePlayerName('  虾  王  ')).toBe('虾 王');
    expect(playerNameKey('虾 王')).toBe('虾 王');
  });

  it('folds Latin case into one key', () => {
    expect(normalizePlayerName('Ace')).toBe('Ace');
    expect(playerNameKey('Ace')).toBe(playerNameKey('ace'));
  });

  it('rejects empty, long, url-like, and punctuated names', () => {
    expect(normalizePlayerName('   ')).toBeNull();
    expect(normalizePlayerName('a'.repeat(17))).toBeNull();
    expect(normalizePlayerName('http://x')).toBeNull();
    expect(normalizePlayerName('a@b')).toBeNull();
    expect(normalizePlayerName('ok_name')).toBe('ok_name');
    expect(normalizePlayerName('-nope')).toBeNull();
  });
});
