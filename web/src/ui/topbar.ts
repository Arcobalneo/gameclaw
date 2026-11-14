import { type Lang, lang, onLang, setLang, t } from '../i18n';
import { h } from './dom';
import { sfx } from './sfx';

/** Fixed site bar: wordmark on the left, optional session chip, 中 / EN on the right. */
export function topbar(onHome: () => void, trailing?: HTMLElement): HTMLElement {
  const home = h(
    'a',
    { class: 'tb-brand', href: '#/' },
    h('span', { class: 'tb-mark', 'aria-hidden': 'true' }),
    'GameClaw',
  );
  home.addEventListener('click', (e) => {
    e.preventDefault();
    onHome();
  });
  const buttons: Record<Lang, HTMLButtonElement> = {
    zh: h('button', { type: 'button', class: 'lang-btn', lang: 'zh-CN', 'data-lang': 'zh' }, '中'),
    en: h('button', { type: 'button', class: 'lang-btn', lang: 'en', 'data-lang': 'en' }, 'EN'),
  };
  const group = h('div', { class: 'lang-switch', role: 'group' }, buttons.zh, buttons.en);
  const sync = () => {
    for (const l of ['zh', 'en'] as const) {
      buttons[l].setAttribute('aria-pressed', String(lang() === l));
    }
    group.setAttribute('aria-label', t('lang.label'));
  };
  for (const l of ['zh', 'en'] as const)
    buttons[l].addEventListener('click', () => {
      sfx('press');
      setLang(l);
    });
  onLang(sync);
  sync();
  const right = h('div', { class: 'tb-right' }, ...(trailing ? [trailing] : []), group);
  return h('header', { class: 'topbar' }, home, right);
}
