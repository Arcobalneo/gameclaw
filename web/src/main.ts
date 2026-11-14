import './styles.css';
import { findGame } from './catalog';
import { loadPixelFont } from './gfx/text';
import { lang, onLang, t } from './i18n';
import { createApi, registerWebMcp } from './runtime/agent-api';
import { Home } from './ui/home';
import { Portal } from './ui/portal';
import { topbar } from './ui/topbar';

declare global {
  interface Window {
    gameclaw?: ReturnType<typeof createApi> & { webmcp: string };
  }
}

const VERSION = '3.1.0';

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
  const portal = new Portal(document.body);
  document.body.prepend(topbar(() => portal.closeAll()));
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
