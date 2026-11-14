/// <reference types="@cloudflare/workers-types" />

import {
  type BoardHub,
  handleRequest,
  RELAY_VERSION,
  type RoomHandle,
  type RoomHub,
  type StatsHub,
} from './app';
import { isSessionId } from './ids';
import { type BoardFile, type BoardStore, LeaderboardCore, type SubmitInput } from './leaderboard';
import type { Json, StoredDesk, ToolName } from './protocol';
import type { CodeStore } from './registry';
import { SessionRoomCore, type SocketLike } from './room';
import { type PlayCounts, PlayStatsCore, type StatsStore } from './stats';

export interface Env {
  SESSION: DurableObjectNamespace;
  REGISTRY: DurableObjectNamespace;
  STATS: DurableObjectNamespace;
  BOARD: DurableObjectNamespace;
  GAMECLAW_SITE_URL?: string;
}

const SITE_DEFAULT = 'https://arcobalneo.github.io/gameclaw/';

class RegistryStore implements CodeStore {
  constructor(private readonly stub: DurableObjectStub) {}

  async getSession(code: string): Promise<string | undefined> {
    const res = await this.stub.fetch(
      `https://registry/get-session?code=${encodeURIComponent(code)}`,
    );
    if (!res.ok) return undefined;
    const body = (await res.json()) as { session?: string };
    return body.session;
  }

  async getCode(sessionId: string): Promise<string | undefined> {
    const res = await this.stub.fetch(
      `https://registry/get-code?session=${encodeURIComponent(sessionId)}`,
    );
    if (!res.ok) return undefined;
    const body = (await res.json()) as { code?: string };
    return body.code;
  }

  async bind(code: string, sessionId: string): Promise<void> {
    await this.stub.fetch('https://registry/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, sessionId }),
    });
  }
}

export class CodeRegistry implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/get-session') {
      const code = url.searchParams.get('code') ?? '';
      const session = await this.state.storage.get<string>(`code:${code}`);
      return Response.json({ session });
    }
    if (url.pathname === '/get-code') {
      const session = url.searchParams.get('session') ?? '';
      const code = await this.state.storage.get<string>(`session:${session}`);
      return Response.json({ code });
    }
    if (url.pathname === '/bind' && request.method === 'POST') {
      const body = (await request.json()) as { code: string; sessionId: string };
      await this.state.storage.put(`code:${body.code}`, body.sessionId);
      await this.state.storage.put(`session:${body.sessionId}`, body.code);
      return new Response(null, { status: 204 });
    }
    return new Response('not found', { status: 404 });
  }
}

function wrapSocket(ws: WebSocket): SocketLike {
  return {
    send: (data) => ws.send(data),
    close: (code, reason) => ws.close(code, reason),
    get readyState() {
      return ws.readyState;
    },
  };
}

export class SessionRoom implements DurableObject {
  #core: SessionRoomCore | null = null;
  readonly #sockets = new WeakMap<WebSocket, SocketLike>();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async #ensure(sessionId: string): Promise<SessionRoomCore> {
    if (this.#core) return this.#core;
    const site = this.env.GAMECLAW_SITE_URL ?? SITE_DEFAULT;
    const storedCode = await this.state.storage.get<string>('code');
    const storedDesk = await this.state.storage.get<StoredDesk>('desk');
    await this.state.storage.put('sessionId', sessionId);
    const room = new SessionRoomCore(sessionId, site, storedCode ?? null);
    if (storedDesk) room.loadDesk(storedDesk);
    room.onDesk((desk) => {
      void this.state.storage.put('desk', structuredClone(desk));
    });
    for (const ws of this.state.getWebSockets()) {
      const socket = wrapSocket(ws);
      this.#sockets.set(ws, socket);
      room.attach(socket);
    }
    this.#core = room;
    return room;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session') ?? '';
    if (!isSessionId(sessionId)) return new Response('invalid session', { status: 400 });
    const room = await this.#ensure(sessionId);

    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.state.acceptWebSocket(server);
      const socket = wrapSocket(server);
      this.#sockets.set(server, socket);
      room.attach(socket);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/welcome' && request.method === 'POST') {
      const body = (await request.json()) as { code: string };
      await this.state.storage.put('code', body.code);
      room.welcome(body.code);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === '/call' && request.method === 'POST') {
      const body = (await request.json()) as { tool: ToolName; args: Json };
      try {
        const payload = await room.call(body.tool, body.args);
        return Response.json({ ok: true, payload });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const hint = (error as { hint?: string }).hint;
        return Response.json({ ok: false, error: message, hint });
      }
    }

