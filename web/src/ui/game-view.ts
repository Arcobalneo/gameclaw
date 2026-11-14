import type { ActionView } from '@gameclaw/gamekit';
import type { GameEntry } from '../catalog';
import { metricNumber } from '../gfx/pixel';
import { type GameHost, type HostEvent, outcomeLabel } from '../runtime/host';
import { buildPrompt, TOOL_NAMES } from '../runtime/prompt';
import { clear, copyText, h } from './dom';
import { sfx } from './sfx';
import { Stage } from './stage';

const RISK_LABEL: Record<string, string> = { low: '稳', medium: '险', high: '危' };

/**
 * The inside of a game window: stage canvas, live log, side panel with the
 * action list, and the copyable agent prompt. Keyboard is routed here by the
 * portal while this view is focused.
 */
export class GameView {
  readonly root: HTMLElement;
  readonly entry: GameEntry;
  readonly host: GameHost;
  readonly stage: Stage;
  #selected = 0;
  #actions: ActionView[] = [];
  readonly #els: {
    headline: HTMLElement;
    metrics: HTMLElement;
    actions: HTMLElement;
    sections: HTMLElement;
    log: HTMLElement;
    recap: HTMLElement;
    seed: HTMLElement;
  };
  readonly #unsub: () => void;
  onRequestNew: (() => void) | null = null;

  constructor(entry: GameEntry, host: GameHost, webmcpMode: string) {
    this.entry = entry;
    this.host = host;
    const stageBox = h('div', { class: 'gv-stage' });
    const headline = h('p', { class: 'gv-headline' });
    const metrics = h('dl', { class: 'gv-metrics' });
    const actions = h('div', {
      class: 'gv-actions',
      role: 'listbox',
      'aria-label': '可选动作',
      tabindex: '-1',
    });
    const sections = h('div', { class: 'gv-sections' });
    const log = h('ol', { class: 'gv-log', 'aria-live': 'polite', 'aria-label': '战报' });
    const recap = h('div', { class: 'gv-recap', hidden: true });
    const seed = h('span', { class: 'gv-seed' });
    this.#els = { headline, metrics, actions, sections, log, recap, seed };

    const prompt = buildPrompt(entry, host.module.definition.meta.guide);
    const promptPre = h('pre', { class: 'gv-prompt-text', tabindex: '0' }, prompt);
    const copyBtn = h(
      'button',
      { class: 'px-btn px-btn-accent', type: 'button' },
      '复制 Prompt · Copy',
    );
    copyBtn.addEventListener('click', async () => {
      const ok = await copyText(prompt);
      copyBtn.textContent = ok ? '已复制 ✓ Copied' : '复制失败，请手动选择';
      sfx('confirm');
      setTimeout(() => {
        copyBtn.textContent = '复制 Prompt · Copy';
      }, 1800);
    });

    this.root = h(
      'div',
      { class: 'gv', style: `--accent:${entry.accent};--ink:${entry.ink}` },
      h(
        'div',
        { class: 'gv-grid' },
        h(
          'div',
          { class: 'gv-main' },
          stageBox,
          h(
            'div',
            { class: 'gv-under' },
            h('div', { class: 'gv-panel gv-log-panel' }, h('h3', {}, '战报 · Log'), log),
          ),
        ),
        h(
          'aside',
          { class: 'gv-side' },
          h('div', { class: 'gv-panel' }, headline, metrics, h('div', { class: 'gv-meta' }, seed)),
          h(
            'div',
            { class: 'gv-panel gv-actions-panel' },
            h('h3', {}, '行动 · Actions ', h('small', {}, '1-9 / ↑↓ / WASD · Enter')),
            actions,
            recap,
          ),
          h(
            'details',
            { class: 'gv-panel gv-details' },
            h('summary', {}, '局面详情 · Details'),
            sections,
          ),
        ),
      ),
      h(
        'section',
        { class: 'gv-panel gv-prompt', 'aria-label': 'Agent Prompt' },
        h(
          'header',
          {},
          h('h3', {}, '让你的 Agent 来玩 · Agent Prompt'),
          h('span', { class: 'gv-webmcp' }, `WebMCP: ${webmcpMode}`),
          copyBtn,
        ),
        promptPre,
        h('div', { class: 'gv-tools' }, ...TOOL_NAMES.map((n) => h('code', {}, n))),
      ),
    );

    this.stage = new Stage(stageBox, host);
    this.stage.onHitAction = (id) => this.perform(id);
    this.#unsub = host.subscribe((e) => this.#onHost(e));
    this.render();
  }

  destroy(): void {
    this.#unsub();
    this.stage.destroy();
    this.root.remove();
  }

  activate(): void {
    this.stage.resize();
    this.stage.start();
  }

  deactivate(): void {
    this.stage.stop();
  }

  perform(actionId: string): void {
    const res = this.host.tryAct(actionId, 'human');
    if (!res.ok) {
      sfx('bad');
      this.#flashError(`${res.error}${res.hint ? ` · ${res.hint}` : ''}`);
    }
  }

  /** Keyboard routing. Returns true when the key was consumed. */
  handleKey(e: KeyboardEvent): boolean {
    const key = e.key;
    const n = this.#actions.length;
    if (/^[1-9]$/.test(key)) {
      const i = Number(key) - 1;
      if (i < n) {
        this.#select(i);
        this.perform(this.#actions[i]!.id);
      }
      return true;
    }
    const dir = directional(key);
    if (dir) {
      const directAction = this.#actions.find((a) => matchesDirection(a.id, dir));
      if (directAction && /^[wasd]$/i.test(key)) {
        this.perform(directAction.id);
        return true;
      }
      if (n) {
        if (dir === 'up' || dir === 'left') this.#select((this.#selected - 1 + n) % n);
        else this.#select((this.#selected + 1) % n);
        sfx('move');
      }
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      const a = this.#actions[this.#selected];
      if (a) this.perform(a.id);
      else if (this.host.status().outcome !== 'ongoing') this.onRequestNew?.();
      return true;
    }
    return false;
  }

  #select(i: number): void {
    this.#selected = i;
    this.stage.focus = this.#actions[i] ?? null;
    const buttons = this.#els.actions.querySelectorAll<HTMLButtonElement>('button');
    buttons.forEach((b, j) => {
      b.classList.toggle('is-selected', j === i);
      b.setAttribute('aria-selected', j === i ? 'true' : 'false');
    });
    buttons[i]?.scrollIntoView({ block: 'nearest' });
  }

  #onHost(e: HostEvent): void {
    if (e.kind === 'act') {
      const o = e.outcome;
      if (o.status.outcome === 'won') sfx('win');
      else if (o.status.outcome === 'lost') sfx('lose');
      else {
        const prev = this.#lastMetrics;
        const delta = o.status.metrics.reduce((sum, m) => {
          const old = prev.find((p) => p.label === m.label);
          return sum + (old ? Math.sign(metricNumber(m.value) - metricNumber(old.value)) : 0);
        }, 0);
        sfx(delta > 0 ? 'good' : delta < 0 ? 'bad' : 'confirm');
      }
    } else sfx('open');
    this.#selected = 0;
    this.render();
  }

  #lastMetrics: { label: string; value: string | number }[] = [];

  render(): void {
    const status = this.host.status();
    this.#lastMetrics = status.metrics;
    this.#actions = this.host.actions();
    const els = this.#els;
    els.headline.textContent = status.headline;
    els.seed.textContent = `seed ${this.host.seed} · turn ${status.turn} · ${outcomeLabel(status.outcome)}`;
    clear(els.metrics);
    for (const m of status.metrics) {
      els.metrics.append(
        h(
          'div',
          { class: 'gv-metric', title: m.hint ?? '' },
          h('dt', {}, m.label),
          h('dd', {}, String(m.value)),
        ),
      );
    }
    clear(els.actions);
    this.#actions.forEach((a, i) => {
      const btn = h(
        'button',
        {
          type: 'button',
          class: `gv-action${a.risk ? ` risk-${a.risk}` : ''}${a.id === 'abort' ? ' is-abort' : ''}`,
          role: 'option',
          'aria-selected': i === this.#selected ? 'true' : 'false',
          title: a.id,
        },
        h('kbd', {}, i < 9 ? String(i + 1) : '·'),
        h(
          'span',
          { class: 'gv-action-body' },
          h('span', { class: 'gv-action-label' }, a.label),
          a.detail ? h('span', { class: 'gv-action-detail' }, a.detail) : null,
        ),
        h(
          'span',
          { class: 'gv-action-tags' },
          a.cost ? h('em', {}, a.cost) : null,
          a.risk ? h('i', { class: `risk risk-${a.risk}` }, RISK_LABEL[a.risk] ?? a.risk) : null,
        ),
      );
      btn.addEventListener('click', () => {
        this.#select(i);
        this.perform(a.id);
      });
      btn.addEventListener('mouseenter', () => {
        this.stage.focus = a;
      });
      btn.addEventListener('mouseleave', () => {
        this.stage.focus = this.#actions[this.#selected] ?? null;
      });
      els.actions.append(btn);
    });
    this.#select(Math.min(this.#selected, Math.max(0, this.#actions.length - 1)));
    clear(els.sections);
    for (const s of status.sections) {
      els.sections.append(h('h4', {}, s.title), h('ul', {}, ...s.lines.map((l) => h('li', {}, l))));
    }
    // Log (newest first).
    clear(els.log);
    for (const entry of [...this.host.log].reverse().slice(0, 30)) {
      const who = entry.source === 'agent' ? 'AGENT' : entry.source === 'human' ? 'YOU' : 'SYS';
      els.log.append(
        h(
          'li',
          { class: `log-${entry.source}` },
          h(
            'span',
            { class: 'log-who' },
            `T${entry.turn} ${who}${entry.action ? ` · ${entry.action}` : ''}`,
          ),
          ...entry.lines.map((l) => h('span', { class: 'log-line' }, l)),
        ),
      );
    }
    // Recap when ended.
    if (status.outcome !== 'ongoing') {
      const recap = this.host.recap();
      clear(els.recap);
      const again = h(
        'button',
        { type: 'button', class: 'px-btn px-btn-accent' },
        '再来一局 · New Run (N)',
      );
      again.addEventListener('click', () => this.onRequestNew?.());
      els.recap.append(
        h('h4', {}, `${recap.title} · ${outcomeLabel(recap.outcome)}`),
        h('p', {}, recap.cause),
        ...(recap.lessons.length
          ? [h('ul', {}, ...recap.lessons.slice(0, 4).map((l) => h('li', {}, l)))]
          : []),
        again,
      );
      els.recap.hidden = false;
    } else els.recap.hidden = true;
  }

  #flashError(text: string): void {
    const toast = h('div', { class: 'gv-toast', role: 'alert' }, text);
    this.root.append(toast);
    setTimeout(() => toast.remove(), 2600);
  }
}

type Dir = 'up' | 'down' | 'left' | 'right';

function directional(key: string): Dir | null {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'up';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down';
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    default:
      return null;
  }
}

const DIR_SUFFIX: Record<Dir, RegExp> = {
  up: /(^|:)(n|north|up)$/,
  down: /(^|:)(s|south|down)$/,
  left: /(^|:)(w|west|left)$/,
  right: /(^|:)(e|east|right)$/,
};

function matchesDirection(id: string, dir: Dir): boolean {
  return /^(move|dash|go|step|dodge)/.test(id) && DIR_SUFFIX[dir].test(id);
}
