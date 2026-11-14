import { afterEach, describe, expect, it } from 'vitest';
import { generateSessionId } from '../../relay/src/ids';
import { mcpUrl, relayBaseUrl, sessionWsUrl } from '../src/runtime/config';
import { adoptSession, loadOrCreateSession, rememberCode } from '../src/runtime/session';

class MemoryStorage {
  readonly #map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.#map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.#map.set(key, value);
  }
  removeItem(key: string): void {
    this.#map.delete(key);
  }
  clear(): void {
    this.#map.clear();
  }
}

const storage = new MemoryStorage();

(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = storage;
(
  globalThis as { location?: { href: string; origin: string; pathname: string; search: string } }
).location = {
  href: 'https://arcobalneo.github.io/gameclaw/',
  origin: 'https://arcobalneo.github.io',
  pathname: '/gameclaw/',
  search: '',
};

afterEach(() => storage.clear());

describe('local session', () => {
  it('creates a high-entropy id once and reuses it', () => {
    const first = loadOrCreateSession();
    expect(first.id).toHaveLength(22);
    expect(first.code).toBeNull();
    const second = loadOrCreateSession();
    expect(second.id).toBe(first.id);
  });

  it('remembers a room code for the same id', () => {
    const session = loadOrCreateSession();
    const next = rememberCode('ab23-k7m');
    expect(next.id).toBe(session.id);
    expect(next.code).toBe('AB23K7M');
    expect(loadOrCreateSession().code).toBe('AB23K7M');
  });

  it('adopts another device session without leaking the previous token', () => {
    const original = loadOrCreateSession();
    const other = generateSessionId();
    const joined = adoptSession(other, 'XYZ2345');
    expect(joined.id).toBe(other);
    expect(joined.id).not.toBe(original.id);
    expect(joined.code).toBe('XYZ2345');
    expect(loadOrCreateSession()).toEqual(joined);
  });
});

describe('relay urls', () => {
  it('derives mcp and websocket urls from the default host', () => {
    expect(relayBaseUrl()).toBe('https://gameclaw-relay.arcobalneo.workers.dev');
    expect(mcpUrl()).toBe('https://gameclaw-relay.arcobalneo.workers.dev/mcp');
    const id = generateSessionId();
    expect(sessionWsUrl(id)).toBe(`wss://gameclaw-relay.arcobalneo.workers.dev/session/${id}`);
  });
});
