import { describe, expect, it } from 'vitest';
import { handleRequest } from '../src/app';
import { generateSessionId } from '../src/ids';
import { MemoryStore } from '../src/registry';
import { hashPlayer, MemoryStatsStore, PlayStatsCore } from '../src/stats';

function hub() {
  return {
    store: new MemoryStore(),
    getRoom: async () => {
      throw new Error('no room');
    },
  };
}

function env() {
  return { siteUrl: 'https://arcobalneo.github.io/gameclaw/', version: '3.3.0' };
}

function stats() {
  const core = new PlayStatsCore(new MemoryStatsStore());
  return {
    core,
    get: () => core.get(),
    hello: (player: string, game: string | undefined, ip: string) => core.hello(player, game, ip),
  };
}

describe('play counts', () => {
  it('hashes player ids so the raw id is never stored', async () => {
    const a = await hashPlayer('abcdefghijklmnopqrstuv');
    const b = await hashPlayer('abcdefghijklmnopqrstuv');
    const c = await hashPlayer('abcdefghijklmnopqrstuW');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('GET /stats starts at zero and first-paint is public', async () => {
    const res = await handleRequest(
      new Request('https://relay/stats'),
      hub(),
      env(),
      undefined,
      stats(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, site: 0, games: {} });
  });

  it('counts a unique player once for the site and once per game', async () => {
    const s = stats();
    const origin = 'https://arcobalneo.github.io';
    const player = generateSessionId();
    const hello = (body: object) =>
      handleRequest(
        new Request('https://relay/stats/hello', {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        hub(),
        env(),
        undefined,
        s,
      );

    const first = await hello({ player });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, site: 1, games: {} });

    const again = await hello({ player });
    expect(await again.json()).toEqual({ ok: true, site: 1, games: {} });

    const game = await hello({ player, game: 'shrimp-guard' });
    expect(await game.json()).toEqual({ ok: true, site: 1, games: { 'shrimp-guard': 1 } });

    const gameAgain = await hello({ player, game: 'shrimp-guard' });
    expect(await gameAgain.json()).toEqual({ ok: true, site: 1, games: { 'shrimp-guard': 1 } });

    const other = await hello({ player: generateSessionId(), game: 'shrimp-leap' });
    expect(await other.json()).toEqual({
      ok: true,
      site: 2,
      games: { 'shrimp-guard': 1, 'shrimp-leap': 1 },
    });
  });

  it('rejects bad ids and unknown games, and broadcasts on increment', async () => {
    const s = stats();
    const sent: string[] = [];
    s.core.attach({
      readyState: 1,
      send: (d) => sent.push(String(d)),
      close: () => {},
    });
    const origin = 'https://arcobalneo.github.io';
    const bad = await handleRequest(
      new Request('https://relay/stats/hello', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: 'short' }),
      }),
      hub(),
      env(),
      undefined,
      s,
    );
    expect(bad.status).toBe(400);

    const unknown = await handleRequest(
      new Request('https://relay/stats/hello', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: generateSessionId(), game: 'not-a-game' }),
      }),
      hub(),
      env(),
      undefined,
      s,
    );
    expect(unknown.status).toBe(400);

    await handleRequest(
      new Request('https://relay/stats/hello', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: generateSessionId(), game: 'shrimp-ink' }),
      }),
      hub(),
      env(),
      undefined,
      s,
    );
    expect(sent.length).toBeGreaterThan(0);
    const last = JSON.parse(sent.at(-1)!) as {
      type: string;
      site: number;
      games: Record<string, number>;
    };
    expect(last.type).toBe('stats');
    expect(last.site).toBe(1);
    expect(last.games['shrimp-ink']).toBe(1);
  });
});
