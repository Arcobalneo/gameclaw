import { describe, expect, it } from 'vitest';
import { handleRequest } from '../src/app';
import { LeaderboardCore, MemoryBoardStore } from '../src/leaderboard';
import { MemoryStore } from '../src/registry';

function env() {
  return { siteUrl: 'https://arcobalneo.github.io/gameclaw/', version: '4.0.0' };
}

function boards(now = () => 1_000) {
  const core = new LeaderboardCore(new MemoryBoardStore(), now);
  return {
    core,
    get: () => core.get(),
    submit: (input: Parameters<LeaderboardCore['submit']>[0], ip: string) => core.submit(input, ip),
  };
}

const hub = {
  store: new MemoryStore(),
  getRoom: async () => {
    throw new Error('no room');
  },
};

function submit(body: object, b = boards()) {
  return handleRequest(
    new Request('https://relay/leaderboard', {
      method: 'POST',
      headers: { Origin: 'https://arcobalneo.github.io', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    hub,
    env(),
    undefined,
    undefined,
    b,
  );
}

const run = (n: string) => `run-${n}-xxxxxxxx`;

describe('leaderboard rule', () => {
  it('starts empty on GET', async () => {
    const res = await handleRequest(
      new Request('https://relay/leaderboard'),
      hub,
      env(),
      undefined,
      undefined,
      boards(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, rule: 'best-per-game', games: {}, total: [] });
  });

  it('keeps the best per game and sums those bests on the site board', async () => {
    const b = boards();
    const first = await submit(
      {
        name: '  Ace  ',
        game: 'shrimp-trek',
        score: 400,
        outcome: 'won',
        turn: 12,
        run: run('1'),
      },
      b,
    );
    expect(first.status).toBe(200);
    const body = (await first.json()) as { accepted: boolean; best: number };
    expect(body.accepted).toBe(true);
    expect(body.best).toBe(400);

    const worse = await submit(
      {
        name: 'ace',
        game: 'shrimp-trek',
        score: 100,
        outcome: 'lost',
        turn: 4,
        run: run('2'),
      },
      b,
    );
    const worseBody = (await worse.json()) as {
      accepted: boolean;
      reason: string;
      best: number;
      boards: { total: { name: string; score: number }[] };
    };
    expect(worseBody.accepted).toBe(false);
    expect(worseBody.reason).toBe('not_best');
    expect(worseBody.best).toBe(400);

    await submit(
      {
        name: 'Ace',
        game: 'shrimp-guard',
        score: 250,
        outcome: 'won',
        turn: 8,
        run: run('3'),
      },
      b,
    );
    await submit(
      {
        name: '贝',
        game: 'shrimp-guard',
        score: 900,
        outcome: 'won',
        turn: 9,
        run: run('4'),
      },
      b,
    );

    const snap = await b.get();
    expect(snap.games['shrimp-trek']?.[0]).toMatchObject({ name: 'Ace', score: 400 });
    expect(snap.total.map((row) => [row.name, row.score])).toEqual([
      ['贝', 900],
      ['Ace', 650],
    ]);
  });

  it('rejects a second submit of the same run and rejects bad payloads', async () => {
    const b = boards();
    const body = {
      name: '虾王',
      game: 'shrimp-leap',
      score: 80,
      outcome: 'won',
      turn: 3,
      run: run('same'),
    };
    expect(((await (await submit(body, b)).json()) as { accepted: boolean }).accepted).toBe(true);
    const again = (await (await submit(body, b)).json()) as { reason: string; best: number };
    expect(again.reason).toBe('duplicate');
    expect(again.best).toBe(80);

    expect((await submit({ ...body, run: run('ab'), outcome: 'aborted' }, b)).status).toBe(400);
    expect((await submit({ ...body, run: run('bad'), name: 'http://no' }, b)).status).toBe(400);
    expect((await submit({ ...body, run: run('game'), game: 'not-a-game' }, b)).status).toBe(400);
    expect((await submit({ ...body, run: run('zero'), score: 0 }, b)).status).toBe(400);
  });

  it('answers get_leaderboard on MCP without a page', async () => {
    const b = boards();
    await submit(
      {
        name: 'Neo',
        game: 'shrimp-ink',
        score: 500,
        outcome: 'lost',
        turn: 6,
        run: run('ink'),
      },
      b,
    );
    const res = await handleRequest(
      new Request('https://relay/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'get_leaderboard', arguments: {} },
        }),
      }),
      hub,
      env(),
      undefined,
      undefined,
      b,
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      result: { structuredContent: { entries: { name: string; score: number }[] } };
    };
    expect(payload.result.structuredContent.entries[0]).toMatchObject({ name: 'Neo', score: 500 });
  });
});
