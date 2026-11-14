/// <reference types="@cloudflare/workers-types" />

import { handleRequest, RELAY_VERSION, type RoomHandle, type RoomHub } from './app';
import { isSessionId } from './ids';
import type { Json, ToolName } from './protocol';
import type { CodeStore } from './registry';
import { SessionRoomCore, type SocketLike } from './room';

export interface Env {
  SESSION: DurableObjectNamespace;
  REGISTRY: DurableObjectNamespace;
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
    await this.state.storage.put('sessionId', sessionId);
    const room = new SessionRoomCore(sessionId, site, storedCode ?? null);
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
      },
    );
  },
};
