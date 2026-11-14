import { findGame, GAMES, gameName } from '../catalog';
import { lang, onLang, t } from '../i18n';
import type { PortalController } from '../runtime/agent-api';
import { type GameHost, getHost } from '../runtime/host';
import { clear, h } from './dom';
import { GameView } from './game-view';
import { isMuted, setMuted, sfx } from './sfx';

/**
 * Window manager: one launcher-style window frame with a tab per opened game.
 * Humans and agents share it — `open()` is what both the grid and the WebMCP
 * `open_game` tool call, so an agent's moves animate where the human watches.
 */
export class Portal implements PortalController {
  readonly #views = new Map<string, GameView>();
  readonly #pending = new Map<string, Promise<GameHost>>();
  #focused: string | null = null;
  readonly #frame: HTMLElement;
  readonly #tabs: HTMLElement;
  readonly #body: HTMLElement;
  readonly #title: HTMLElement;
  readonly #loading: HTMLElement;
  readonly #loadingText: HTMLElement;
  readonly #muteBtn: HTMLButtonElement;
  #lastFocus: Element | null = null;
  webmcpMode = 'pending';
  onVisibilityChange: ((open: boolean) => void) | null = null;

  readonly #btns: { label: () => string; el: HTMLButtonElement }[] = [];

  constructor(mount: HTMLElement) {
    this.#tabs = h('nav', { class: 'pw-tabs' });
    this.#title = h('h2', { class: 'pw-title', id: 'pw-title' });
    this.#body = h('div', { class: 'pw-body' });
    this.#loadingText = h('span', {});
    this.#loading = h(
      'div',
      { class: 'pw-loading', hidden: true },
      h('span', { class: 'spinner' }),
      this.#loadingText,
    );
    const tool = (icon: string, label: () => string, key: string, fn: () => void, cls = '') => {
      const el = h('button', { type: 'button', class: `px-icon ${cls}`.trim() }, icon);
      el.addEventListener('click', () => {
        sfx('press');
        fn();
      });
      this.#btns.push({ label: () => `${label()} (${key})`, el });
      return el;
    };
    const muteBtn = tool(
      isMuted() ? '♪̸' : '♪',
      () => t('win.sound'),
      'M',
      () => {
        setMuted(!isMuted());
        muteBtn.textContent = isMuted() ? '♪̸' : '♪';
        muteBtn.classList.toggle('is-off', isMuted());
      },
    );
    muteBtn.classList.toggle('is-off', isMuted());
    this.#muteBtn = muteBtn;
    const newBtn = tool(
      '↻',
      () => t('win.new'),
      'N',
      () => this.#newRun(),
    );
    const helpBtn = tool(
      '?',
      () => t('win.help'),
      'H',
      () => this.#toggleHelp(),
    );
    const fsBtn = tool(
      '⛶',
      () => t('win.fullscreen'),
      'F',
      () => this.#toggleFullscreen(),
    );
    const closeBtn = tool(
      '✕',
      () => t('win.close'),
      'Esc',
      () => this.close(),
      'px-close',
    );
    this.#frame = h(
      'div',
      { class: 'pw-backdrop', hidden: true },
      h(
        'section',
        { class: 'pw', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pw-title' },
        h(
          'header',
          { class: 'pw-bar' },
          this.#title,
          this.#tabs,
          h('div', { class: 'pw-tools' }, newBtn, helpBtn, muteBtn, fsBtn, closeBtn),
        ),
        this.#body,
        this.#loading,
      ),
    );
    this.#frame.addEventListener('pointerdown', (e) => {
      if (e.target === this.#frame) this.close();
    });
    mount.append(this.#frame);
    document.addEventListener('keydown', (e) => this.#onKey(e));
    this.#applyLang();
    onLang(() => this.#applyLang());
  }

  #applyLang(): void {
    for (const b of this.#btns) {
      b.el.title = b.label();
      b.el.setAttribute('aria-label', b.label());
    }
    this.#tabs.setAttribute('aria-label', t('win.tabs'));
    this.#loadingText.textContent = t('win.loading');
    if (this.#focused) this.#focus(this.#focused);
  }

  #toggleHelp(): void {
    const view = this.#focused ? this.#views.get(this.#focused) : null;
    view?.toggleHelp();
  }

  focused(): string | null {
    return this.#focused;
  }

  isOpen(): boolean {
    return this.#focused !== null;
  }

  async open(id: string, source: 'agent' | 'human' = 'human'): Promise<GameHost> {
    const entry = findGame(id);
    if (!entry) throw new Error(`Unknown game: ${id}`);
    const existing = this.#views.get(id);
    if (existing) {
      if (this.#focused !== id) this.#focus(id);
      return existing.host;
    }
    let p = this.#pending.get(id);
    if (!p) {
      if (!this.#focused) this.#lastFocus = document.activeElement;
      this.#show();
      this.#loading.hidden = false;
      p = getHost(id).then((host) => {
        const view = new GameView(entry, host);
        view.onRequestNew = () => this.#newRun();
        this.#views.set(id, view);
        this.#body.append(view.root);
        this.#focus(id);
        if (source === 'human') sfx('open');
        return host;
      });
      p.finally(() => {
        this.#pending.delete(id);
        this.#loading.hidden = true;
      });
      this.#pending.set(id, p);
    }
    return p;
  }

  close(id?: string): void {
    const target = id ?? this.#focused;
    if (!target) return;
    const view = this.#views.get(target);
    if (!view) return;
    view.destroy();
    this.#views.delete(target);
    if (this.#focused === target) {
      const next = [...this.#views.keys()].at(-1) ?? null;
      if (next) this.#focus(next);
      else this.#hide();
    } else this.#renderTabs();
  }

  closeAll(): void {
    for (const id of [...this.#views.keys()]) this.close(id);
  }

  #focus(id: string): void {
    for (const [vid, view] of this.#views) {
      const active = vid === id;
      view.root.hidden = !active;
      if (active) view.activate();
      else view.deactivate();
    }
    this.#focused = id;
    const entry = findGame(id)!;
    this.#title.textContent = gameName(entry, lang());
    this.#frame.style.setProperty('--accent', entry.accent);
    this.#renderTabs();
    const hash = `#/play/${id}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
    document.title = `${gameName(entry, lang())} · GameClaw`;
  }

  #renderTabs(): void {
    clear(this.#tabs);
    for (const [id] of this.#views) {
      const entry = findGame(id)!;
      const tab = h(
        'button',
        {
          type: 'button',
          class: `pw-tab${id === this.#focused ? ' is-active' : ''}`,
          style: `--accent:${entry.accent}`,
        },
        gameName(entry, lang()),
      );
      tab.addEventListener('click', () => this.#focus(id));
      const x = h(
        'span',
        {
          class: 'pw-tab-x',
          role: 'button',
          'aria-label': t('win.closeGame', { name: gameName(entry, lang()) }),
        },
        '×',
      );
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close(id);
      });
      tab.append(x);
      this.#tabs.append(tab);
    }
  }

  #show(): void {
    if (!this.#frame.hidden) return;
    this.#frame.hidden = false;
    document.body.classList.add('has-window');
    this.onVisibilityChange?.(true);
  }

  #hide(): void {
    this.#frame.hidden = true;
    this.#focused = null;
    document.body.classList.remove('has-window');
    history.replaceState(null, '', '#/');
    document.title = t('site.title');
    this.onVisibilityChange?.(false);
    if (this.#lastFocus instanceof HTMLElement) this.#lastFocus.focus();
  }

  #newRun(): void {
    const view = this.#focused ? this.#views.get(this.#focused) : null;
    if (!view) return;
    view.host.newGame({ source: 'human' });
  }

  #toggleFullscreen(): void {
    const el = this.#frame.querySelector('.pw');
    if (!document.fullscreenElement) void el?.requestFullscreen?.().catch(() => undefined);
    else void document.exitFullscreen();
  }

  #onKey(e: KeyboardEvent): void {
    if (!this.#focused || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))
      return;
    if (
      target?.tagName === 'BUTTON' &&
      (e.key === 'Enter' || e.key === ' ') &&
      !target.classList.contains('gv-action')
    )
      return;
    const view = this.#views.get(this.#focused);
    if (!view) return;
    if (e.key === 'Escape') {
      if (document.fullscreenElement) return;
      if (view.closeHelp()) {
        e.preventDefault();
        return;
      }
      this.close();
      e.preventDefault();
      return;
    }
    if (e.key === 'n' || e.key === 'N') {
      this.#newRun();
      e.preventDefault();
      return;
    }
    if (e.key === 'f' || e.key === 'F') {
      this.#toggleFullscreen();
      e.preventDefault();
      return;
    }
    if (e.key === 'h' || e.key === 'H' || e.key === '?') {
      this.#toggleHelp();
      e.preventDefault();
      return;
    }
    if (e.key === 'm' || e.key === 'M') {
      setMuted(!isMuted());
      this.#muteBtn.textContent = isMuted() ? '♪̸' : '♪';
      this.#muteBtn.classList.toggle('is-off', isMuted());
      e.preventDefault();
      return;
    }
    if (
      e.key === 'Tab' &&
      e.shiftKey === false &&
      this.#views.size > 1 &&
      e.target === document.body
    ) {
      const ids = [...this.#views.keys()];
      this.#focus(ids[(ids.indexOf(this.#focused) + 1) % ids.length]!);
      e.preventDefault();
      return;
    }
    if (view.handleKey(e)) e.preventDefault();
  }
}

export function gameIds(): string[] {
  return GAMES.map((g) => g.id);
}
