/** Wire types between the browser tab, the relay, and the remote MCP client. */

export const RELAY_PROTOCOL = 1;
export const MCP_PROTOCOL_VERSION = '2025-03-26';

export type Json = Record<string, unknown>;

export const TOOL_NAMES = [
  'list_games',
  'open_game',
  'new_game',
  'get_state',
  'list_actions',
  'act',
  'recap',
  'get_leaderboard',
  'submit_score',
  'set_language',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type ClientMessage =
  | { type: 'hello' }
  | { type: 'result'; id: string; payload: unknown }
  | { type: 'pong'; id?: string };

export type ServerMessage =
  | { type: 'welcome'; code: string }
  | { type: 'call'; id: string; tool: string; args: Json }
  | { type: 'ping'; id?: string }
  | { type: 'error'; error: string; hint?: string };

export const PAGE_CLOSED_ERROR = 'The GameClaw page is not connected.';

export function pageClosedHint(siteUrl: string): string {
  const url = siteUrl.replace(/\/?$/, '/');
  return `Open ${url} in a browser to spectate. The room code is in the header.`;
}

export function isToolName(value: string): value is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(value);
}

export function parseClientMessage(raw: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || !('type' in value)) return null;
  const type = (value as { type: unknown }).type;
  if (type === 'hello' || type === 'pong') return value as ClientMessage;
  if (type === 'result' && typeof (value as { id?: unknown }).id === 'string') {
    return value as ClientMessage;
  }
  return null;
}
