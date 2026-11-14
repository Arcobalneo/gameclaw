import { corsHeaders, isAllowedOrigin } from './cors';
import { isRoomCode, isSessionId, normalizeRoomCode } from './ids';
import { extractSession, handleMcp, isJsonRpcRequest, type JsonRpcRequest } from './mcp';
import { type Json, MCP_PROTOCOL_VERSION, type ToolName } from './protocol';
import { codeLookupLimit, mcpLimit } from './rate-limit';
import { assignCode, type CodeStore, resolveCode } from './registry';
import type { SocketLike } from './room';

export const RELAY_VERSION = '3.2.0';

export interface AppEnv {
  siteUrl: string;
  version?: string;
  extraOrigins?: readonly string[];
}

export interface RoomHandle {
  readonly sessionId: string;
  code: string | null;
  welcome(code: string): void | Promise<void>;
  call(tool: ToolName, args: Json): Promise<unknown>;
}

export interface RoomHub {
  store: CodeStore;
  getRoom(sessionId: string): Promise<RoomHandle>;
}

export interface UpgradeHooks {
  /** When the incoming request is a WebSocket upgrade, attach this socket. */
  accept?(
    room: RoomHandle,
  ):
    | Promise<{ socket: SocketLike; response: Response }>
    | { socket: SocketLike; response: Response };
}

const INDEX_BODY = `GameClaw relay

MCP (Streamable HTTP):  POST /mcp
  Authorization: Bearer <session-token>
  JSON-RPC methods: initialize, tools/list, tools/call, ping

Browser WebSocket:      GET  /session/<session-id>  (Upgrade: websocket)
Room lookup:            GET  /room/<code>
Health:                 GET  /health
`;

export function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    request.headers.get('X-Real-IP') ||
    'unknown'
  );
}

function json(
  body: unknown,
  status: number,
  origin: string | null,
  extra: readonly string[] = [],
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin, extra),
    },
  });
}

function text(
  body: string,
  status: number,
  origin: string | null,
  extra: readonly string[] = [],
  type = 'text/plain; charset=utf-8',
): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      ...corsHeaders(origin, extra),
    },
  });
}

function wantsSse(request: Request): boolean {
  const accept = request.headers.get('Accept') ?? '';
  return accept.includes('text/event-stream') && !accept.includes('application/json');
}

