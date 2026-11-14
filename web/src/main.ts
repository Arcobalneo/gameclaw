import './styles.css';
import { findGame } from './catalog';
import { loadPixelFont } from './gfx/text';
import { createApi, registerWebMcp } from './runtime/agent-api';
import { Home } from './ui/home';
import { Portal } from './ui/portal';

declare global {
  interface Window {
    gameclaw?: ReturnType<typeof createApi> & { webmcp: string };
  }
}

const VERSION = '3.0.0';

function boot(): void {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app missing');
  void loadPixelFont();

  const portal = new Portal(document.body);
  const home = new Home((id) => {
    void portal.open(id, 'human');
  });
  app.append(home.root);
  home.start();
  portal.onVisibilityChange = (open) => (open ? home.pause() : home.start());

  const api = createApi(portal, VERSION);
  const mode = registerWebMcp(api);
  portal.webmcpMode = mode;
  window.gameclaw = Object.assign(api, { webmcp: mode });
  document.documentElement.dataset.webmcp = mode;

  const route = () => {
    const m = /^#\/play\/([a-z0-9-]+)/.exec(location.hash);
    if (m && findGame(m[1]!)) void portal.open(m[1]!, 'human');
  };
  window.addEventListener('hashchange', route);
  route();
}

boot();
