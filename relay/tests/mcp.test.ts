import { describe, expect, it } from 'vitest';
import legacyIds from '../../catalog/legacy-ids.json';
import { handleRequest, RELAY_VERSION } from '../src/app';
import { generateSessionId } from '../src/ids';
import { extractSession, handleMcp, toolList } from '../src/mcp';
import { PAGE_CLOSED_ERROR, TOOL_NAMES } from '../src/protocol';
import { MemoryStore } from '../src/registry';
import { SessionRoomCore, type SocketLike } from '../src/room';

class FakeSocket implements SocketLike {
  readyState = 1;
  sent: string[] = [];
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = 3;
  }
}

describe('tool catalog', () => {
  it('exposes the WebMCP tools, with no hard-coded game list', () => {
    const tools = toolList();
    expect(tools.map((t) => t.name)).toEqual([...TOOL_NAMES]);
    const dumped = JSON.stringify(tools);
    for (const id of [...Object.keys(legacyIds), ...Object.values(legacyIds)]) {
      expect(dumped).not.toContain(id);
    }
  });
});

describe('extractSession', () => {
  const token = generateSessionId();

  it('reads Bearer, custom header, query and tool arg, and ignores junk', () => {
    expect(
      extractSession(
        new Request('https://x/mcp', { headers: { Authorization: `Bearer ${token}` } }),
      ),
    ).toBe(token);
    expect(
      extractSession(new Request('https://x/mcp', { headers: { 'X-GameClaw-Session': token } })),
    ).toBe(token);
    expect(extractSession(new Request(`https://x/mcp?session=${token}`))).toBe(token);
    expect(
      extractSession(new Request('https://x/mcp'), {
        params: { arguments: { session: token } },
      }),
    ).toBe(token);
    expect(
      extractSession(
        new Request('https://x/mcp', { headers: { Authorization: 'Bearer not-a-token' } }),
      ),
    ).toBeNull();
  });
});

describe('handleMcp', () => {
  const token = generateSessionId();
  const site = 'https://arcobalneo.github.io/gameclaw/';

  it('answers initialize, ping and tools/list without a browser', async () => {
    const init = await handleMcp(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      { version: '3.2.0', siteUrl: site, token, call: async () => ({}) },
    );
    expect(init?.result).toMatchObject({
      serverInfo: { name: 'gameclaw-relay', version: '3.2.0' },
    });
    const ping = await handleMcp(
      { jsonrpc: '2.0', id: 2, method: 'ping' },
      { version: '3.2.0', siteUrl: site, token, call: async () => ({}) },
    );
    expect(ping?.result).toEqual({});
    const list = await handleMcp(
      { jsonrpc: '2.0', id: 3, method: 'tools/list' },
      { version: '3.2.0', siteUrl: site, token, call: async () => ({}) },
    );
    expect(list).toBeTruthy();
    expect((list!.result as { tools: { name: string }[] }).tools).toHaveLength(TOOL_NAMES.length);
  });

  it('returns a clear page-closed error when the tab is gone', async () => {
    const res = await handleMcp(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'list_games', arguments: {} },
      },
      {
        version: '3.2.0',
        siteUrl: site,
        token,
        call: async () => {
          const error = new Error(PAGE_CLOSED_ERROR);
          (error as Error & { hint?: string }).hint = 'Open the page.';
          throw error;
        },
      },
    );
    expect(res?.result).toMatchObject({
      isError: true,
      structuredContent: { ok: false, error: PAGE_CLOSED_ERROR },
    });
  });

  it('rejects tools/call without a token', async () => {
    const res = await handleMcp(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'list_games' } },
      { version: '3.2.0', siteUrl: site, token: null, call: async () => ({}) },
    );
    expect(res?.error?.code).toBe(-32001);
  });
});

