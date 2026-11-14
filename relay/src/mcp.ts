import { isSessionId } from './ids';
import {
  isToolName,
  type Json,
  MCP_PROTOCOL_VERSION,
  PAGE_CLOSED_ERROR,
  pageClosedHint,
  TOOL_NAMES,
  type ToolName,
} from './protocol';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const TOOL_SCHEMA: Record<
  ToolName,
  { description: string; properties: Json; required?: string[]; readOnly?: boolean }
> = {
  list_games: {
    description: 'List every GameClaw game playable in the open page, with its goal.',
    properties: {},
    readOnly: true,
  },
  open_game: {
    description: 'Open (and focus) a game window so the human can watch; resumes its saved run.',
    properties: {
      game_id: { type: 'string', description: 'Game id from list_games.' },
    },
    required: ['game_id'],
  },
  new_game: {
    description:
      'Start a fresh deterministic run in a game window. Same seed + same actions = same run.',
    properties: {
      game_id: {
        type: 'string',
        description: 'Game id from list_games. Defaults to the focused window.',
      },
      seed: { type: 'integer', minimum: 0, description: 'Optional seed for a reproducible run.' },
      difficulty: { type: 'string', enum: ['easy', 'normal', 'hard'] },
    },
  },
  get_state: {
    description: 'Read the current run: headline, metrics, sections, outcome and legal actions.',
    properties: {
      game_id: { type: 'string', description: 'Game id. Defaults to the focused window.' },
    },
    readOnly: true,
  },
  list_actions: {
    description: 'List the legal actions for the current turn.',
    properties: {
      game_id: { type: 'string', description: 'Game id. Defaults to the focused window.' },
    },
    readOnly: true,
  },
  act: {
    description:
      'Take exactly one action; it animates in the shared game window. Returns log, new state and next actions.',
    properties: {
      action_id: {
        type: 'string',
        description: 'An id from list_actions (a unique prefix or 1-based index also works).',
      },
      game_id: { type: 'string', description: 'Game id. Defaults to the focused window.' },
    },
    required: ['action_id'],
  },
  recap: {
    description:
      'Settlement for the run: outcome, cause, metrics, timeline and lessons worth remembering.',
    properties: {
      game_id: { type: 'string', description: 'Game id. Defaults to the focused window.' },
    },
    readOnly: true,
  },
};

export function toolList() {
  return TOOL_NAMES.map((name) => {
    const spec = TOOL_SCHEMA[name];
    return {
      name,
      description: spec.description,
      inputSchema: {
        type: 'object',
        properties: {
          ...spec.properties,
          session: {
            type: 'string',
            description: 'Optional session token if the Authorization header is missing.',
          },
        },
        ...(spec.required ? { required: spec.required } : {}),
      },
      ...(spec.readOnly ? { annotations: { readOnlyHint: true } } : {}),
    };
  });
}

export function extractSession(request: Request, body?: unknown): string | null {
  const auth = request.headers.get('Authorization');
  if (auth) {
    const match = /^Bearer\s+(\S+)/i.exec(auth);
    if (match && isSessionId(match[1]!)) return match[1]!;
  }
  const header = request.headers.get('X-GameClaw-Session');
  if (header && isSessionId(header)) return header;
  const mcpSession = request.headers.get('Mcp-Session-Id');
  if (mcpSession && isSessionId(mcpSession)) return mcpSession;
  const query = new URL(request.url).searchParams.get('session');
  if (query && isSessionId(query)) return query;
  if (body && typeof body === 'object') {
    const record = body as Json;
    if (typeof record.session === 'string' && isSessionId(record.session)) return record.session;
    const params = record.params;
    if (params && typeof params === 'object') {
      const args = (params as Json).arguments;
      if (args && typeof args === 'object') {
        const session = (args as Json).session;
        if (typeof session === 'string' && isSessionId(session)) return session;
      }
    }
  }
  return null;
}

export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== 'object') return false;
  const rec = value as Json;
  return rec.jsonrpc === '2.0' && typeof rec.method === 'string';
}

export async function handleMcp(
  request: JsonRpcRequest,
  opts: {
    version: string;
    siteUrl: string;
    call: (tool: ToolName, args: Json) => Promise<unknown>;
    token: string | null;
  },
): Promise<JsonRpcResponse | null> {
  const id = request.id ?? null;
  if (request.id === undefined) return null;

  const fail = (code: number, message: string, data?: unknown): JsonRpcResponse => ({
    jsonrpc: '2.0',
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  });

  switch (request.method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'gameclaw-relay', version: opts.version },
          instructions:
            'Use Authorization: Bearer <session-token> on every call. The token is in the prompt the human copied from the GameClaw page. Tools run in that open browser tab so the human sees every move.',
        },
      };
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: toolList() } };
    case 'tools/call': {
      if (!opts.token) {
        return fail(-32001, 'Missing session token.', {
          hint: 'Set Authorization: Bearer <token> (the token is in the GameClaw agent prompt) or pass session in the tool arguments.',
        });
      }
      const params = (request.params ?? {}) as Json;
      const name = typeof params.name === 'string' ? params.name : '';
      if (!isToolName(name)) return fail(-32602, `Unknown tool: ${name || '(none)'}`);
      const args = (
        params.arguments && typeof params.arguments === 'object' ? (params.arguments as Json) : {}
      ) as Json;
      try {
        const data = await opts.call(name, args);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(data) }],
            structuredContent: data,
            isError: false,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const hint =
          (error as { hint?: string }).hint ??
          (message === PAGE_CLOSED_ERROR ? pageClosedHint(opts.siteUrl) : undefined);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ ok: false, error: message, hint }) }],
            structuredContent: { ok: false, error: message, ...(hint ? { hint } : {}) },
            isError: true,
          },
        };
      }
    }
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;
    default:
      return fail(-32601, `Method not found: ${request.method}`);
  }
}
