import './styles.css';
import { findGame } from './catalog';
import { loadPixelFont } from './gfx/text';
import { lang, onLang, t } from './i18n';
import { createApi, registerWebMcp, toolDescriptors } from './runtime/agent-api';
import { mcpUrl, relayBaseUrl, roomLookupUrl } from './runtime/config';
import { startLeaderboard } from './runtime/leaderboard';
import { connectRelay } from './runtime/relay';
import {
  adoptSession,
  isRoomCode,
  loadOrCreateSession,
  normalizeRoomCode,
  rememberCode,
} from './runtime/session';
import { startStats } from './runtime/stats';
import { Home } from './ui/home';
import { siteCountChip } from './ui/play-counts';
import { Portal } from './ui/portal';
import { relayBanner, SessionChip } from './ui/session-chip';
import { topbar } from './ui/topbar';

declare global {
  interface Window {
    gameclaw?: ReturnType<typeof createApi> & {
      webmcp: string;
      session: () => {
        id: string;
        code: string | null;
        relay: string;
        mcp: string;
        status: string;
      };
    };
  }
}

const VERSION = '4.0.0';

function boot(): void {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app missing');
  void loadPixelFont();

  document.documentElement.lang = lang() === 'zh' ? 'zh-CN' : 'en';
  const syncDoc = () => {
    document.documentElement.lang = lang() === 'zh' ? 'zh-CN' : 'en';
    if (!portal.isOpen()) document.title = t('site.title');
    const skip = document.querySelector('.skip');
    if (skip) skip.textContent = t('site.skip');
  };

  let session = loadOrCreateSession();
  const chip = new SessionChip(session);
  const banner = relayBanner();
  const portal = new Portal(document.body);
  document.body.prepend(banner.root);
  document.body.prepend(topbar(() => portal.closeAll(), chip.root));
  document.body.append(siteCountChip());
  startStats();
  startLeaderboard();
  onLang(syncDoc);
  syncDoc();
  const home = new Home((id) => {
    void portal.open(id, 'human');
  });
  app.append(home.root);
  home.start();
  portal.onVisibilityChange = (open) => (open ? home.pause() : home.start());

  const api = createApi(portal, VERSION);
  const mode = registerWebMcp(api);
  portal.webmcpMode = mode;

  const tools = new Map(toolDescriptors(api).map((tool) => [tool.name, tool]));
  const relay = connectRelay({
    session: () => session,
    execute: async (name, args) => {
      const tool = tools.get(name);
      if (!tool) return { ok: false, error: `Unknown tool ${name}` };
      return tool.execute(args);
    },
    onWelcome: (code) => {
      session = rememberCode(code);
      chip.setSession(session);
    },
    onStatus: (status) => {
      chip.setStatus(status);
      banner.setStatus(status);
    },
  });

  const snapshot = () => ({
    id: session.id,
    code: session.code,
    relay: relayBaseUrl(),
    mcp: mcpUrl(),
    status: relay.status,
  });

  window.gameclaw = Object.assign(api, { webmcp: mode, session: snapshot });
  document.documentElement.dataset.webmcp = mode;

  const joinByCode = async (raw: string): Promise<boolean> => {
    const code = normalizeRoomCode(raw);
    if (!isRoomCode(code)) return false;
    try {
      const res = await fetch(roomLookupUrl(code));
      const body = (await res.json()) as { ok?: boolean; session?: string; code?: string };
      if (!res.ok || !body.session) return false;
      session = adoptSession(body.session, body.code ?? code);
      chip.setSession(session);
      relay.reconnect();
      return true;
    } catch {
      return false;
    }
  };
  chip.onJoin = joinByCode;

  const route = () => {
    const roomHash = /^#\/room\/([A-Za-z0-9_-]+)/.exec(location.hash);
    const roomQuery = new URLSearchParams(location.search).get('room');
    const room = roomHash?.[1] ?? roomQuery;
    if (room) void joinByCode(room);
    const play = /^#\/play\/([a-z0-9-]+)/.exec(location.hash);
    if (play && findGame(play[1]!)) void portal.open(play[1]!, 'human');
  };
  window.addEventListener('hashchange', route);
  route();
}

boot();
