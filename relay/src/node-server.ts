/**
 * Local / fallback relay. Same HTTP + WebSocket contract as the Cloudflare Worker.
 * Run with: bun relay/src/node-server.ts
 */
import { handleRequest, RELAY_VERSION, type RoomHub, type StatsHub } from './app';
import { isSessionId } from './ids';
import { MemoryStore } from './registry';
import { SessionRoomCore, type SocketLike } from './room';
import { MemoryStatsStore, PlayStatsCore } from './stats';

const PORT = Number(process.env.GAMECLAW_RELAY_PORT ?? process.env.PORT ?? 8787);
const SITE = process.env.GAMECLAW_SITE_URL ?? 'https://arcobalneo.github.io/gameclaw/';
const EXTRA = (process.env.GAMECLAW_EXTRA_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const store = new MemoryStore();
const rooms = new Map<string, SessionRoomCore>();
const statsCore = new PlayStatsCore(new MemoryStatsStore());
const statsHub: StatsHub = {
  core: statsCore,
  get: () => statsCore.get(),
  hello: (playerId, game, ip) => statsCore.hello(playerId, game, ip),
};

const hub: RoomHub = {
  store,
  async getRoom(sessionId: string) {
    if (!isSessionId(sessionId)) throw new Error('invalid session id');
    let room = rooms.get(sessionId);
    if (!room) {
      room = new SessionRoomCore(sessionId, SITE);
      rooms.set(sessionId, room);
    }
    return room;
  },
};

const env = { siteUrl: SITE, version: RELAY_VERSION, extraOrigins: EXTRA };

function bunSocket(ws: {
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  readyState: number;
}): SocketLike {
  return {
    send: (data) => ws.send(data),
    close: (code, reason) => ws.close(code, reason),
    get readyState() {
      return ws.readyState;
    },
  };
}

type WsData =
  | { kind: 'room'; room: SessionRoomCore; socket?: SocketLike }
  | { kind: 'stats'; socket?: SocketLike };

const server = Bun.serve<WsData>({
  port: PORT,
  idleTimeout: 120,
  async fetch(request, serverRef) {
    const url = new URL(request.url);
    const isWs =
      request.headers.get('Upgrade')?.toLowerCase() === 'websocket' ||
      request.headers.get('Connection')?.toLowerCase().includes('upgrade');
    if (isWs && (url.pathname.startsWith('/session/') || url.pathname.startsWith('/room/'))) {
      return handleRequest(
        request,
        hub,
        env,
        {
          accept(room) {
            const upgraded = serverRef.upgrade(request, { data: { kind: 'room', room } });
            if (!upgraded) {
              return {
                socket: { send() {}, close() {}, readyState: 3 },
                response: new Response('Upgrade failed.', { status: 500 }),
              };
            }
            // The socket is attached in open(). Dummy return; Bun already sent 101.
            return {
              socket: { send() {}, close() {}, readyState: 0 },
              response: new Response(null, { status: 101 }),
            };
          },
          acceptStats() {
            const upgraded = serverRef.upgrade(request, { data: { kind: 'stats' } });
            if (!upgraded) {
              return {
                socket: { send() {}, close() {}, readyState: 3 },
                response: new Response('Upgrade failed.', { status: 500 }),
              };
            }
            return {
              socket: { send() {}, close() {}, readyState: 0 },
              response: new Response(null, { status: 101 }),
            };
          },
        },
        statsHub,
      );
    }
    if (isWs && url.pathname.replace(/\/+$/, '') === '/stats/live') {
      return handleRequest(
        request,
        hub,
        env,
        {
          acceptStats() {
            const upgraded = serverRef.upgrade(request, { data: { kind: 'stats' } });
            if (!upgraded) {
              return {
                socket: { send() {}, close() {}, readyState: 3 },
                response: new Response('Upgrade failed.', { status: 500 }),
              };
            }
            return {
              socket: { send() {}, close() {}, readyState: 0 },
              response: new Response(null, { status: 101 }),
            };
          },
        },
        statsHub,
      );
    }
    return handleRequest(request, hub, env, undefined, statsHub);
  },
  websocket: {
    open(ws) {
      const socket = bunSocket(ws);
      ws.data.socket = socket;
      if (ws.data.kind === 'stats') void statsCore.welcome(socket);
      else ws.data.room.attach(socket);
    },
    message(ws, message) {
      if (ws.data.kind === 'stats') return;
      const socket = ws.data.socket;
      if (!socket) return;
      const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
      ws.data.room.handleMessage(socket, raw);
    },
    close(ws) {
      const socket = ws.data.socket;
      if (!socket) return;
      if (ws.data.kind === 'stats') statsCore.detach(socket);
      else ws.data.room.detach(socket);
    },
  },
});

console.log(`gameclaw-relay ${RELAY_VERSION}  http://127.0.0.1:${server.port}/mcp`);
