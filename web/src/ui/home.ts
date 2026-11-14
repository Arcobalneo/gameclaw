import { GAMES, type GameEntry } from '../catalog';
import { ridge, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, hash01, makeCanvas, VW } from '../gfx/pixel';
import { buildSprite, CRAB, SHRIMP, SHRIMP_WALK, SLIME } from '../gfx/sprites';
import { drawText, isFontReady } from '../gfx/text';
import { CH, CW, paintCover } from './covers';
import { h } from './dom';

const HERO_H = 120;

/** Home: animated pixel hero banner + the game grid with live covers. */
export class Home {
  readonly root: HTMLElement;
  readonly #covers: { id: string; canvas: HTMLCanvasElement; visible: boolean; hover: boolean }[] =
    [];
  readonly #hero = makeCanvas(VW, HERO_H);
  #raf = 0;
  #t = 0;
  #last = 0;
  #paused = false;

  constructor(onOpen: (id: string) => void) {
    const heroCanvas = this.#hero;
    heroCanvas.className = 'hero-canvas';
    heroCanvas.setAttribute('aria-hidden', 'true');
    const grid = h('ul', { class: 'grid', role: 'list' });
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const c = this.#covers.find((cv) => cv.canvas === e.target);
        if (c) c.visible = e.isIntersecting;
      }
    });
    GAMES.forEach((game, i) => {
      const card = this.#card(game, i, onOpen);
      grid.append(card.el);
      io.observe(card.canvas);
    });
    this.root = h(
      'main',
      { class: 'home', id: 'main' },
      h(
        'header',
        { class: 'hero' },
        heroCanvas,
        h(
          'div',
          { class: 'hero-copy' },
          h('h1', {}, h('span', { class: 'sr-only' }, 'GameClaw '), '虾系游戏厅'),
          h(
            'p',
            {},
            '11 款虾系原创游戏 · 浏览器即开即玩 · 人类用键鼠，Agent 用 WebMCP，同一个窗口同屏对局。',
          ),
          h(
            'p',
            { class: 'hero-chips' },
            h('span', { class: 'chip' }, '免费 FREE'),
            h('span', { class: 'chip' }, '无需下载 NO DOWNLOAD'),
            h('span', { class: 'chip chip-accent' }, 'WebMCP READY'),
            h(
              'a',
              {
                class: 'chip',
                href: 'https://github.com/Arcobalneo/gameclaw',
                target: '_blank',
                rel: 'noopener',
              },
              'GitHub ↗',
            ),
          ),
        ),
      ),
      h('h2', { class: 'grid-title' }, '选择游戏 · Choose a game'),
      grid,
      h(
        'section',
        { class: 'agent-howto' },
        h('h2', {}, 'Agent 怎么接入 · For agents'),
        h(
          'p',
          {},
          '每个游戏都通过 WebMCP（document.modelContext.registerTool）在页面内暴露工具：',
          h(
            'code',
            {},
            'list_games · open_game · new_game · get_state · list_actions · act · recap',
          ),
          '。没有 WebMCP 的环境，可直接在页面执行 ',
          h('code', {}, 'await window.gameclaw.act({action_id})'),
          '。打开任意游戏，窗口底部有一键复制的 Prompt。',
        ),
      ),
      h(
        'footer',
        { class: 'site-foot' },
        h('span', {}, 'GameClaw v3 · MIT · 像素字体 Fusion Pixel (OFL-1.1)'),
        h('span', {}, '键位：点击 / 1-9 / ↑↓ WASD / Enter · N 新局 · Esc 关闭'),
      ),
    );
  }

  #card(game: GameEntry, index: number, onOpen: (id: string) => void) {
    const canvas = makeCanvas(CW, CH);
    canvas.className = 'card-cover';
    canvas.setAttribute('aria-hidden', 'true');
    const entry = { id: game.id, canvas, visible: true, hover: false };
    this.#covers.push(entry);
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'card',
        style: `--accent:${game.accent};--ink:${game.ink}`,
        'aria-label': `打开 ${game.name} ${game.englishName}`,
      },
      h(
        'span',
        { class: 'card-frame' },
        canvas,
        h('span', { class: 'card-no' }, String(index + 1).padStart(2, '0')),
      ),
      h(
        'span',
        { class: 'card-text' },
        h('span', { class: 'card-name' }, game.name, h('small', {}, game.englishName)),
        h('span', { class: 'card-tag' }, game.tagline),
        h('span', { class: 'card-genres' }, ...game.genres.slice(0, 3).map((g) => h('i', {}, g))),
      ),
      h('span', { class: 'card-play' }, '▶ PLAY'),
    );
    btn.addEventListener('click', () => onOpen(game.id));
    btn.addEventListener('mouseenter', () => {
      entry.hover = true;
    });
    btn.addEventListener('mouseleave', () => {
      entry.hover = false;
    });
    btn.addEventListener('focus', () => {
      entry.hover = true;
    });
    btn.addEventListener('blur', () => {
      entry.hover = false;
    });
    return { el: h('li', {}, btn), canvas };
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
      for (const c of this.#covers) {
        if (!c.visible) continue;
        const g = ctx2d(c.canvas, false);
        paintCover(g, c.id, c.hover ? this.#t * 1.6 : this.#t * 0.6);
      }
    };
    this.#paintHero();
    for (const c of this.#covers) paintCover(ctx2d(c.canvas, false), c.id, 0);
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
    stars(g, t, 11, 50, 50);
    glow(g, 300, 22, 60, '#ff7ad9', 0.14);
    glow(g, 70, 10, 70, '#4fd1ff', 0.14);
    ridge(
      g,
      { seed: 2, base: 92, amp: 34, color: '#0e2348', kind: 'city', scale: 14, windows: '#ffd36b' },
      t * 4,
    );
    ridge(
      g,
      { seed: 5, base: 104, amp: 22, color: '#081733', kind: 'reef', edge: '#1d3f78' },
      t * 10,
    );
    g.fillStyle = '#050b1c';
    g.fillRect(0, 106, VW, HERO_H - 106);
    g.fillStyle = '#18305e';
    g.fillRect(0, 106, VW, 1);
    // Parade of game mascots.
    const parade = [SHRIMP, SLIME, CRAB, SHRIMP];
    for (let i = 0; i < 6; i += 1) {
      const x = ((i * 70 + t * 22) % (VW + 40)) - 30;
      const def = parade[i % parade.length]!;
      const frame = def === SHRIMP && Math.floor(t * 8 + i) % 2 ? SHRIMP_WALK : def;
      const bob =
        def === SLIME ? -Math.abs(Math.sin(t * 5 + i)) * 8 : Math.round(Math.sin(t * 8 + i));
      const s = buildSprite(frame, i % 3 === 1 ? { b: '#ffb347' } : {}, { rim: '#ffffff' });
      g.drawImage(s, Math.round(x), Math.round(104 - s.height + bob));
    }
    for (let i = 0; i < 20; i += 1) {
      const x = (hash01(i, 77) * VW + Math.sin(t + i) * 4) | 0;
      const y = (HERO_H - ((t * (8 + (i % 5) * 3) + i * 31) % HERO_H)) | 0;
      g.fillStyle = i % 4 ? '#5fb8ff' : '#c8f0ff';
      g.fillRect(x, y, 1, 1);
    }
    if (isFontReady()) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2);
      glow(g, VW / 2, 44, 90, '#ff7a59', 0.12 + pulse * 0.08);
      drawText(g, 'GAMECLAW', VW / 2 + 2, 22 + 2, {
        color: '#2a0f3f',
        outline: null,
        align: 'center',
        scale: 4,
      });
      drawText(g, 'GAMECLAW', VW / 2, 22, {
        color: '#ffe8d0',
        outline: '#3a0f2a',
        align: 'center',
        scale: 4,
      });
      drawText(g, '虾 系 游 戏 厅 · PLAY WITH YOUR AGENT', VW / 2, 74, {
        color: '#9fe4ff',
        align: 'center',
      });
    }
  }
}