describe('room + http', () => {
  const site = 'https://arcobalneo.github.io/gameclaw/';

  it('forwards a tool call to the attached browser and returns its payload', async () => {
    const session = generateSessionId();
    const store = new MemoryStore();
    const rooms = new Map<string, SessionRoomCore>();
    const hub = {
      store,
      async getRoom(id: string) {
        let room = rooms.get(id);
        if (!room) {
          room = new SessionRoomCore(id, site);
          rooms.set(id, room);
        }
        return room;
      },
    };

    const closed = await handleRequest(
      new Request('https://relay/mcp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'list_games', arguments: {} },
        }),
      }),
      hub,
      { siteUrl: site, version: RELAY_VERSION },
    );
    const closedBody = (await closed.json()) as {
      result: {
        isError: boolean;
        structuredContent: { ok: boolean; watch_url: string; games: unknown[] };
      };
    };
    expect(closedBody.result.isError).toBe(false);
    expect(closedBody.result.structuredContent.ok).toBe(true);
    expect(closedBody.result.structuredContent.games).toHaveLength(15);
    expect(closedBody.result.structuredContent.watch_url).toMatch(
      /#\/watch\/[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}$/,
    );

    const room = await hub.getRoom(session);
    const socket = new FakeSocket();
    room.attach(socket);
    room.welcome('ABC23XY');
    expect(JSON.parse(socket.sent.at(-1)!)).toMatchObject({ type: 'welcome', code: 'ABC23XY' });

    const pending = handleRequest(
      new Request('https://relay/mcp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'act', arguments: { action_id: 'jump' } },
        }),
      }),
      hub,
      { siteUrl: site },
    );
    await new Promise((r) => setTimeout(r, 10));
    const call = socket.sent.map((s) => JSON.parse(s)).find((m) => m.type === 'call');
    expect(call).toMatchObject({ type: 'call', tool: 'act', args: { action_id: 'jump' } });
    room.handleMessage(
      socket,
      JSON.stringify({ type: 'result', id: call.id, payload: { ok: true, action: 'jump' } }),
    );
    const res = await pending;
    const body = (await res.json()) as {
      result: { structuredContent: { ok: boolean; action: string; watch_url: string } };
    };
    expect(body.result.structuredContent).toMatchObject({ ok: true, action: 'jump' });
    expect(body.result.structuredContent.watch_url).toBe(
      'https://arcobalneo.github.io/gameclaw/#/watch/ABC23XY',
    );
  });

  it('resolves a room code only for the session that owns it', async () => {
    const session = generateSessionId();
    const store = new MemoryStore();
    const rooms = new Map<string, SessionRoomCore>();
    const hub = {
      store,
      async getRoom(id: string) {
        let room = rooms.get(id);
        if (!room) {
          room = new SessionRoomCore(id, site);
          rooms.set(id, room);
        }
        return room;
      },
    };
    const room = await hub.getRoom(session);
    const socket = new FakeSocket();
    room.attach(socket);
    // Prime assignment through a websocket-less welcome path: assign via /mcp initialize?
    // Use the store directly then hit GET /room/:code
    const { assignCode } = await import('../src/registry');
    const code = await assignCode(store, session);
    const ok = await handleRequest(new Request(`https://relay/room/${code}`), hub, {
      siteUrl: site,
    });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { ok: boolean; session: string; code: string };
    expect(body.session).toBe(session);
    expect(body.code).toBe(code);

    const miss = await handleRequest(new Request('https://relay/room/ZZZZZZZ'), hub, {
      siteUrl: site,
    });
    expect(miss.status).toBe(404);

    const health = await handleRequest(new Request('https://relay/health'), hub, { siteUrl: site });
    expect((await health.json()) as { ok: boolean }).toMatchObject({
      ok: true,
      version: RELAY_VERSION,
    });
  });

  it('locks CORS to the Pages origin and localhost', async () => {
    const hub = {
      store: new MemoryStore(),
      async getRoom() {
        return new SessionRoomCore(generateSessionId(), site);
      },
    };
    const allowed = await handleRequest(
      new Request('https://relay/health', { headers: { Origin: 'https://arcobalneo.github.io' } }),
      hub,
      { siteUrl: site },
    );
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://arcobalneo.github.io');

    const local = await handleRequest(
      new Request('https://relay/health', { headers: { Origin: 'http://localhost:5173' } }),
      hub,
      { siteUrl: site },
    );
    expect(local.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');

    const blocked = await handleRequest(
      new Request('https://relay/health', { headers: { Origin: 'https://evil.example' } }),
      hub,
      { siteUrl: site },
    );
    expect(blocked.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
