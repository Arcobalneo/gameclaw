import { onLang, t } from '../i18n';
import { currentCounts, onCounts } from '../runtime/stats';
import { h } from './dom';

function label(n: number): string {
  return t('stats.played', { n: String(n) });
}

function bind(el: HTMLElement, read: () => number): () => void {
  const paint = () => {
    el.textContent = label(read());
  };
  paint();
  const offCounts = onCounts(paint);
  const offLang = onLang(paint);
  return () => {
    offCounts();
    offLang();
  };
}

/** Fixed bottom-right site-wide counter. */
export function siteCountChip(): HTMLElement {
  const el = h('div', { class: 'play-count play-count-site', 'aria-live': 'polite' });
  bind(el, () => currentCounts().site);
  return el;
}

/** Per-game counter for a card or window chrome. */
export function gameCountEl(gameId: string, cls = 'play-count play-count-game'): HTMLElement {
  const el = h('span', { class: cls, 'aria-live': 'polite' });
  bind(el, () => currentCounts().games[gameId] ?? 0);
  return el;
}

export { label as playedLabel };
