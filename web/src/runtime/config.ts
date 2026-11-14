/** Production relay. Override with ?relay= or VITE_GAMECLAW_RELAY (dev / e2e). */
export const DEFAULT_RELAY = 'https://gameclaw-relay.arcobalneo.workers.dev';
export const DEFAULT_SITE = 'https://arcobalneo.github.io/gameclaw/';

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function relayBaseUrl(): string {
  try {
    const query = new URLSearchParams(location.search).get('relay');
    if (query) return normalize(query);
  } catch {
    /* ignore */
  }
  try {
    const stored = localStorage.getItem('gameclaw:relay');
    if (stored) return normalize(stored);
  } catch {
    /* private mode */
  }
  const env = import.meta.env.VITE_GAMECLAW_RELAY as string | undefined;
  if (env) return normalize(env);
  return DEFAULT_RELAY;
}

export function mcpUrl(base = relayBaseUrl()): string {
  return `${base}/mcp`;
}

export function roomLookupUrl(code: string, base = relayBaseUrl()): string {
  return `${base}/room/${code}`;
}

export function sessionWsUrl(sessionId: string, base = relayBaseUrl()): string {
  const http = new URL(base, typeof location === 'undefined' ? 'http://localhost' : location.href);
  const protocol = http.protocol === 'https:' ? 'wss:' : 'ws:';
  const path = http.pathname.replace(/\/+$/, '');
  return `${protocol}//${http.host}${path}/session/${sessionId}`;
}

export function siteUrl(): string {
  try {
    const { origin, pathname } = window.location;
    return `${origin}${pathname.replace(/index\.html$/, '')}`;
  } catch {
    return DEFAULT_SITE;
  }
}
