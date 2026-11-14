import { definition } from '@games/claw-greens/src/definition';
import type { VegeState } from '@games/claw-greens/src/engine';
import { HAIRS, type HairStyle, humanoid, SKINS } from '../gfx/actors';
import { type Grade, LightMask, Spring, shift } from '../gfx/art';
import { godRays, sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  bayer,
  type Ctx,
  dither,
  easeOutBack,
  easeOutCubic,
  ellipse,
  hash01,
  mix,
  rect,
  VH,
  VW,
  withAlpha,
} from '../gfx/pixel';
import type { GameModule, GameScene } from '../gfx/scene';
import { BROCCOLI, buildSprite, CARROT, type SpriteDef, TOMATO } from '../gfx/sprites';
import { drawText, textWidth } from '../gfx/text';
import { tiny } from '../gfx/tiny';
import { blit } from '../gfx/world';

/* ---------- props ---------- */

const PORK: SpriteDef = {
  rows: ['.bbhb.bb.', 'bbbbbhbbb', 'bbdbbbbdb', '.bbbdbbb.'],
  pal: { b: '#9a3a1e', h: '#e8904a', d: '#5a1a10' },
};
const RICE: SpriteDef = {
  rows: ['..wwwww..', '.wwhwwww.', 'wwwwwwhww'],
  pal: { w: '#f4efe4', h: '#ffffff' },
};
const PLATE: SpriteDef = {
  rows: [
    '..ppppppppppp..',
    '.prrrrrrrrrrrp.',
    'prrrrrrrrrrrrrp',
    '.pppppppppppppd',
    '...ddddddddd...',
  ],
  pal: { p: '#f0ecf8', r: '#d8d4ec', d: '#8a86a8' },
};
const BOWL: SpriteDef = {
  rows: ['wwwwwwwwwwwww', '.wbbbbbbbbbw.', '..wbbbbbbbw..', '...ddddddd...'],
  pal: { w: '#f4f0fc', b: '#b8c4ec', d: '#7a80a8' },
};
const CHOPSTICKS: SpriteDef = {
  rows: ['ww.........', '.ww........', '..www......', '....www....', '......wwww.'],
  pal: { w: '#c8925a' },
};

const SHIRTS = ['#e8604a', '#4f8fe0', '#e0b040', '#5ac08a', '#b070e0', '#ff8ab0'];
const STYLES: HairStyle[] = ['short', 'bob', 'long', 'spiky', 'bun', 'cap'];

function diner(i: number, seed: number, t: number, heat: number): SpriteDef {
  const r = (k: number) => hash01(seed * 31 + i * 7, k);
  const blink = (t * (0.9 + r(5) * 0.3) + r(6) * 3) % 3.4 < 0.12;
  const talk = heat >= 3 && Math.sin(t * 9 + i * 2) > 0.2;
  return humanoid({
    skin: SKINS[Math.floor(r(1) * SKINS.length)]!,
    hair: HAIRS[Math.floor(r(2) * HAIRS.length)]!,
    style: STYLES[Math.floor(r(3) * STYLES.length)]!,
    shirt: SHIRTS[(i + Math.floor(r(4) * 3)) % SHIRTS.length]!,
    bust: true,
    blink,
    talk,
    angry: heat >= 3,
  });
}

/* ---------- rooms (static layers cached once per phase) ---------- */

const roomCache = new Map<string, HTMLCanvasElement>();

