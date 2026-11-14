import type { ActionView, Metric } from '@gameclaw/gamekit';
import { type GameEntry, gameName } from '../catalog';
import { metricNumber } from '../gfx/pixel';
import { lang, type MsgKey, onLang, t } from '../i18n';
import { term } from '../i18n/terms';
import type { GameHost, HostEvent } from '../runtime/host';
import { buildPrompt } from '../runtime/prompt';
import { clear, copyText, h } from './dom';
import { sfx } from './sfx';
import { Stage } from './stage';

const CJK = /[\u3400-\u9fff]/;

/**
 * Inside of a game window: stage canvas, compact HUD, action list with a
 * preview of the selected action, collapsible log and agent prompt. Keyboard
 * is routed here by the portal while this view is focused.
 */
export class GameView {
  readonly root: HTMLElement;
  readonly entry: GameEntry;
  readonly host: GameHost;
  readonly stage: Stage;
  #selected = 0;
  #actions: ActionView[] = [];
  #prevMetrics: Metric[] = [];
  readonly #els: {
    status: HTMLElement;
    turn: HTMLElement;
    metrics: HTMLElement;
    actions: HTMLElement;
    abort: HTMLElement;
    preview: HTMLElement;
    recap: HTMLElement;
    log: HTMLElement;
    help: HTMLElement;
    prompt: HTMLElement;
    statics: [HTMLElement, MsgKey][];
    copy: HTMLButtonElement;
  };
  readonly #unsubs: (() => void)[] = [];
  onRequestNew: (() => void) | null = null;

  constructor(entry: GameEntry, host: GameHost) {
    this.entry = entry;
    this.host = host;
    const stageBox = h('div', { class: 'gv-stage' });
    const statics: [HTMLElement, MsgKey][] = [];
    const label = (tag: 'h3' | 'span' | 'summary', key: MsgKey, cls = '') => {
      const el = h(tag, cls ? { class: cls } : {});
      statics.push([el, key]);
      return el;
    };
    const status = h('p', { class: 'gv-status' });
    const turn = h('span', { class: 'gv-turn' });
    const metrics = h('dl', { class: 'gv-hud' });
    const actions = h('div', { class: 'gv-actions', role: 'listbox', tabindex: '-1' });
    const abort = h('div', { class: 'gv-abort' });
    const preview = h('div', { class: 'gv-preview', 'aria-live': 'polite' });
    const recap = h('div', { class: 'gv-recap', hidden: true });
    const log = h('ol', { class: 'gv-log', 'aria-live': 'polite' });
    const help = h('div', { class: 'gv-help', hidden: true, role: 'dialog' });
    const prompt = h('pre', { class: 'gv-prompt-text', tabindex: '0' });
    const copy = h('button', { class: 'px-btn px-btn-accent gv-copy', type: 'button' });
    copy.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ok = await copyText(this.#promptText());
      sfx(ok ? 'coin' : 'bad');
      copy.textContent = t(ok ? 'gv.copied' : 'gv.copyFail');
      copy.classList.add('is-done');
      setTimeout(() => {
        copy.textContent = t('gv.copy');
        copy.classList.remove('is-done');
      }, 1600);
    });
    this.#els = {
      status,
      turn,
      metrics,
      actions,
      abort,
      preview,
      recap,
      log,
      help,
      prompt,
      statics,
      copy,
    };

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
          h('div', { class: 'gv-statusbar' }, status, turn),
          h(
            'details',
            { class: 'gv-fold gv-promptbox' },
            h(
              'summary',
              {},
              h('span', { class: 'gv-fold-title' }, label('span', 'gv.prompt')),
              copy,
            ),
            label('span', 'gv.promptHint', 'gv-prompt-hint'),
            prompt,
          ),
        ),
        h(
          'aside',
          { class: 'gv-side' },
          metrics,
          h(
            'section',
            { class: 'gv-panel gv-actions-panel' },
            label('h3', 'gv.actions'),
            actions,
            preview,
            recap,
            abort,
          ),
          h('details', { class: 'gv-fold gv-logbox' }, label('summary', 'gv.log'), log),
        ),
      ),
      help,
    );

    this.stage = new Stage(stageBox, host);
    this.stage.onHitAction = (id) => this.perform(id);
    this.#unsubs.push(host.subscribe((e) => this.#onHost(e)));
    this.#unsubs.push(onLang(() => this.render()));
    this.#prevMetrics = host.status().metrics;
    this.render();
  }

  #promptText(): string {
    return buildPrompt(this.entry, this.host.module.definition.meta.guide, lang());
  }

  destroy(): void {
    for (const u of this.#unsubs) u();
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

  toggleHelp(): void {
    const help = this.#els.help;
    if (help.hidden) this.#renderHelp();
    help.hidden = !help.hidden;
  }

  /** Closes help if open; returns true when it consumed the action. */
  closeHelp(): boolean {
    if (this.#els.help.hidden) return false;
    this.#els.help.hidden = true;
    return true;
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
        this.#pressFx(i);
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
      if (a) {
        this.#pressFx(this.#selected);
        this.perform(a.id);
      } else if (this.host.status().outcome !== 'ongoing') this.onRequestNew?.();
      return true;
    }
    return false;
  }

  #pressFx(i: number): void {
    const btn = this.#els.actions.querySelectorAll<HTMLElement>('.gv-action')[i];
    if (!btn) return;
    btn.classList.remove('is-pressed');
    void btn.offsetWidth;
    btn.classList.add('is-pressed');
  }

  #select(i: number): void {
    this.#selected = i;
    const a = this.#actions[i] ?? null;
    this.stage.focus = a;
    const buttons = this.#els.actions.querySelectorAll<HTMLButtonElement>('.gv-action');
    buttons.forEach((b, j) => {
      b.classList.toggle('is-selected', j === i);
      b.setAttribute('aria-selected', j === i ? 'true' : 'false');
    });
    buttons[i]?.scrollIntoView({ block: 'nearest' });
    this.#renderPreview(a);
  }

  #renderPreview(a: ActionView | null): void {
    const p = this.#els.preview;
    clear(p);
    if (!a?.detail) {
      p.hidden = true;
      return;
    }
    p.hidden = false;
    const detail = h('p', {}, a.detail);
    if (CJK.test(a.detail)) detail.lang = 'zh-CN';
    p.append(detail);
  }

  #onHost(e: HostEvent): void {
    if (e.kind === 'act') {
      const o = e.outcome;
      if (o.status.outcome === 'won') sfx('win');
      else if (o.status.outcome === 'lost') sfx('lose');
      else {
        const delta = o.status.metrics.reduce((sum, m) => {
          const old = this.#prevMetrics.find((p) => p.label === m.label);
          return sum + (old ? Math.sign(metricNumber(m.value) - metricNumber(old.value)) : 0);
        }, 0);
        sfx(delta > 0 ? 'good' : delta < 0 ? 'bad' : 'confirm');
      }
    } else sfx('open');
    this.#selected = 0;
    this.render(e.kind === 'act');
  }

  render(withDeltas = false): void {
    const l = lang();
    const id = this.entry.id;
    const els = this.#els;
    const status = this.host.status();
    for (const [el, key] of els.statics) el.textContent = t(key);
    els.copy.textContent = t('gv.copy');
    els.prompt.textContent = this.#promptText();
    this.stage.setLabel(t('gv.canvas', { name: gameName(this.entry, l) }));
    this.#actions = this.host.actions().filter((a) => a.id !== 'abort');
    const abortAction = this.host.actions().find((a) => a.id === 'abort');

    els.status.textContent = term(id, dedupeHeadline(status.headline, status.metrics));
    if (CJK.test(els.status.textContent)) els.status.lang = 'zh-CN';
    else els.status.removeAttribute('lang');
    els.turn.textContent = t('gv.turn', { n: status.turn });

    // HUD chips with animated deltas.
    const prev = this.#prevMetrics;
    clear(els.metrics);
    for (const m of status.metrics) {
      const chip = h(
        'div',
        { class: 'gv-chip', title: m.hint ?? '' },
        h('dt', {}, term(id, m.label)),
        h('dd', {}, term(id, String(m.value))),
      );
      const old = prev.find((p) => p.label === m.label);
      if (withDeltas && old) {
        const d = Math.round((metricNumber(m.value) - metricNumber(old.value)) * 100) / 100;
        if (d && Number.isFinite(d)) {
          chip.classList.add(d > 0 ? 'is-up' : 'is-down');
          chip.append(
            h('span', { class: 'gv-delta', 'aria-hidden': 'true' }, `${d > 0 ? '+' : ''}${d}`),
          );
        }
      }
      els.metrics.append(chip);
    }
    this.#prevMetrics = status.metrics;

    // Actions.
    clear(els.actions);
    this.#actions.forEach((a, i) => {
      const labelText = term(id, a.label);
      const btn = h(
        'button',
        {
          type: 'button',
          class: `gv-action${a.risk ? ` risk-${a.risk}` : ''}`,
          role: 'option',
          'aria-selected': 'false',
          title: a.id,
        },
        h('kbd', {}, i < 9 ? String(i + 1) : '·'),
        h(
          'span',
          {
            class: 'gv-action-label',
            lang: CJK.test(labelText) ? 'zh-CN' : l === 'zh' ? 'zh-CN' : 'en',
          },
          labelText,
        ),
        h(
          'span',
          { class: 'gv-action-tags' },
          a.cost ? h('em', {}, term(id, a.cost)) : null,
          a.risk ? h('i', { class: `risk risk-${a.risk}` }, t(`risk.${a.risk}` as MsgKey)) : null,
        ),
      );
      btn.addEventListener('click', () => {
        this.#select(i);
        this.#pressFx(i);
        this.perform(a.id);
      });
      btn.addEventListener('mouseenter', () => {
        this.stage.focus = a;
        this.#renderPreview(a);
      });
      btn.addEventListener('mouseleave', () => {
        const sel = this.#actions[this.#selected] ?? null;
        this.stage.focus = sel;
        this.#renderPreview(sel);
      });
      els.actions.append(btn);
    });
    if (!this.#actions.length) els.actions.append(h('p', { class: 'gv-empty' }, t('gv.noActions')));
    clear(els.abort);
    if (abortAction) {
      const b = h('button', { type: 'button', class: 'gv-abort-btn' }, t('action.abort'));
      b.addEventListener('click', () => this.perform('abort'));
      els.abort.append(b);
    }
    this.#select(Math.min(this.#selected, Math.max(0, this.#actions.length - 1)));

    // Log (newest first).
    clear(els.log);
    for (const entry of [...this.host.log].reverse().slice(0, 30)) {
      const who = t(
        entry.source === 'agent'
          ? 'who.agent'
          : entry.source === 'human'
            ? 'who.human'
            : 'who.system',
      );
      const act = entry.action ? this.host.actions().find((a) => a.id === entry.action) : null;
      els.log.append(
        h(
          'li',
          { class: `log-${entry.source}` },
          h(
            'span',
            { class: 'log-who' },
            `T${entry.turn} · ${who}${entry.action ? ` · ${act ? term(id, act.label) : entry.action}` : ''}`,
          ),
          ...entry.lines.map((line) =>
            h('span', { class: 'log-line', lang: CJK.test(line) ? 'zh-CN' : 'en' }, line),
          ),
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
        `${t('gv.again')}  N`,
      );
      again.addEventListener('click', () => {
        sfx('press');
        this.onRequestNew?.();
      });
      const key = `outcome.${recap.outcome}` as MsgKey;
      els.recap.append(
        h('h4', { class: `recap-${recap.outcome}` }, t(key)),
        h('p', { lang: CJK.test(recap.cause) ? 'zh-CN' : 'en' }, recap.cause),
        again,
      );
      els.recap.hidden = false;
    } else els.recap.hidden = true;
    if (!els.help.hidden) this.#renderHelp();
  }

  #renderHelp(): void {
    const l = lang();
    const help = this.#els.help;
    const status = this.host.status();
    clear(help);
    const close = h(
      'button',
      { type: 'button', class: 'px-icon gv-help-x', 'aria-label': t('win.close') },
      '✕',
    );
    close.addEventListener('click', () => {
      help.hidden = true;
    });
    help.append(
      h(
        'div',
        { class: 'gv-help-card' },
        close,
        h('h3', {}, t('help.title')),
        h('h4', {}, t('help.goal')),
        h('p', {}, l === 'zh' ? this.entry.goal : this.entry.goalEn),
        h('h4', {}, t('help.keys')),
        h('p', {}, t('help.keysBody')),
        ...(status.sections.length ? [h('h4', {}, t('help.details'))] : []),
        ...status.sections.map((sec) =>
          h(
            'div',
            { class: 'gv-help-sec', lang: 'zh-CN' },
            h('h5', {}, term(this.entry.id, sec.title)),
            h('ul', {}, ...sec.lines.map((line) => h('li', {}, line))),
          ),
        ),
        h('h4', {}, t('help.agent')),
        h('p', {}, t('help.agentBody')),
      ),
    );
  }

  #flashError(text: string): void {
    const toast = h('div', { class: 'gv-toast', role: 'alert' }, text);
    this.root.append(toast);
    setTimeout(() => toast.remove(), 2600);
  }
}

/** Drops headline segments that only repeat HUD metrics ("身体 8 家人 3"). */
export function dedupeHeadline(headline: string, metrics: readonly Metric[]): string {
  const parts = headline.split(/\s*·\s*/);
  const kept = parts.filter((part) => {
    const hits = metrics.filter((m) => part.includes(`${m.label} ${m.value}`) || part.includes(`${m.label}${m.value}`) || part.includes(`${m.label} ${String(m.value).split('/')[0]}`));
    return hits.length === 0;
  });
  return (kept.length ? kept : parts).join(' · ');
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
