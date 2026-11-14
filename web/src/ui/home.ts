import { GAMES, type GameEntry, gameName, gameTag } from '../catalog';
import { ridge, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, hash01, makeCanvas, VW } from '../gfx/pixel';
import { buildSprite, CRAB, SHRIMP, SHRIMP_WALK, SLIME } from '../gfx/sprites';
import { lang, onLang, t } from '../i18n';
import { h } from './dom';
import { logo } from './logo';
import { gameCountEl } from './play-counts';
import { sfx } from './sfx';

const HERO_H = 112;

interface Cover {
  id: string;
  name: HTMLElement;
  tag: HTMLElement;
  btn: HTMLButtonElement;
  game: GameEntry;
}

/** Home: animated pixel hero + the game grid. Covers are clean frames captured from each scene. */
export class Home {
  readonly root: HTMLElement;
  readonly #covers: Cover[] = [];
  readonly #hero = makeCanvas(VW, HERO_H);
  readonly #tagline: HTMLElement;
  #raf = 0;
  #t = 0;
  #last = 0;
  #paused = false;

  constructor(onOpen: (id: string) => void) {
    const heroCanvas = this.#hero;
    heroCanvas.className = 'hero-canvas';
    heroCanvas.setAttribute('aria-hidden', 'true');
    const grid = h('ul', { class: 'grid', role: 'list' });
    GAMES.forEach((game, i) => {
      const card = this.#card(game, i, onOpen);
      grid.append(card);
    });
    this.#tagline = h('p', { class: 'hero-tag' });
    this.root = h(
      'main',
      { class: 'home', id: 'main' },
      h(
        'header',
        { class: 'hero' },
        heroCanvas,
        h('h1', { class: 'sr-only' }, 'GameClaw'),
        this.#tagline,
      ),
      grid,
      h(
        'footer',
        { class: 'site-foot' },
        h(
          'a',
          { href: 'https://github.com/Arcobalneo/gameclaw', target: '_blank', rel: 'noopener' },
          t('site.github'),
        ),
      ),
    );
    this.#applyLang();
    onLang(() => this.#applyLang());
  }

  #applyLang(): void {
    const l = lang();
    this.#tagline.textContent = t('site.tagline');
    for (const c of this.#covers) {
      c.name.textContent = gameName(c.game, l);
      c.tag.textContent = gameTag(c.game, l);
      c.btn.setAttribute('aria-label', t('home.open', { name: gameName(c.game, l) }));
    }
  }

  #card(game: GameEntry, index: number, onOpen: (id: string) => void): HTMLElement {
    const cover = h('img', {
      class: 'card-cover',
      src: `${import.meta.env.BASE_URL}covers/${game.id}.webp`,
      alt: '',
      width: '384',
      height: '216',
      loading: index < 6 ? 'eager' : 'lazy',
      decoding: 'async',
    });
    const name = h('span', { class: 'card-name' });
    const tag = h('span', { class: 'card-tag' });
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'card',
        'data-id': game.id,
        style: `--accent:${game.accent};--ink:${game.ink};--i:${index}`,
      },
      h(
        'span',
        { class: 'card-frame' },
        cover,
        h('span', { class: 'card-play', 'aria-hidden': 'true' }, '▶'),
      ),
      h('span', { class: 'card-text' }, name, tag, gameCountEl(game.id)),
    );
    const entry: Cover = { id: game.id, name, tag, btn, game };
    this.#covers.push(entry);
    btn.addEventListener('click', () => {
      sfx('press');
      onOpen(game.id);
    });
    return h('li', {}, btn);
  }

  start(): void {
    this.#paused = false;
    cancelAnimationFrame(this.#raf);
    this.#last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      if (this.#paused) return;
      this.#raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const dt = Math.min(0.05, (now - this.#last) / 1000);
      this.#last = now;
      this.#t += dt;
      acc += dt;
      if (acc < 1 / 30) return; // home art runs at 30fps to stay light
      acc = 0;
      this.#paintHero();
    };
    this.#paintHero();
    this.#raf = requestAnimationFrame(loop);
  }

  pause(): void {
    this.#paused = true;
    cancelAnimationFrame(this.#raf);
  }

  #paintHero(): void {
    const g = ctx2d(this.#hero, false);
    const t = this.#t;
    sky(g, ['#1b0b3a', '#0d1a4a', '#06283f', '#03121f'], 0, HERO_H, 12);
    stars(g, t, 11, 50, 46);
    glow(g, 300, 20, 60, '#ff7ad9', 0.12);
    glow(g, 70, 10, 70, '#4fd1ff', 0.12);
    ridge(g, { seed: 2, base: 84, amp: 30, color: '#0c1d40', kind: 'hills' }, t * 3);
    ridge(
      g,
      { seed: 5, base: 98, amp: 22, color: '#081733', kind: 'reef', edge: '#1d3f78' },
      t * 10,
    );
    g.fillStyle = '#050b1c';
    g.fillRect(0, 98, VW, HERO_H - 98);
    g.fillStyle = '#18305e';
    g.fillRect(0, 98, VW, 1);
    const parade = [SHRIMP, SLIME, CRAB, SHRIMP];
    for (let i = 0; i < 6; i += 1) {
      const x = ((i * 70 + t * 22) % (VW + 40)) - 30;
      const def = parade[i % parade.length]!;
      const frame = def === SHRIMP && Math.floor(t * 8 + i) % 2 ? SHRIMP_WALK : def;
      const hop = def === SLIME ? Math.abs(Math.sin(t * 5 + i)) : 0;
      const bob = def === SLIME ? -hop * 8 : Math.round(Math.sin(t * 8 + i));
      const s = buildSprite(frame, i % 3 === 1 ? { b: '#ffb347' } : {});
      // Squash on landing, stretch in the air.
      const sq = def === SLIME ? 1 + (hop < 0.15 ? 0.25 : -0.12 * hop) : 1;
      const w = Math.round(s.width * sq);
      const hh = Math.round(s.height / sq);
      g.drawImage(s, Math.round(x + (s.width - w) / 2), Math.round(97 - hh + bob), w, hh);
    }
    for (let i = 0; i < 20; i += 1) {
      const x = (hash01(i, 77) * VW + Math.sin(t + i) * 4) | 0;
      const y = (HERO_H - ((t * (8 + (i % 5) * 3) + i * 31) % HERO_H)) | 0;
      g.fillStyle = i % 4 ? '#5fb8ff' : '#c8f0ff';
      g.fillRect(x, y, 1, 1);
    }
    const mark = logo(t);
    glow(g, VW / 2, 42, 90, '#ff7a59', 0.1 + 0.04 * Math.sin(t * 2));
    g.drawImage(mark, Math.round(VW / 2 - mark.width / 2), 14);
  }
}