function rpcResponse(
  payload: unknown,
  request: Request,
  origin: string | null,
  extra: readonly string[],
  token: string | null,
): Response {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
    'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
    ...corsHeaders(origin, extra),
  };
  if (token) headers['Mcp-Session-Id'] = token;
  if (wantsSse(request)) {
    headers['Content-Type'] = 'text/event-stream; charset=utf-8';
    return new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`, {
      status: 200,
      headers,
    });
  }
  headers['Content-Type'] = 'application/json; charset=utf-8';
  return new Response(JSON.stringify(payload), { status: 200, headers });
}

export async function handleRequest(
  request: Request,
  hub: RoomHub,
  env: AppEnv,
  upgrade?: UpgradeHooks,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const extra = env.extraOrigins ?? [];
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const version = env.version ?? RELAY_VERSION;

  if (request.method === 'OPTIONS') {
    if (origin && !isAllowedOrigin(origin, extra))
      return new Response(null, { status: 403, headers: corsHeaders(origin, extra) });
    return new Response(null, { status: 204, headers: corsHeaders(origin, extra) });
  }

  if (path === '/' && request.method === 'GET') {
    return text(INDEX_BODY, 200, origin, extra);
  }

  if (path === '/health' && request.method === 'GET') {
    return json({ ok: true, version, service: 'gameclaw-relay' }, 200, origin, extra);
  }

  const roomMatch = /^\/room\/([A-Za-z0-9_-]+)$/.exec(path);
  if (
    roomMatch &&
    request.method === 'GET' &&
    request.headers.get('Upgrade')?.toLowerCase() !== 'websocket'
  ) {
    const ip = clientIp(request);
    if (!codeLookupLimit.take(`code:${ip}`)) {
      return json(
        { ok: false, error: 'Too many lookups. Try again in a minute.' },
        429,
        origin,
        extra,
      );
    }
    const code = normalizeRoomCode(roomMatch[1]!);
    if (!isRoomCode(code))
      return json({ ok: false, error: 'Invalid room code.' }, 400, origin, extra);
    const session = await resolveCode(hub.store, code);
    if (!session) return json({ ok: false, error: 'Unknown room code.' }, 404, origin, extra);
    return json({ ok: true, session, code }, 200, origin, extra);
  }

  const sessionMatch = /^\/session\/([A-Za-z0-9_-]+)$/.exec(path);
  const roomWsMatch =
    request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
      ? /^\/room\/([A-Za-z0-9_-]+)$/.exec(path)
      : null;

  if (
    request.headers.get('Upgrade')?.toLowerCase() === 'websocket' &&
    (sessionMatch || roomWsMatch)
  ) {
    let sessionId: string | undefined;
    if (sessionMatch) {
      sessionId = sessionMatch[1];
      if (!sessionId || !isSessionId(sessionId)) {
        return text('Invalid session token.', 400, origin, extra);
      }
    } else if (roomWsMatch) {
      const ip = clientIp(request);
      if (!codeLookupLimit.take(`code:${ip}`)) return text('Too many lookups.', 429, origin, extra);
      const code = normalizeRoomCode(roomWsMatch[1]!);
      sessionId = await resolveCode(hub.store, code);
      if (!sessionId) return text('Unknown room code.', 404, origin, extra);
    }
    if (!sessionId) return text('Missing session.', 400, origin, extra);
    const room = await hub.getRoom(sessionId);
    const code = await assignCode(hub.store, sessionId);
    await room.welcome(code);
    if (!upgrade?.accept)
      return text('WebSocket upgrade is not available here.', 426, origin, extra);
    const accepted = await upgrade.accept(room);
    return accepted.response;
  }

  if (path === '/mcp' || path.startsWith('/mcp/')) {
    if (request.method === 'GET') {
      // Streamable HTTP optional GET: no standalone notifications yet.
      return text(
        'SSE listen is not required; POST JSON-RPC to this endpoint.',
        405,
        origin,
        extra,
      );
    }
    if (request.method !== 'POST') return text('Method not allowed.', 405, origin, extra);
    if (origin && !isAllowedOrigin(origin, extra)) {
      return json({ ok: false, error: 'Origin not allowed.' }, 403, origin, extra);
    }

    let body: unknown;
    const raw = await request.text();
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        return json(
          { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error.' } },
          400,
          origin,
          extra,
        );
      }
    }

    const token = extractSession(request, body);
    if (token && !mcpLimit.take(`mcp:${token}`)) {
      return json(
        { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Rate limited.' } },
        429,
        origin,
        extra,
      );
    }

    const requests: JsonRpcRequest[] = Array.isArray(body)
      ? body.filter(isJsonRpcRequest)
      : isJsonRpcRequest(body)
        ? [body]
        : [];
    if (!requests.length) {
      return json(
        { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request.' } },
        400,
        origin,
        extra,
      );
    }

    const call = async (tool: ToolName, args: Json) => {
      if (!token) {
        const error = new Error('Missing session token.');
        throw error;
      }
      const room = await hub.getRoom(token);
      const code = await assignCode(hub.store, token);
      if (!room.code) await room.welcome(code);
      return room.call(tool, args);
    };

    const results = [];
    for (const rpc of requests) {
      const result = await handleMcp(rpc, {
        version,
        siteUrl: env.siteUrl,
        call,
        token,
      });
      if (result) results.push(result);
    }
    if (!results.length) {
      return new Response(null, { status: 202, headers: corsHeaders(origin, extra) });
    }
    const payload = Array.isArray(body) ? results : results[0];
    return rpcResponse(payload, request, origin, extra, token);
  }

  return json({ ok: false, error: 'Not found.' }, 404, origin, extra);
}
