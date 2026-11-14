import { describe, expect, it } from 'vitest';
import { handleRequest, RELAY_VERSION } from '../src/app';
import { generateSessionId } from '../src/ids';
import { LeaderboardCore, MemoryBoardStore } from '../src/leaderboard';
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

const site = 'https://arcobalneo.github.io/gameclaw/';

function hubFor(rooms: Map<string, SessionRoomCore>) {
  return {
    store: new MemoryStore(),
    async getRoom(id: string) {
      let room = rooms.get(id);
      if (!room) {
        room = new SessionRoomCore(id, site);
        rooms.set(id, room);
      }
      return room;
    },
  };
}

async function call(
  hub: ReturnType<typeof hubFor>,
  session: string,
  name: string,
  args: Record<string, unknown>,
  id: number,
) {
  const res = await handleRequest(
    new Request('https://relay/mcp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    }),
    hub,
    { siteUrl: site, version: RELAY_VERSION },
    undefined,
    undefined,
    {
      core: new LeaderboardCore(new MemoryBoardStore()),
      async get() {
        return { rule: 'best-per-game' as const, games: {}, total: [] };
      },
      submit(input, ip) {
        return this.core.submit(input, ip);
      },
    },
  );
  return (await res.json()) as {
    result: {
      isError: boolean;
      structuredContent: {
        ok: boolean;
        error?: string;
        watch_url?: string;
        game_id?: string;
        state?: { turn: number; outcome: string };
        actions?: { id: string }[];
        accepted?: boolean;
      };
    };
  };
}

describe('headless play', () => {
  it('plays with no tab, returns a watch url, and resumes that run on attach', async () => {
    const session = generateSessionId();
    const rooms = new Map<string, SessionRoomCore>();
    const hub = hubFor(rooms);
    const started = await call(hub, session, 'new_game', { game_id: 'shrimp-leap', seed: 7 }, 1);
    expect(started.result.isError).toBe(false);
    expect(started.result.structuredContent.ok).toBe(true);
    expect(started.result.structuredContent.game_id).toBe('shrimp-leap');
    expect(started.result.structuredContent.state?.outcome).toBe('ongoing');
    expect(started.result.structuredContent.watch_url).toMatch(
      /^https:\/\/arcobalneo\.github\.io\/gameclaw\/#\/watch\/[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}$/,
    );
    const action = started.result.structuredContent.actions?.find((item) => item.id !== 'abort');
    expect(action?.id).toBeTruthy();
    const moved = await call(
      hub,
      session,
      'act',
      { game_id: 'shrimp-leap', action_id: action!.id },
      2,
    );
    expect(moved.result.structuredContent.ok).toBe(true);
    expect(moved.result.structuredContent.state?.turn).toBeGreaterThan(0);
    expect(moved.result.structuredContent.watch_url).toBe(
      started.result.structuredContent.watch_url,
    );

    const room = await hub.getRoom(session);
    const socket = new FakeSocket();
    room.attach(socket);
    const run = socket.sent
      .map(
        (line) =>
          JSON.parse(line) as {
            type: string;
            desk?: { focused: string; games: Record<string, { snapshot: { turn: number } }> };
          },
      )
      .find((message) => message.type === 'run');
    expect(run?.desk?.focused).toBe('shrimp-leap');
    expect(run?.desk?.games['shrimp-leap']?.snapshot.turn).toBe(
      moved.result.structuredContent.state?.turn,
    );
  });
});
