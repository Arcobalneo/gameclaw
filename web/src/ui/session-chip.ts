import { lang, onLang, t } from '../i18n';
import type { RelayStatus } from '../runtime/relay';
import { isRoomCode, type LocalSession, normalizeRoomCode } from '../runtime/session';
import { copyText, h } from './dom';
import { sfx } from './sfx';

/**
 * Discreet room-code chip for the top bar: status dot, code, copy on click,
 * and a one-field join form behind a small button.
 */
export class SessionChip {
  readonly root: HTMLElement;
  readonly #codeBtn: HTMLButtonElement;
  readonly #codeText: HTMLElement;
  readonly #joinBtn: HTMLButtonElement;
  readonly #form: HTMLFormElement;
  readonly #input: HTMLInputElement;
  readonly #hint: HTMLElement;
  #session: LocalSession;
  #status: RelayStatus = 'connecting';
  #copiedTimer: ReturnType<typeof setTimeout> | null = null;
  onJoin: ((code: string) => Promise<boolean> | boolean) | null = null;

  constructor(session: LocalSession) {
    this.#session = session;
    this.#codeText = h('span', { class: 'session-code-text' }, session.code ?? '·······');
    this.#codeBtn = h(
      'button',
      { type: 'button', class: 'session-code' },
      h('span', { class: 'session-dot', 'aria-hidden': 'true' }),
      this.#codeText,
    );
    this.#codeBtn.addEventListener('click', () => void this.#copy());
    this.#joinBtn = h('button', { type: 'button', class: 'session-join-btn' }, '+');
    this.#joinBtn.addEventListener('click', () => this.#toggleForm());
    this.#input = h('input', {
      class: 'session-input',
      type: 'text',
      maxlength: '12',
      autocomplete: 'off',
      spellcheck: 'false',
      autocapitalize: 'characters',
    }) as HTMLInputElement;
    this.#hint = h('p', { class: 'session-hint' });
    const go = h('button', { type: 'submit', class: 'session-go' }, '→');
    this.#form = h(
      'form',
      { class: 'session-form', hidden: true },
      this.#input,
      go,
      this.#hint,
    ) as HTMLFormElement;
    this.#form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.#submit();
    });
    this.root = h(
      'div',
      { class: 'session-chip is-connecting' },
      this.#codeBtn,
      this.#joinBtn,
      this.#form,
    );
    this.#applyLang();
    onLang(() => this.#applyLang());
    document.addEventListener('pointerdown', (e) => {
      if (!this.#form.hidden && !this.root.contains(e.target as Node)) this.#form.hidden = true;
    });
  }

  setSession(session: LocalSession): void {
    this.#session = session;
    this.#codeText.textContent = session.code ?? '·······';
    this.#applyLang();
  }

  setStatus(status: RelayStatus): void {
    this.#status = status;
    this.root.classList.remove('is-connecting', 'is-open', 'is-reconnecting', 'is-offline');
    this.root.classList.add(`is-${status}`);
    this.#applyLang();
  }

  #applyLang(): void {
    const code = this.#session.code ?? '·······';
    this.#codeBtn.title = t('session.copy', { code });
    this.#codeBtn.setAttribute('aria-label', t('session.copy', { code }));
    this.#joinBtn.title = t('session.join');
    this.#joinBtn.setAttribute('aria-label', t('session.join'));
    this.#input.placeholder = t('session.join');
    this.#hint.textContent = t('session.joinHint');
    this.root.setAttribute('data-status', this.#status);
  }

  async #copy(): Promise<void> {
    const code = this.#session.code;
    if (!code) return;
    const ok = await copyText(code);
    sfx(ok ? 'coin' : 'bad');
    const label = t(ok ? 'session.copied' : 'session.copyFail', { code });
    this.#codeBtn.title = label;
    this.#codeText.textContent = ok ? (lang() === 'zh' ? '已复制' : 'Copied') : code;
    if (this.#copiedTimer) clearTimeout(this.#copiedTimer);
    this.#copiedTimer = setTimeout(() => {
      this.#codeText.textContent = this.#session.code ?? '·······';
      this.#applyLang();
    }, 1400);
  }

  #toggleForm(): void {
    this.#form.hidden = !this.#form.hidden;
    this.#hint.textContent = t('session.joinHint');
    this.#hint.classList.remove('is-error');
    if (!this.#form.hidden) {
      this.#input.value = '';
      this.#input.focus();
    }
  }

  async #submit(): Promise<void> {
    const code = normalizeRoomCode(this.#input.value);
    if (!isRoomCode(code)) {
      this.#hint.textContent = t('session.joinBad');
      this.#hint.classList.add('is-error');
      sfx('bad');
      return;
    }
    const ok = (await this.onJoin?.(code)) ?? false;
    if (!ok) {
      this.#hint.textContent = t('session.joinBad');
      this.#hint.classList.add('is-error');
      sfx('bad');
      return;
    }
    sfx('coin');
    this.#form.hidden = true;
  }
}

export function relayBanner(): { root: HTMLElement; setStatus: (s: RelayStatus) => void } {
  const root = h('div', { class: 'relay-banner', hidden: true, role: 'status' });
  const sync = () => {
    if (!root.hidden) root.textContent = t('session.reconnecting');
  };
  onLang(sync);
  return {
    root,
    setStatus(status) {
      root.hidden = status !== 'reconnecting';
      sync();
    },
  };
}
