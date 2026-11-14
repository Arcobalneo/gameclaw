const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export const PRODUCTION_ORIGINS = ['https://arcobalneo.github.io'] as const;

export function isAllowedOrigin(origin: string | null, extra: readonly string[] = []): boolean {
  if (!origin) return false;
  if ((PRODUCTION_ORIGINS as readonly string[]).includes(origin)) return true;
  if (extra.includes(origin)) return true;
  return LOCAL.test(origin);
}

export function corsHeaders(
  origin: string | null,
  extra: readonly string[] = [],
): Record<string, string> {
  if (!origin || !isAllowedOrigin(origin, extra)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, X-GameClaw-Session',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id, MCP-Protocol-Version',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