    return new Response('not found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const sessionId = (await this.state.storage.get<string>('sessionId')) ?? '';
    if (!isSessionId(sessionId)) return;
    const room = await this.#ensure(sessionId);
    let socket = this.#sockets.get(ws);
    if (!socket) {
      socket = wrapSocket(ws);
      this.#sockets.set(ws, socket);
      room.attach(socket);
    }
    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
    room.handleMessage(socket, raw);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const socket = this.#sockets.get(ws);
    if (socket) this.#core?.detach(socket);
  }
}

class DoRoom implements RoomHandle {
  code: string | null = null;

  constructor(
    readonly sessionId: string,
    private readonly stub: DurableObjectStub,
  ) {}

  async welcome(code: string): Promise<void> {
    this.code = code;
    await this.stub.fetch(`https://room/welcome?session=${this.sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
  }

  async call(tool: ToolName, args: Json): Promise<unknown> {
    const res = await this.stub.fetch(`https://room/call?session=${this.sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, args }),
    });
    const body = (await res.json()) as {
      ok: boolean;
      payload?: unknown;
      error?: string;
      hint?: string;
    };
    if (!body.ok) {
      const error = new Error(body.error ?? 'call failed');
      (error as Error & { hint?: string }).hint = body.hint;
      throw error;
    }
    return body.payload;
  }

  async connect(request: Request): Promise<Response> {
    const url = new URL('https://room/connect');
    url.searchParams.set('session', this.sessionId);
    return this.stub.fetch(new Request(url.toString(), { headers: request.headers }));
  }
}

class DoStatsStore implements StatsStore {
  constructor(private readonly state: DurableObjectState) {}

  async getSite(): Promise<number> {
    return (await this.state.storage.get<number>('site')) ?? 0;
  }
  async setSite(n: number): Promise<void> {
    await this.state.storage.put('site', n);
  }
  async getGame(id: string): Promise<number> {
    return (await this.state.storage.get<number>(`game:${id}`)) ?? 0;
  }
  async setGame(id: string, n: number): Promise<void> {
    await this.state.storage.put(`game:${id}`, n);
  }
  async hasSeen(key: string): Promise<boolean> {
    return (await this.state.storage.get<number>(`seen:${key}`)) === 1;
  }
  async markSeen(key: string): Promise<void> {
    await this.state.storage.put(`seen:${key}`, 1);
  }
}

export class PlayStats implements DurableObject {
  #core: PlayStatsCore | null = null;
  readonly #sockets = new WeakMap<WebSocket, SocketLike>();

  constructor(private readonly state: DurableObjectState) {}

  #ensure(): PlayStatsCore {
    if (!this.#core) {
      this.#core = new PlayStatsCore(new DoStatsStore(this.state));
      for (const ws of this.state.getWebSockets()) {
        const socket = wrapSocket(ws);
        this.#sockets.set(ws, socket);
        this.#core.attach(socket);
      }
    }
    return this.#core;
  }

  async fetch(request: Request): Promise<Response> {
    const core = this.#ensure();
    const url = new URL(request.url);

    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.state.acceptWebSocket(server);
      const socket = wrapSocket(server);
      this.#sockets.set(server, socket);
      await core.welcome(socket);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/get') {
      return Response.json(await core.get());
    }
    if (url.pathname === '/hello' && request.method === 'POST') {
      const body = (await request.json()) as { player: string; game?: string; ip: string };
      const result = await core.hello(body.player, body.game, body.ip);
      return Response.json(result);
    }
    return new Response('not found', { status: 404 });
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const socket = this.#sockets.get(ws);
    if (socket) this.#core?.detach(socket);
  }
}

class DoBoardStore implements BoardStore {
  constructor(private readonly state: DurableObjectState) {}

  async load(): Promise<BoardFile> {
    return (
      (await this.state.storage.get<BoardFile>('board')) ?? {
        games: {},
        seen: [],
      }
    );
  }

  async save(file: BoardFile): Promise<void> {
    await this.state.storage.put('board', file);
  }
}

export class Leaderboard implements DurableObject {
  #core: LeaderboardCore | null = null;
  readonly #sockets = new WeakMap<WebSocket, SocketLike>();

  constructor(private readonly state: DurableObjectState) {}