function paintRoom(phase: string): HTMLCanvasElement {
  const hit = roomCache.get(phase);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = VW;
  c.height = VH;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  if (phase === 'school') {
    sky(g, ['#e8eef6', '#c8d4e4', '#a8b8d0'], 0, 124, 6);
    // Big daylight windows.
    for (let x = 16; x < VW; x += 92) {
      rect(g, x, 14, 70, 66, '#5a6a8a');
      rect(g, x + 2, 16, 66, 62, '#bfe6ff');
      dither(g, x + 2, 52, 66, 26, '#9fd0f4', 0.5);
      rect(g, x + 2, 16, 66, 2, '#ffffff');
      rect(g, x + 34, 16, 2, 62, '#5a6a8a');
      rect(g, x + 2, 46, 66, 2, '#5a6a8a');
      // Trees outside.
      ellipse(g, x + 18, 70, 14, 10, '#7ac07a');
      ellipse(g, x + 52, 72, 12, 8, '#5aa86a');
    }
    // Menu board.
    rect(g, 150, 84, 84, 24, '#2a4a3a');
    rect(g, 150, 84, 84, 2, '#5a8a6a');
    for (let i = 0; i < 4; i += 1) rect(g, 156 + i * 18, 92 + (i % 2) * 6, 12, 2, '#d8f0e0');
    rect(g, 0, 110, VW, 16, '#9aa8c0');
    rect(g, 0, 110, VW, 1, '#ffffff');
    // Floor tiles.
    for (let y = 124; y < VH; y += 1) {
      const k = (y - 124) / (VH - 124);
      g.fillStyle = mix('#c8ccd8', '#8a90a8', k);
      g.fillRect(0, y, VW, 1);
    }
    for (let x = -VW; x < VW * 2; x += 24) {
      g.fillStyle = '#9aa0b8';
      for (let y = 124; y < VH; y += 1)
        g.fillRect(Math.round(VW / 2 + (x - VW / 2) * (1 + (y - 124) / 40)), y, 1, 1);
    }
  } else if (phase === 'out' || phase === 'work') {
    sky(g, ['#3a1018', '#2a0c14', '#1a080e'], 0, 124, 6);
    // Lattice screen.
    for (let x = 0; x < VW; x += 12) rect(g, x, 20, 2, 90, '#4a1c1c');
    for (let y = 20; y < 110; y += 12) rect(g, 0, y, VW, 2, '#4a1c1c');
    dither(g, 0, 20, VW, 90, '#5a2a1a', 0.25);
    // Neon sign.
    rect(g, 250, 26, 100, 22, '#1a060c');
    rect(g, 250, 26, 100, 1, '#5a1a2a');
    rect(g, 0, 110, VW, 14, '#2a0c10');
    rect(g, 0, 110, VW, 1, '#6a2a2a');
    for (let y = 124; y < VH; y += 1) {
      g.fillStyle = mix('#3a1a14', '#140806', (y - 124) / (VH - 124));
      g.fillRect(0, y, VW, 1);
    }
  } else if (phase === 'seat') {
    sky(g, ['#141030', '#0c0a20', '#060410'], 0, VH, 8);
  } else {
    // Home: warm wallpaper, wainscot, night window, picture frame.
    for (let y = 0; y < 124; y += 1) {
      g.fillStyle = mix('#7a3a2a', '#4a2018', y / 124);
      g.fillRect(0, y, VW, 1);
    }
    for (let x = 0; x < VW; x += 8)
      for (let y = 0; y < 92; y += 1)
        if (bayer(x, y) < 0.5 && (y + x) % 8 < 2) rect(g, x + 3, y, 1, 1, '#8a4a34');
    // Window.
    rect(g, 34, 18, 74, 58, '#2a140e');
    sky(g, ['#0c1838', '#1a2a5a'], 0, 0, 2);
    const win = g.createLinearGradient(0, 22, 0, 72);
    win.addColorStop(0, '#0c1838');
    win.addColorStop(1, '#24346a');
    g.fillStyle = win;
    g.fillRect(38, 22, 66, 50);
    for (let i = 0; i < 30; i += 1)
      rect(
        g,
        38 + Math.floor(hash01(i, 3) * 66),
        50 + Math.floor(hash01(i, 4) * 20),
        1,
        1,
        i % 3 ? '#ffd36b' : '#9fe4ff',
      );
    rect(g, 70, 22, 2, 50, '#2a140e');
    rect(g, 38, 46, 66, 2, '#2a140e');
    rect(g, 34, 76, 74, 3, '#5a2e1e');
    // Picture frame.
    rect(g, 276, 26, 54, 40, '#c8903a');
    rect(g, 279, 29, 48, 34, '#2a3a2a');
    ellipse(g, 303, 52, 18, 8, '#4a6a3a');
    rect(g, 276, 26, 54, 1, '#ffd08a');
    // Wainscot.
    rect(g, 0, 92, VW, 32, '#3a1e14');
    rect(g, 0, 92, VW, 2, '#7a4a2a');
    for (let x = 6; x < VW; x += 40) {
      rect(g, x, 98, 30, 20, '#341a12');
      rect(g, x, 98, 30, 1, '#5a321e');
    }
    for (let y = 124; y < VH; y += 1) {
      g.fillStyle = mix('#3a2016', '#1a0c08', (y - 124) / (VH - 124));
      g.fillRect(0, y, VW, 1);
    }
    for (let x = 0; x < VW; x += 22) rect(g, x, 124, 1, VH - 124, '#2a140c');
  }
  roomCache.set(phase, c);
  return c;
}

