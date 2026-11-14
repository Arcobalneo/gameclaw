import { moon, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { bayer, type Ctx, disc, ellipse, hash01, mix, rect } from '../gfx/pixel';
import {
  BOWL,
  BROCCOLI,
  BUN_TOP,
  buildSprite,
  CAMERA_EYE,
  CARROT,
  CRAB,
  creatureSprite,
  FLAG,
  GHOST,
  GUARD,
  HERO,
  PUMPKIN,
  SCROLL,
  SHRIMP,
  SHRIMP_WALK,
  SLIME,
  slab,
  TOMATO,
} from '../gfx/sprites';

/** Cover art is painted live at 192×108 with the same kit as the game scenes. */
export const CW = 192;
export const CH = 108;

function skyBands(g: Ctx, top: string, bottom: string, h = CH): void {
  for (let y = 0; y < h; y += 1) {
    const t = y / h;
    for (let x = 0; x < CW; x += 4) {
      const k = Math.min(1, Math.floor(t * 8 + bayer(x >> 2, y)) / 8);
      g.fillStyle = mix(top, bottom, k);
      g.fillRect(x, y, 4, 1);
    }
  }
}

function hills(g: Ctx, base: number, amp: number, color: string, seed: number, scroll = 0): void {
  g.fillStyle = color;
  for (let x = 0; x < CW; x += 1) {
    const xx = x + scroll;
    const h = amp * (0.5 + 0.3 * Math.sin(xx * 0.04 + seed) + 0.2 * Math.sin(xx * 0.11 + seed * 2));
    g.fillRect(x, Math.round(base - h), 1, CH);
  }
}

function blit(g: Ctx, s: HTMLCanvasElement, x: number, y: number, scale = 1): void {
  g.drawImage(s, Math.round(x), Math.round(y), s.width * scale, s.height * scale);
}

type Painter = (g: Ctx, t: number) => void;

const painters: Record<string, Painter> = {
  'shrimp-trek': (g, t) => {
    skyBands(g, '#06223f', '#021022');
    for (let i = 0; i < 3; i += 1) glow(g, 40 + i * 60, -10, 40, '#3fb4ff', 0.12);
    hills(g, 92, 30, '#0a2c4a', 1, t * 6);
    hills(g, 104, 18, '#06192e', 3, t * 14);
    for (let i = 0; i < 12; i += 1) {
      const x = (hash01(i, 3) * CW + t * 8) % CW;
      const y = (CH - ((t * 12 + i * 23) % CH)) | 0;
      g.fillStyle = '#9fe4ff';
      g.fillRect(x | 0, y, 1, 1);
    }
    const bob = Math.round(Math.sin(t * 6));
    glow(g, 96, 80, 26, '#ff7a59', 0.25);
    blit(
      g,
      buildSprite(Math.floor(t * 6) % 2 ? SHRIMP : SHRIMP_WALK, {}, { rim: '#ffe0c0' }),
      70,
      64 + bob,
      2,
    );
    blit(g, buildSprite(CRAB, {}, { rim: '#ffd0b0', flip: true }), 140, 82, 1);
  },
  'shrimp-guard': (g, t) => {
    skyBands(g, '#082540', '#041222');
    rect(g, 0, 70, CW, 38, '#0b2238');
    for (let lane = 0; lane < 3; lane += 1) {
      const y = 40 + lane * 18;
      rect(g, 0, y, CW, 8, '#103a5a');
      rect(g, 0, y, CW, 1, '#2b6c96');
    }
    rect(g, 168, 30, 10, 70, '#5c6b8a');
    rect(g, 168, 30, 10, 2, '#a0b4d8');
    glow(g, 173, 64, 26, '#4fd1ff', 0.3);
    for (let i = 0; i < 4; i += 1) {
      const x = ((i * 50 + t * 20) % 170) - 10;
      blit(g, buildSprite(CRAB, {}, { rim: '#ffd0b0' }), x, 36 + (i % 3) * 18, 1);
    }
    blit(
      g,
      buildSprite(
        SHRIMP,
        { b: '#4fd1ff', h: '#b8f0ff', d: '#1d6c96', t: '#3ab0e0', c: '#8fe4ff' },
        { flip: true },
      ),
      146,
      54,
      1,
    );
  },
  'shrimp-heist': (g, t) => {
    skyBands(g, '#100a24', '#05030f');
    for (let c = 0; c < 6; c += 1) rect(g, 12 + c * 30, 30, 26, 60, c % 2 ? '#1a1238' : '#160f30');
    const sweep = Math.sin(t * 1.4) * 40;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(255,60,90,0.18)';
    g.beginPath();
    g.moveTo(100, 22);
    g.lineTo(80 + sweep, 100);
    g.lineTo(120 + sweep, 100);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    blit(g, buildSprite(CAMERA_EYE), 96, 18, 1);
    blit(g, buildSprite(GUARD, {}, { rim: '#ffffff' }), 130, 66, 1);
    glow(g, 40, 80, 18, '#b28dff', 0.3);
    blit(
      g,
      buildSprite(SHRIMP, { b: '#7a5ac8', h: '#c0a8ff', d: '#3a2a6a', t: '#5a40a0', c: '#9a7ae0' }),
      30,
      78,
      1,
    );
  },
  'shrimp-catch': (g, t) => {
    skyBands(g, '#0d3a3a', '#082222');
    ellipse(g, 52, 88, 30, 6, '#14504a');
    ellipse(g, 142, 54, 30, 6, '#14504a');
    const bob = Math.round(Math.sin(t * 4) * 2);
    blit(g, creatureSprite(42, '#5ee08f', '#ffe066', 14), 120, 28 + bob, 2);
    blit(g, creatureSprite(7, '#ff7a59', '#ffd0b0', 12), 36, 62 - bob, 2);
    rect(g, 108, 18, 50, 3, '#05030c');
    rect(g, 108, 18, 34, 3, '#5ee08f');
  },
  'shrimp-look': (g, t) => {
    rect(g, 0, 0, CW, CH, '#05060f');
    for (let x = 10; x < CW; x += 36) rect(g, x, 20, 20, 70, '#0c1022');
    const fx = 96 + Math.sin(t) * 40;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(160,200,255,0.12)';
    g.beginPath();
    g.moveTo(30, 90);
    g.lineTo(fx - 22, 30);
    g.lineTo(fx + 22, 30);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    const flick = Math.sin(t * 9) > 0.6 ? 0.4 : 0.85;
    g.globalAlpha = flick;
    blit(g, buildSprite(GHOST, {}, { outline: null }), fx - 12, 26 + Math.sin(t * 2) * 3, 2);
    g.globalAlpha = 1;
    glow(g, fx, 40, 30, '#9fc4ff', 0.2);
  },
  'shrimp-rampage': (g, t) => {
    skyBands(g, '#1a0a2e', '#0a0612');
    moon(g, 150, 24, 10, '#fff0c8', '#ffb347');
    stars(g, t, 9, 30, 60);
    rect(g, 0, 80, CW, 28, '#1e0f12');
    for (let i = 0; i < 5; i += 1) {
      blit(
        g,
        buildSprite(PUMPKIN, {}, { rim: '#ffe0a0' }),
        10 + i * 36,
        66 + Math.round(Math.sin(t * 5 + i) * (i % 2 ? 2 : 0)),
        1,
      );
      glow(g, 17 + i * 36, 72, 10, '#ffb347', 0.35);
    }
  },
  'shrimp-ink': (g, t) => {
    skyBands(g, '#2a2216', '#120e08');
    hills(g, 70, 40, '#3a2f20', 4, t * 2);
    hills(g, 90, 26, '#231a10', 7, t * 4);
    hills(g, 104, 12, '#120c06', 9, t * 7);
    glow(g, 140, 30, 30, '#ffe0a0', 0.25);
    blit(g, buildSprite(SCROLL), 60, 60, 3);
  },
  'shrimp-greens': (g, t) => {
    skyBands(g, '#1a2a14', '#0a120a');
    glow(g, 96, 20, 50, '#ffe6a0', 0.25);
    rect(g, 20, 70, 152, 30, '#5a3a22');
    rect(g, 20, 70, 152, 2, '#8a5a32');
    blit(g, buildSprite(BOWL), 40, 62, 2);
    blit(g, buildSprite(BROCCOLI), 90, 56 + Math.round(Math.sin(t * 3)), 2);
    blit(g, buildSprite(CARROT), 120, 58, 2);
    blit(g, buildSprite(TOMATO), 145, 60 + Math.round(Math.cos(t * 3)), 2);
  },
  'shrimp-conquest': (g, t) => {
    skyBands(g, '#2a0f20', '#120610');
    hills(g, 84, 22, '#2a1420', 2, 0);
    rect(g, 110, 26, 60, 60, '#3a2030');
    for (let i = 0; i < 6; i += 1) rect(g, 110 + i * 11, 20, 6, 8, '#3a2030');
    rect(g, 136, 60, 10, 26, '#120610');
    glow(g, 140, 50, 30, '#ff5d73', 0.2);
    blit(g, buildSprite(FLAG), 138, 8, 1);
    blit(g, buildSprite(HERO, {}, { rim: '#ffffff' }), 40 + Math.sin(t * 2) * 6, 72, 2);
  },
  'shrimp-leap': (g, t) => {
    skyBands(g, '#0c1530', '#060a18');
    stars(g, t, 3, 30, 50);
    for (let i = 0; i < 4; i += 1) {
      const x = 20 + i * 48;
      rect(g, x, 50 + (i % 2) * 10, 3, 60, '#2a3458');
      rect(g, x - 3, 48 + (i % 2) * 10, 9, 3, '#4a5a8a');
      glow(g, x + 1, 52 + (i % 2) * 10, 16, '#ffe9a0', 0.45);
    }
    const p = (t * 0.8) % 1;
    const x = 20 + p * 48;
    const y = 40 - Math.sin(p * Math.PI) * 26;
    glow(g, x + 7, y + 4, 14, '#7cf0a0', 0.3);
    blit(g, buildSprite(SLIME, {}, { rim: '#ffffff' }), x, y, 1);
  },
  'shrimp-burger': (g, t) => {
    skyBands(g, '#2a1408', '#120804');
    rect(g, 0, 86, CW, 22, '#3a2214');
    rect(g, 0, 86, CW, 2, '#6a4224');
    const layers = [
      slab(28, 4, '#f0a24a'),
      slab(30, 3, '#5fd35f', true),
      slab(28, 4, '#6a3a22'),
      slab(29, 3, '#ffd23f'),
    ];
    let y = 82;
    for (const l of layers) {
      blit(g, buildSprite(l), 82, y, 1);
      y -= 4;
    }
    blit(g, buildSprite(BUN_TOP), 83, y - 2, 2 / 2);
    for (let i = 0; i < 3; i += 1) {
      const fy = ((t * 30 + i * 40) % 90) - 10;
      blit(
        g,
        buildSprite(i === 1 ? slab(12, 3, '#ff4848') : slab(12, 3, '#ffd23f')),
        30 + i * 60,
        fy,
        1,
      );
    }
    glow(g, 96, 70, 30, '#ffc24a', 0.25);
    disc(g, 170, 20, 3, '#ffe066');
  },
};

export function paintCover(g: Ctx, id: string, t: number): void {
  g.imageSmoothingEnabled = false;
  const p = painters[id];
  if (p) p(g, t);
  else rect(g, 0, 0, CW, CH, '#141026');
}