  #ensure(): LeaderboardCore {
    if (!this.#core) {
      this.#core = new LeaderboardCore(new DoBoardStore(this.state));
      for (const ws of this.state.getWebSockets()) {
        const socket = wrapSocket(ws);
        this.#sockets.set(ws, socket);
        this.#core.attach(socket);
      }
    }
    return this.#core;
  }

  async fetch(request: Request): Promise<Response> {
    const core = this.#ensure();
    const url = new URL(request.url);
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.state.acceptWebSocket(server);
      const socket = wrapSocket(server);
      this.#sockets.set(server, socket);
      await core.welcome(socket);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/get') return Response.json(await core.get());
    if (url.pathname === '/submit' && request.method === 'POST') {
      const body = (await request.json()) as { input: SubmitInput; ip: string };
      return Response.json(await core.submit(body.input, body.ip));
    }
    return new Response('not found', { status: 404 });
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const socket = this.#sockets.get(ws);
    if (socket) this.#core?.detach(socket);
  }
}

class WorkerBoardHub implements BoardHub {
  readonly core: LeaderboardCore;

  constructor(private readonly stub: DurableObjectStub) {
    this.core = new LeaderboardCore({
      load: () => ({ games: {}, seen: [] }),
      save: () => {},
    });
  }

  async get() {
    const res = await this.stub.fetch('https://board/get');
    return (await res.json()) as Awaited<ReturnType<LeaderboardCore['get']>>;
  }

  async submit(input: SubmitInput, ip: string) {
    const res = await this.stub.fetch('https://board/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, ip }),
    });
    return (await res.json()) as Awaited<ReturnType<LeaderboardCore['submit']>>;
  }

  async connect(request: Request): Promise<Response> {
    return this.stub.fetch(new Request('https://board/live', { headers: request.headers }));
  }
}

class WorkerStatsHub implements StatsHub {
  readonly core: PlayStatsCore;

  constructor(private readonly stub: DurableObjectStub) {
    // The live socket set lives inside the Durable Object; this core is unused
    // for broadcasts and only satisfies the StatsHub type.
    this.core = new PlayStatsCore({
      getSite: () => 0,
      setSite: () => {},
      getGame: () => 0,
      setGame: () => {},
      hasSeen: () => false,
      markSeen: () => {},
    });
  }

  async get(): Promise<PlayCounts> {
    const res = await this.stub.fetch('https://stats/get');
    return (await res.json()) as PlayCounts;
  }

  async hello(playerId: string, game: string | undefined, ip: string) {
    const res = await this.stub.fetch('https://stats/hello', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: playerId, game, ip }),
    });
    return (await res.json()) as Awaited<ReturnType<PlayStatsCore['hello']>>;
  }

  async connect(request: Request): Promise<Response> {
    return this.stub.fetch(new Request('https://stats/live', { headers: request.headers }));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const siteUrl = env.GAMECLAW_SITE_URL ?? SITE_DEFAULT;
    const store = new RegistryStore(env.REGISTRY.get(env.REGISTRY.idFromName('global')));
    const proxied = new Map<string, DoRoom>();

    const hub: RoomHub = {
      store,
      async getRoom(sessionId: string) {
        let room = proxied.get(sessionId);
        if (!room) {
          const stub = env.SESSION.get(env.SESSION.idFromName(sessionId));
          room = new DoRoom(sessionId, stub);
          proxied.set(sessionId, room);
        }
        return room;
      },
    };

    const statsHub = new WorkerStatsHub(env.STATS.get(env.STATS.idFromName('global')));
    const boardHub = new WorkerBoardHub(env.BOARD.get(env.BOARD.idFromName('global')));
    return handleRequest(
      request,
      hub,
      { siteUrl, version: RELAY_VERSION },
      {
        async accept(room) {
          if (!(room instanceof DoRoom)) {
            return {
              socket: { send() {}, close() {}, readyState: 3 },
              response: new Response('upgrade failed', { status: 500 }),
            };
          }
          const response = await room.connect(request);
          return { socket: { send() {}, close() {}, readyState: 1 }, response };
        },
        async acceptStats() {
          const response = await statsHub.connect(request);
          return { socket: { send() {}, close() {}, readyState: 1 }, response };
        },
        async acceptBoard() {
          const response = await boardHub.connect(request);
          return { socket: { send() {}, close() {}, readyState: 1 }, response };
        },
      },
      statsHub,
      boardHub,
    );
  },
};