function drawTable(g: Ctx, phase: string): void {
  const top = phase === 'school' ? '#d8cfbc' : phase === 'seat' ? '#6a4a8a' : '#9a5a32';
  const [deep, shade, base, light] = [shift(top, -3), shift(top, -1.4), top, shift(top, 1)];
  // Pedestal shadow and skirt.
  ellipse(g, VW / 2, 196, 120, 10, withAlpha('#000000', 0.5));
  ellipse(g, VW / 2, 158, 156, 32, deep);
  ellipse(g, VW / 2, 154, 154, 30, shade);
  ellipse(g, VW / 2, 151, 152, 28, base);
  // Lit far rim + grain.
  ellipse(g, VW / 2, 147, 140, 22, mix(base, light, 0.35));
  ellipse(g, VW / 2, 150, 138, 22, base);
  for (let i = 0; i < 14; i += 1) {
    const y = 136 + i * 2.6;
    const half = Math.sqrt(Math.max(0, 1 - ((y - 151) / 28) ** 2)) * 140;
    if (i % 3 === 0) dither(g, VW / 2 - half, y, half * 2, 1, shade, 0.4);
  }
}

/* ---------- scene ---------- */

function createScene(): GameScene<VegeState> {
  const light = new LightMask();
  const nod = new Spring(1, 300, 12);
  let mood = 0;
  let lastAction = '';

  const dinerXs = (n: number): number[] =>
    Array.from({ length: n }, (_, i) => VW / 2 - ((n - 1) * 56) / 2 + i * 56);

  return {
    grade(state) {
      const phase = state.scenes[Math.min(state.turn, state.scenes.length - 1)]?.phase ?? 'home';
      if (phase === 'school')
        return { top: '#fff4e0', bottom: '#5a6aa0', strength: 0.22, bloom: 0.35 };
      if (phase === 'out') return { top: '#ff6a5a', bottom: '#2a0a2a', strength: 0.3, bloom: 0.6 };
      return { top: '#ffb070', bottom: '#2a1030', strength: 0.3, bloom: 0.55 } satisfies Grade;
    },
    reset() {
      lastAction = '';
    },
    draw(f) {
      const { g, t, state, dt } = f;
      const scene = state.scenes[Math.min(state.turn, state.scenes.length - 1)];
      const phase = scene?.phase ?? 'home';
      const heat = scene?.heat ?? 0;
      g.drawImage(paintRoom(phase), 0, 0);
      if (phase === 'school') godRays(g, t, '#fff6d8', 4, 0.08);
      if (phase === 'out') {
        const flick = Math.sin(t * 17) > -0.9 ? 1 : 0.4;
        glow(g, 300, 37, 50, '#ff4a8a', 0.35 * flick);
        const [left, right] = f.lang === 'zh' ? (['素', '食'] as const) : (['VEG', 'AN'] as const);
        drawText(g, left, 270, 31, { color: mix('#ffd0e8', '#ff6aa8', 0.3), outline: '#5a0a2a' });
        drawText(g, right, 314, 31, { color: mix('#ffd0e8', '#ff6aa8', 0.3), outline: '#5a0a2a' });
        for (const x of [40, 120, 200]) {
          const sway = Math.round(Math.sin(t * 1.3 + x) * 1.5);
          rect(g, x + sway - 7, 14, 14, 18, '#d8302a');
          rect(g, x + sway - 7, 14, 14, 2, '#ffd08a');
          rect(g, x + sway - 7, 30, 14, 2, '#ffd08a');
          rect(g, x + sway - 5, 16, 2, 14, '#ff6a4a');
          glow(g, x + sway, 23, 26, '#ff7a3a', 0.4 + 0.05 * Math.sin(t * 3 + x));
        }
      }
      // Pendant lamp (home / seat / out).
      if (phase !== 'school') {
        rect(g, VW / 2, 0, 1, 30, '#1a0c08');
        const sw = Math.round(Math.sin(t * 0.9) * 1);
        rect(g, VW / 2 - 12 + sw, 30, 24, 7, '#2a1a12');
        rect(g, VW / 2 - 10 + sw, 30, 20, 1, '#6a4a2a');
        rect(g, VW / 2 - 5 + sw, 37, 10, 2, '#fff2c0');
        glow(g, VW / 2 + sw, 40, 36, '#ffd890', 0.55);
      }
      const n = scene?.who === 'self' ? 0 : scene?.who === 'class' ? 5 : 4;
      const xs = dinerXs(n);
      // Diners (bust, behind the table), breathing and reacting.
      xs.forEach((x, i) => {
        const breath = Math.sin(t * 2.2 + i * 1.7) > 0.6 ? 1 : 0;
        const shocked = mood < 0 && f.since < 0.6 ? Math.round(Math.sin(f.since * 40) * 1.5) : 0;
        const hop =
          mood > 0 && f.since < 0.5 ? -Math.round(Math.sin((f.since / 0.5) * Math.PI) * 3) : 0;
        const y = 128 + Math.round(Math.abs(i - (n - 1) / 2) * 2) - breath + hop;
        const s = buildSprite(diner(i, state.seed, t, heat));
        ellipse(g, x, y - 2, 16, 3, withAlpha('#000000', 0.25));
        blit(g, s, x + shocked, y, { anchor: 'bc', scale: 2 });
        if (heat >= 3 && Math.sin(t * 3 + i * 2) > 0.7) {
          tiny(g, '!', x + 14, y - 50, { color: '#ff6b6b', scale: 2 });
        }
      });
      drawTable(g, phase);
      // Dishes on the table with AO + steam.
      const veg = scene?.vegOnTable ?? true;
      const dishes: SpriteDef[] = veg ? [BROCCOLI, PORK, TOMATO] : [PORK, PORK, CARROT];
      dishes.forEach((d, i) => {
        const x = VW / 2 - 76 + i * 76;
        const y = 146 + (i === 1 ? -4 : 0);
        ellipse(g, x, y + 1, 15, 3, withAlpha('#000000', 0.35));
        blit(g, buildSprite(BOWL), x, y, { anchor: 'bc', scale: 2 });
        blit(g, buildSprite(d), x, y - 5, { anchor: 'bc', scale: 2 });
        if (Math.random() < dt * 3) f.fx.steam(x - 6 + Math.random() * 12, y - 14, '#f4ecff', 1);
      });
      // A dish slides in when you bring your own.
      if ((lastAction === 'bring' || lastAction === 'stock') && f.since < 3) {
        const k = easeOutBack(Math.min(1, f.since / 0.5));
        const x = VW / 2 + 116;
        const y = Math.round(200 - 40 * k);
        ellipse(g, x, y + 1, 15, 3, withAlpha('#000000', 0.35));
        blit(g, buildSprite(BOWL), x, y, { anchor: 'bc', scale: 2 });
        blit(g, buildSprite(CARROT), x - 6, y - 5, { anchor: 'bc', scale: 2 });
        blit(g, buildSprite(BROCCOLI), x + 6, y - 5, { anchor: 'bc', scale: 2 });
        if (f.since < 0.6) glow(g, x, y - 10, 24, '#9dffb0', 0.5 * (1 - f.since / 0.6));
      }
      // Player: over-the-shoulder back view with own plate.
      const leaving = lastAction === 'leave' && f.since < 1.6;
      const px = 104 - (leaving ? Math.round(easeOutCubic(Math.min(1, f.since / 0.8)) * 90) : 0);
      const plateX = 160;
      ellipse(g, plateX, 188, 30, 6, withAlpha('#000000', 0.35));
      blit(g, buildSprite(PLATE), plateX, 188, { anchor: 'bc', scale: 2 });
      blit(g, buildSprite(RICE), plateX - 10, 180, { anchor: 'bc', scale: 2 });
      blit(g, buildSprite(BROCCOLI), plateX + 12, 180, { anchor: 'bc', scale: 2 });
      blit(g, buildSprite(CHOPSTICKS), plateX + 30, 190, { anchor: 'bc', scale: 2 });
      // Veg piece arcs to your plate when sharing.
      if (lastAction === 'share' && f.since < 0.8) {
        const k = easeOutCubic(f.since / 0.8);
        const x = VW / 2 - 76 + (plateX - (VW / 2 - 76)) * k;
        const y = 132 + (176 - 132) * k - Math.sin(k * Math.PI) * 30;
        blit(g, buildSprite(BROCCOLI), x, y, { anchor: 'c', scale: 2 });
      }
      nod.target = 1;
      const sq = nod.step(dt);
      const me = buildSprite(
        humanoid({
          view: 'back',
          style: 'short',
          hair: '#2a1e30',
          shirt: '#3f8a5a',
          bust: true,
          arms: lastAction === 'bite' && f.since < 1 ? 'eat' : 'down',
        }),
      );
      const stance = state.line / 8;
      glow(g, px, 190, 46, mix('#ff6b6b', '#7ee07a', stance), 0.18 + (f.since < 0.6 ? 0.25 : 0));
      blit(g, me, px, VH + 4, { anchor: 'bc', scale: 3, squash: sq });
      // Rim light on the player's silhouette from the lamp.
      rect(g, px - 18, VH - 54, 1, 30, withAlpha('#ffd890', 0.25));
      // Speech bubble for talking actions.
      if ((lastAction === 'name' || lastAction === 'differ') && f.since < 2.2) {
        const k = easeOutBack(Math.min(1, f.since / 0.25));
        const bw = Math.round(30 * k);
        const bx = px + 22;
        const by = 120;
        rect(g, bx, by, bw, 16, '#fff4e0');
        rect(g, bx, by + 16, bw, 1, '#c8b8a0');
        rect(g, bx + 4, by + 17, 3, 3, '#fff4e0');
        if (k > 0.9)
          tiny(g, lastAction === 'name' ? '!' : '...', bx + bw / 2, by + 6, {
            color: '#3a2a4a',
            outline: null,
            align: 'center',
          });
      }
      // Night lighting pass for warm interiors.
      if (phase !== 'school') {
        light.begin('#0a0414', phase === 'seat' ? 0.7 : 0.5);
        light.light(VW / 2, 120, 150, 1);
        light.light(VW / 2, 40, 40, 1);
        if (phase === 'out') for (const x of [40, 120, 200]) light.light(x, 23, 40, 0.8);
        light.light(px, 200, 60, 0.5);
        light.end(g);
      }
      if (heat >= 3) glow(g, VW / 2, 110, 100, '#ff3a2a', 0.06 + 0.03 * Math.sin(t * 4));
    },
    hud(f) {
      const { g, state, t } = f;
      const scene = state.scenes[Math.min(state.turn, state.scenes.length - 1)];
      // Meal track: 16 little plates.
      const total = state.maxTurns;
      const cur = Math.min(state.turn, total - 1);
      for (let i = 0; i < total; i += 1) {
        const x = 10 + i * 9;
        const done = i < state.turn;
        const now = i === cur && state.outcome === 'ongoing';
        rect(g, x - 1, 9, 8, 5, '#05030c');
        rect(g, x, 10, 6, 3, done ? '#7ee07a' : now ? '#ffe9a8' : '#3a2e5a');
        if (done) rect(g, x, 10, 6, 1, '#d8ffd8');
        if (now) glow(g, x + 3, 11, 8, '#ffe9a8', 0.4 + 0.2 * Math.sin(t * 5));
      }
      if (scene) {
        const title = f.term(scene.title);
        const showTitle = f.lang === 'zh' || !/[\u3400-\u9fff]/.test(title);
        if (showTitle) {
          const w = textWidth(title) + 16;
          rect(g, VW / 2 - w / 2, 5, w, 15, withAlpha('#0a0614', 0.75));
          rect(g, VW / 2 - w / 2, 19, w, 1, withAlpha('#ffd890', 0.5));
          drawText(g, title, VW / 2, 6, { color: '#fff0d0', align: 'center', outline: null });
        }
      }
    },
    react(f, o) {
      const prev = o.previous as VegeState;
      const s = o.state;
      lastAction = o.action.id;
      const delta =
        s.body + s.home + s.room + s.line - (prev.body + prev.home + prev.room + prev.line);
      mood = Math.sign(delta);
      nod.impulse(mood >= 0 ? -3 : 4);
      if (delta < 0) {
        f.fx.addTrauma(0.25);
        f.fx.kick(0, 2);
        f.fx.flash('#ff3a2a', 0.12);
        f.cue('bad');
        for (const x of dinerXs(4)) f.fx.float(x + 10, 70, '!', '#ff6b6b', 0.8);
      } else if (delta > 0) {
        f.cue('good');
        for (const x of dinerXs(3)) f.fx.float(x, 76, '♥', '#ff9ae0', 1.2);
        f.fx.burst(VW / 2, 150, {
          count: 14,
          colors: ['#ffe9a8', '#ffffff'],
          speed: 40,
          gravity: -30,
          life: 1,
        });
      }
      if (lastAction === 'bring' || lastAction === 'stock') {
        f.fx.dust(VW / 2 + 116, 170, '#e8d0b0', 8);
        f.cue('land');
      }
      if (lastAction === 'leave') f.cue('whoosh');
    },
  };
}

const module: GameModule<VegeState> = { definition, createScene };
export default module;
