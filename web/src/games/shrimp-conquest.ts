import { definition } from '@games/shrimp-conquest/src/definition';
import type { TinyState } from '@games/shrimp-conquest/src/engine';
import { humanoid } from '../gfx/actors';
import { type Grade, LightMask, shift } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  bayer,
  type Ctx,
  clamp,
  ctx2d,
  dither,
  easeInOut,
  easeOutBack,
  ellipse,
  hash01,
  makeCanvas,
  mix,
  rect,
  VH,
  VW,
  withAlpha,
} from '../gfx/pixel';
import type { GameModule, GameScene, HitRegion } from '../gfx/scene';
import { buildSprite } from '../gfx/sprites';
import { drawText, textWidth } from '../gfx/text';
import { tiny } from '../gfx/tiny';
import { blit } from '../gfx/world';

const GROUND = 186;
const ZH_NAMES: Record<string, string> = { bastion: '鐵壁國', harvest: '豐穗國', mirror: '鏡面國' };
const KINGDOM: Record<string, { wall: string; roof: string; sky: [string, string, string] }> = {
  bastion: { wall: '#6a6a80', roof: '#3a3a52', sky: ['#5a4a7a', '#a87a8a', '#e8b08a'] },
  harvest: { wall: '#a87a40', roof: '#6a3020', sky: ['#3a5a8a', '#8aa0c0', '#f0c890'] },
  mirror: { wall: '#7ab8d0', roof: '#3a6a8a', sky: ['#2a3a6a', '#6aa0c0', '#c8f0ff'] },
};

/* ---------- cached giant room ---------- */

const roomCache = new Map<string, HTMLCanvasElement>();

function castleSilhouette(
  g: Ctx,
  x: number,
  base: number,
  scale: number,
  k: (typeof KINGDOM)[string],
): void {
  const w = 36 * scale;
  const h = 26 * scale;
  rect(g, x, base - h, w, h, k.wall);
  rect(g, x + w - 6 * scale, base - h, 6 * scale, h, shift(k.wall, -1.2));
  for (let i = 0; i < w; i += 5 * scale)
    rect(g, x + i, base - h - 3 * scale, 3 * scale, 3 * scale, k.wall);
  rect(g, x + w / 2 - 6 * scale, base - h - 14 * scale, 12 * scale, 14 * scale, k.wall);
  rect(g, x + w / 2 - 8 * scale, base - h - 18 * scale, 16 * scale, 4 * scale, k.roof);
  rect(g, x + w / 2 - 1, base - h - 24 * scale, 1, 6 * scale, '#2a1a2a');
  rect(g, x + w / 2, base - h - 24 * scale, 4 * scale, 2 * scale, '#ff5d73');
  for (let i = 1; i < 4; i += 1)
    rect(g, x + (w * i) / 4 - scale, base - h / 2, 2 * scale, 3 * scale, '#ffd36b');
}

function paintRoom(target: string): HTMLCanvasElement {
  const hit = roomCache.get(target);
  if (hit) return hit;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  const k = KINGDOM[target] ?? KINGDOM.bastion!;
  // Giant wall: warm plaster, dithered.
  for (let y = 0; y < 150; y += 1) {
    g.fillStyle = mix('#5a3a3a', '#2a1a22', y / 150);
    g.fillRect(0, y, VW, 1);
  }
  dither(g, 0, 0, VW, 150, '#6a4646', 0.12);
  // Huge window onto the giant kingdom.
  const wx = 130;
  const wy = 8;
  const ww = 200;
  const wh = 110;
  rect(g, wx - 8, wy - 8, ww + 16, wh + 18, '#2a160e');
  rect(g, wx - 8, wy - 8, ww + 16, 2, '#7a4a2a');
  const sg = makeCanvas(ww, wh);
  const sgc = ctx2d(sg);
  if (target === 'none') sky(sgc, ['#4a3a6a', '#a8708a', '#f0b890'], 0, wh, 8);
  else sky(sgc, k.sky, 0, wh, 8);
  g.drawImage(sg, 0, 0, VW, wh, wx, wy, VW, wh);
  // Rolling hills + the kingdom(s).
  for (let x = 0; x < ww; x += 1) {
    const h = 14 + Math.sin(x * 0.04) * 6 + Math.sin(x * 0.11 + 2) * 3;
    rect(g, wx + x, wy + wh - h, 1, h, '#4a5a4a');
    rect(g, wx + x, wy + wh - h, 1, 1, '#7a8a6a');
  }
  if (target === 'none') {
    castleSilhouette(g, wx + 14, wy + wh - 10, 1, KINGDOM.bastion!);
    castleSilhouette(g, wx + 82, wy + wh - 12, 1, KINGDOM.harvest!);
    castleSilhouette(g, wx + 150, wy + wh - 10, 1, KINGDOM.mirror!);
  } else castleSilhouette(g, wx + 73, wy + wh - 10, 1.5, k);
  // Mullions.
  rect(g, wx + ww / 2 - 2, wy, 4, wh, '#2a160e');
  rect(g, wx, wy + wh / 2 - 2, ww, 4, '#2a160e');
  rect(g, wx - 12, wy + wh + 4, ww + 24, 6, '#4a2a1a');
  rect(g, wx - 12, wy + wh + 4, ww + 24, 1, '#9a6a3a');
  // Giant table leg (left) and chair leg (right) — pillars at our scale.
  for (const [x, w] of [
    [22, 40],
    [344, 26],
  ] as const) {
    rect(g, x, 0, w, GROUND, '#5a3220');
    rect(g, x, 0, 4, GROUND, '#8a5a32');
    rect(g, x + w - 8, 0, 8, GROUND, '#3a1e14');
    for (let y = 10; y < GROUND; y += 23) rect(g, x + 6, y, w - 16, 1, '#4a2818');
  }
  // Baseboard + floor planks in perspective.
  rect(g, 0, 140, VW, 12, '#3a2016');
  rect(g, 0, 140, VW, 1, '#6a3a22');
  for (let y = 152; y < VH; y += 1) {
    const k2 = (y - 152) / (VH - 152);
    g.fillStyle = mix('#6a4028', '#3a2014', k2);
    g.fillRect(0, y, VW, 1);
  }
  for (let i = -12; i <= 12; i += 1) {
    g.fillStyle = '#2a160c';
    for (let y = 152; y < VH; y += 1) {
      const spread = 1 + ((y - 152) / 64) * 2.2;
      g.fillRect(Math.round(VW / 2 + i * 26 * spread), y, 1, 1);
    }
  }
  for (const y of [158, 170, 190]) rect(g, 0, y, VW, 1, withAlpha('#2a160c', 0.5));
  // Giant crumbs + a dropped button.
  for (let i = 0; i < 7; i += 1) {
    const x = 60 + hash01(i, 4) * 280;
    const y = 160 + hash01(i, 5) * 40;
    const s = 3 + Math.floor(hash01(i, 6) * 4);
    rect(g, x, y, s, s - 1, '#d8a050');
    rect(g, x, y, s, 1, '#ffd890');
    rect(g, x + 1, y + s - 1, s, 1, withAlpha('#000000', 0.4));
  }
  ellipse(g, 330, 196, 16, 5, withAlpha('#000000', 0.4));
  ellipse(g, 330, 192, 16, 5, '#3a6aa0');
  ellipse(g, 330, 191, 15, 4, '#5a8ac8');
  for (const dx of [-5, 5]) rect(g, 330 + dx, 190, 2, 2, '#1a2a4a');
  roomCache.set(target, c);
  return c;
}

/* ---------- the giant eye ---------- */

function drawEye(g: Ctx, cx: number, cy: number, t: number, lookX: number, open: number): void {
  const rx = 38;
  const ry = 19;
  // Socket shadow + brow.
  ellipse(g, cx, cy, rx + 8, ry + 9, '#b86a44');
  ellipse(g, cx, cy - 2, rx + 4, ry + 5, '#c87a50');
  for (let x = -rx - 4; x <= rx + 4; x += 1) {
    const by = Math.round(cy - ry - 13 + (x * x) / (rx * 9));
    rect(g, cx + x, by, 1, 5, '#4a2414');
    rect(g, cx + x, by, 1, 1, '#7a4026');
  }
  // Almond opening.
  const lid = Math.max(0.05, open);
  for (let dy = -ry; dy <= ry; dy += 1) {
    const ny = dy / (ry * lid);
    if (Math.abs(ny) > 1) continue;
    const half = Math.round(rx * Math.sqrt(1 - ny * ny) * (1 - Math.abs(ny) * 0.15));
    // Sclera: warm white with shadowed top (lid AO) and veins.
    const top = dy < -ry * lid * 0.4;
    g.fillStyle = top ? '#d8ccc8' : '#f4ece4';
    g.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
  if (lid > 0.2) {
    for (let i = 0; i < 6; i += 1) {
      const vx = cx + (i < 3 ? -rx + 6 + i * 4 : rx - 18 + (i - 3) * 4);
      for (let k = 0; k < 6; k += 1)
        rect(g, vx + k, cy + Math.round(Math.sin(i + k) * 2), 1, 1, '#e08080');
    }
    // Iris tracks the hero.
    const ix = Math.round(cx + clamp(lookX, -1, 1) * 16);
    const ir = Math.min(14, Math.round(ry * lid));
    const rings = ['#4a1a1a', '#8a2a2a', '#c84a3a', '#e8803a', '#ffb050'];
    for (const [i, col] of rings.entries())
      ellipse(g, ix, cy, ir - i * 2.4, Math.min(ir - i * 2.4, ry * lid - 1), col);
    for (let a = 0; a < 16; a += 1) {
      const ang = (a / 16) * Math.PI * 2;
      rect(
        g,
        ix + Math.round(Math.cos(ang) * ir * 0.7),
        cy + Math.round(Math.sin(ang) * ir * 0.6 * lid),
        1,
        1,
        '#5a1a10',
      );
    }
    const pr = 5 + Math.round(Math.sin(t * 1.3) * 1.5);
    ellipse(g, ix, cy, pr, Math.min(pr, ry * lid - 2), '#0a0408');
    rect(g, ix - 6, cy - 6, 4, 3, '#ffffff');
    rect(g, ix + 4, cy + 3, 2, 1, '#ffd8c8');
    glow(g, ix, cy, 40, '#ff2a3a', 0.25);
  }
  // Lids + lashes.
  const lidY = Math.round(cy - ry * lid);
  for (let x = -rx; x <= rx; x += 1) {
    const yy = Math.round(lidY + (x * x) / (rx * 4));
    rect(g, cx + x, yy - 3, 1, 3, '#8a4a2e');
    if (x % 6 === 0) rect(g, cx + x - 1, yy - 6, 1, 3, '#1a0a0a');
  }
  const lowY = Math.round(cy + ry * lid);
  for (let x = -rx + 6; x <= rx - 6; x += 1)
    rect(g, cx + x, lowY - Math.round((x * x) / (rx * 6)), 1, 2, '#a85a3a');
}

const WIN = { x: 130, y: 8, w: 200, h: 110 };

/** A giant face pressed against the window, eyes tracking the hero. */
function drawFace(g: Ctx, t: number, look: number, open: number, drop: number): void {
  g.save();
  g.beginPath();
  g.rect(WIN.x, WIN.y, WIN.w, WIN.h);
  g.clip();
  const oy = drop;
  for (let y = 0; y < WIN.h; y += 1) {
    g.fillStyle = mix('#e8a878', '#a8603a', y / WIN.h);
    g.fillRect(WIN.x, WIN.y + y + oy, WIN.w, 1);
  }
  // Nose bridge + cheek shading.
  for (let y = 40; y < WIN.h; y += 1)
    rect(g, 228 - (y - 40) * 0.15, WIN.y + y + oy, 6 + (y - 40) * 0.3, 1, '#c87a50');
  rect(g, 236, WIN.y + 40 + oy, 2, WIN.h - 40, '#f0b890');
  dither(g, WIN.x, WIN.y + 80 + oy, WIN.w, 30, '#d0705a', 0.25);
  drawEye(g, 182, WIN.y + 58 + oy, t, look, open);
  drawEye(g, 284, WIN.y + 58 + oy, t + 0.2, look, open);
  g.restore();
  // Mullions + glass glare over the face.
  rect(g, WIN.x + WIN.w / 2 - 2, WIN.y, 4, WIN.h, '#2a160e');
  rect(g, WIN.x, WIN.y + WIN.h / 2 - 2, WIN.w, 4, '#2a160e');
  g.globalAlpha = 0.18;
  for (let i = 0; i < 18; i += 1) rect(g, WIN.x + 20 + i, WIN.y + 4 + i * 3, 3, 3, '#ffffff');
  g.globalAlpha = 1;
}

let redEdge: HTMLCanvasElement | null = null;
function suspicionEdge(): HTMLCanvasElement {
  if (redEdge) return redEdge;
  redEdge = makeCanvas(VW, VH);
  const g = ctx2d(redEdge);
  for (let y = 0; y < VH; y += 1)
    for (let x = 0; x < VW; x += 1) {
      const d = Math.min(x, VW - 1 - x, y * 1.5, (VH - 1 - y) * 1.5) / 36;
      if (d < 1 && bayer(x, y) > d) rect(g, x, y, 1, 1, '#c00a28');
    }
  return redEdge;
}

/** Giant work boot in side view; (x, y) = toe-left, sole bottom. */
function drawBoot(g: Ctx, x: number, y: number): void {
  const leather = '#6a3a24';
  // Shaft rising out of frame.
  rect(g, x + 48, y - 200, 52, 176, shift(leather, -0.4));
  for (let r = 0; r < 12; r += 1) rect(g, x + 36 + r, y - 36 - r * 2, 12, 2, shift(leather, -0.2));
  rect(g, x + 48, y - 200, 5, 176, shift(leather, 0.8));
  rect(g, x + 92, y - 200, 8, 176, shift(leather, -1.4));
  // Laces criss-cross on the front edge.
  // Tongue + criss-cross laces between two eyelet rows.
  rect(g, x + 54, y - 200, 14, 166, shift(leather, -0.9));
  for (let ly = y - 196; ly < y - 40; ly += 12) {
    rect(g, x + 52, ly, 2, 2, '#d8d0b8');
    rect(g, x + 68, ly, 2, 2, '#d8d0b8');
    for (let k = 0; k < 12; k += 1) {
      rect(g, x + 54 + Math.round(k * 1.2), ly + k, 1, 1, '#e8e0c8');
      rect(g, x + 67 - Math.round(k * 1.2), ly + k, 1, 1, '#b8a888');
    }
  }
  // Stitched seam down the back.
  for (let ly = y - 200; ly < y - 30; ly += 4) rect(g, x + 88, ly, 1, 2, shift(leather, 0.6));
  // Foot: rounded toe cap.
  for (let row = 0; row < 26; row += 1) {
    const yy = y - 34 + row;
    const inset = row < 16 ? Math.round((16 - Math.sqrt(256 - (16 - row) ** 2)) * 2.2) : 0;
    g.fillStyle = row < 3 ? shift(leather, 0.9) : row > 20 ? shift(leather, -1) : leather;
    g.fillRect(x + inset, yy, 102 - inset, 1);
  }
  rect(g, x + 10, y - 30, 14, 2, shift(leather, 1.4));
  // Welt stitching + sole + tread.
  rect(g, x - 2, y - 10, 106, 3, '#2a160e');
  for (let i = 0; i < 104; i += 4) rect(g, x + i, y - 9, 2, 1, '#c8a070');
  rect(g, x - 2, y - 7, 106, 7, '#1a1214');
  rect(g, x + 66, y - 7, 36, 7, '#120c0e');
  for (let i = 0; i < 104; i += 7) rect(g, x + i, y - 1, 4, 1, '#3a3036');
}

/** Giant hand reaching down from above (escape). */
function drawHand(g: Ctx, x: number, y: number): void {
  const skin = '#d89068';
  rect(g, x - 26, y - 90, 52, 60, shift(skin, -0.3));
  rect(g, x + 18, y - 90, 8, 60, shift(skin, -1.2));
  const fingers = [-24, -11, 2, 15];
  fingers.forEach((fx, i) => {
    const len = 28 + (i === 1 || i === 2 ? 6 : 0);
    rect(g, x + fx, y - 32, 11, len, skin);
    rect(g, x + fx, y - 32, 2, len, shift(skin, 0.9));
    rect(g, x + fx + 9, y - 32, 2, len, shift(skin, -1.2));
    rect(g, x + fx + 2, y - 34 + len, 7, 3, '#f0c0a0');
    rect(g, x + fx, y - 14 + (len - 28) / 2, 11, 1, shift(skin, -1));
  });
  rect(g, x - 34, y - 70, 10, 26, skin);
  rect(g, x - 34, y - 70, 2, 26, shift(skin, 0.9));
}

/* ---------- scene ---------- */

function createScene(): GameScene<TinyState> {
  const lights = new LightMask();
  let hitT = -10;
  let hurtT = -10;
  let forgeT = -10;
  let spotT = -10;
  let lastStomp = 0;

  const hero = (step: 0 | 1, arms: 'down' | 'up' = 'down') =>
    buildSprite(
      humanoid({
        skin: '#f6c9a0',
        hair: '#ff5d73',
        style: 'spiky',
        shirt: '#3ac0b0',
        accent: '#ffe066',
        pants: '#33415e',
        step,
        arms,
      }),
    );

  return {
    grade(state) {
      if (state.phase === 'discovery' || state.phase === 'escape')
        return { top: '#ff6070', bottom: '#2a0a20', strength: 0.32, bloom: 0.6 } satisfies Grade;
      return { top: '#ffd0a0', bottom: '#2a1030', strength: 0.26, bloom: 0.5 };
    },
    hits(state, actions): HitRegion[] {
      if (state.phase !== 'briefing') return [];
      const ids = ['target:bastion', 'target:harvest', 'target:mirror'];
      return ids
        .filter((id) => actions.some((a) => a.id === id))
        .map((id, i) => ({ x: 140 + i * 68, y: 70, w: 52, h: 46, actionId: id }));
    },
    draw(f) {
      const { g, t, state, dt } = f;
      g.drawImage(paintRoom(state.target ?? 'none'), 0, 0);
      // Sun shafts with motes through the giant window.
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = withAlpha('#ffd8a0', 0.06);
      g.beginPath();
      g.moveTo(140, 10);
      g.lineTo(320, 10);
      g.lineTo(250, GROUND);
      g.lineTo(40, GROUND);
      g.closePath();
      g.fill();
      g.globalCompositeOperation = 'source-over';
      if (Math.random() < dt * 6)
        f.fx.mote(60 + Math.random() * 220, 40 + Math.random() * 120, 2, 3, '#ffe8c0', 4, 1, true);

      const phase = state.phase;
      const running = phase === 'escape';
      const lunge = f.t - hitT < 0.35 ? Math.sin(((f.t - hitT) / 0.35) * Math.PI) * 40 : 0;
      const shake = f.t - hurtT < 0.35 ? Math.round(Math.sin((f.t - hurtT) * 60) * 2) : 0;
      let heroX = 110 + lunge;
      if (running) heroX = 90 + Math.sin(t * 0.8) * 20;
      const step = (running ? Math.floor(t * 12) : Math.floor(t * 1.5)) % 2 ? 1 : 0;
      const bob = running
        ? -Math.abs(Math.round(Math.sin(t * 24) * 2))
        : Math.sin(t * 2.4) > 0.7
          ? -1
          : 0;

      if (phase === 'workshop') {
        // Thimble anvil with a glowing part on top.
        const ax = 200;
        ellipse(g, ax, GROUND + 2, 26, 5, withAlpha('#000000', 0.45));
        rect(g, ax - 20, GROUND - 34, 40, 34, '#9aa0b8');
        rect(g, ax - 20, GROUND - 34, 40, 3, '#e0e4f0');
        rect(g, ax + 10, GROUND - 34, 10, 34, '#6a7090');
        for (let y = GROUND - 28; y < GROUND; y += 4)
          for (let x = ax - 18; x < ax + 18; x += 4)
            rect(g, x + ((y >> 2) % 2) * 2, y, 1, 1, '#5a6080');
        const heat = 0.5 + 0.5 * Math.sin(t * 8);
        rect(g, ax - 8, GROUND - 38, 16, 4, mix('#ff7a2a', '#ffe066', heat));
        glow(g, ax, GROUND - 38, 26, '#ff9a3a', 0.45 + heat * 0.2);
        if (f.t - forgeT < 0.5)
          glow(g, ax, GROUND - 40, 50, '#ffe066', 0.7 * (1 - (f.t - forgeT) * 2));
        if (Math.random() < dt * 10) f.fx.embers(ax, GROUND - 40, ['#ffb347', '#ffe066'], 1);
      }

      if (phase === 'combat' && state.combat) {
        // Giant boot: anticipation (slow lift), smash (fast drop), settle.
        const cyc = (t * 0.7) % 1;
        const lift = cyc < 0.65 ? easeInOut(cyc / 0.65) : 1 - ((cyc - 0.65) / 0.12) ** 2;
        const h = Math.max(0, lift) * 70;
        if (cyc > 0.77 && lastStomp < 0.77) {
          f.fx.dust(250, GROUND, '#c8a080', 14);
          f.fx.addTrauma(0.12);
        }
        lastStomp = cyc;
        const by = Math.round(GROUND - h);
        ellipse(g, 244, GROUND + 2, 52 - h * 0.3, 6 - h * 0.04, withAlpha('#000000', 0.5));
        drawBoot(g, 196, by);
        // Combo + round track.
        const c = state.combat;
        for (let i = 0; i < c.maxRounds; i += 1) {
          rect(g, 150 + i * 10, 34, 8, 4, i < c.round ? '#ff5d73' : '#3a2440');
          if (i === c.round) glow(g, 154 + i * 10, 36, 8, '#ff5d73', 0.5);
        }
        if (c.combo > 0)
          tiny(g, `X${c.combo}`, 152 + c.maxRounds * 10, 32, { color: '#ffe066', scale: 2 });
      }

      if (phase === 'captured') {
        // Glass jar around the hero.
        const jx = heroX;
        rect(g, jx - 26, GROUND - 74, 52, 4, '#8a8aa0');
        rect(g, jx - 28, GROUND - 78, 56, 5, '#b8b8d0');
        g.globalAlpha = 0.18;
        rect(g, jx - 24, GROUND - 70, 48, 70, '#c8e8ff');
        g.globalAlpha = 1;
        rect(g, jx - 24, GROUND - 70, 1, 70, '#e8f8ff');
        rect(g, jx + 23, GROUND - 70, 1, 70, '#8ab0c8');
        rect(g, jx - 18, GROUND - 64, 2, 40, withAlpha('#ffffff', 0.5));
        rect(g, jx - 14, GROUND - 60, 1, 14, withAlpha('#ffffff', 0.4));
      }

      // Hero.
      if (running)
        for (let i = 0; i < 4; i += 1)
          rect(g, heroX - 20 - i * 9, GROUND - 14 - i * 3, 6, 1, withAlpha('#ffffff', 0.4));
      ellipse(g, heroX, GROUND + 1, 9, 2, withAlpha('#000000', 0.45));
      blit(
        g,
        hero(step as 0 | 1, phase === 'ended' && state.outcome === 'won' ? 'up' : 'down'),
        heroX + shake,
        GROUND + 1 + bob,
        {
          anchor: 'bc',
          tint: '#ff2040',
          tintAlpha: f.t - hurtT < 0.12 ? 0.7 : 0,
        },
      );
      if (state.weapon) {
        const wx = heroX + 9;
        rect(g, wx, GROUND - 22 + bob, 1, 10, '#c8d0e8');
        rect(g, wx - 1, GROUND - 24 + bob, 3, 2, '#ffe066');
        glow(g, wx, GROUND - 20, 8, '#9fe4ff', 0.4);
      }

      if (phase === 'discovery') {
        const blink = Math.sin(t * 0.9 + 1) > 0.97 ? 0.08 : 1;
        const peek = easeOutBack(Math.min(1, (f.t - spotT) / 0.7));
        drawFace(g, t, (heroX - 230) / 140, blink, Math.round((1 - peek) * 110));
      }

      if (phase === 'escape' && state.escape) {
        // A giant hand's shadow sweeps in.
        const e = state.escape;
        const reach = 1 - e.beatsLeft / Math.max(1, e.beatsLeft + e.progress + 1);
        const sx = Math.round(300 - reach * 110 + Math.sin(t * 2) * 8);
        const hy = Math.round(60 + reach * 40 + Math.sin(t * 3) * 6);
        ellipse(g, sx, GROUND + 2, 44, 7, withAlpha('#000000', 0.3 + reach * 0.25));
        drawHand(g, sx, hy);
        for (let i = 0; i < e.need; i += 1) {
          const done = i < e.progress;
          rect(g, 150 + i * 12, 34, 10, 5, done ? '#7cf0a0' : '#2a3a3a');
          if (done) rect(g, 150 + i * 12, 34, 10, 1, '#d8ffe8');
        }
        tiny(g, `${e.beatsLeft}`, 150 + e.need * 12 + 6, 34, { color: '#ffd0d0' });
      }

      // Darkness + spot for discovery / escape.
      if (phase === 'discovery' || phase === 'escape') {
        lights.begin('#14040c', 0.45);
        lights.light(heroX, GROUND - 14, 46, 1);
        lights.cone(270, 70, Math.atan2(GROUND - 70, heroX - 270), 0.5, 230, 0.9);
        lights.light(230, 60, 120, 0.6);
        lights.end(g);
      }
    },
    hud(f) {
      const { g, state, t } = f;
      // Year track: 52 ticks.
      // Year track: one hairline tick per week, every 13th taller (seasons).
      for (let i = 0; i < 52; i += 1) {
        const done = i < state.week;
        rect(
          g,
          8 + i * 2,
          8,
          1,
          i % 13 === 12 ? 5 : 3,
          done ? '#ff8a9a' : withAlpha('#ffffff', 0.18),
        );
      }
      if (state.phase === 'briefing') {
        ['bastion', 'harvest', 'mirror'].forEach((id, i) => {
          const name = f.lang === 'zh' ? ZH_NAMES[id]! : f.term(ZH_NAMES[id]!);
          const x = 166 + i * 68;
          const focus = f.focus?.id === `target:${id}`;
          const w = textWidth(name) + 10;
          rect(g, x - w / 2, 122, w, 15, withAlpha('#05030c', focus ? 0.9 : 0.6));
          drawText(g, name, x, 123, {
            color: focus ? '#ffe066' : '#ffe0e8',
            align: 'center',
            outline: null,
          });
          if (focus) glow(g, x, 92, 40, '#ffe066', 0.25 + 0.1 * Math.sin(t * 6));
        });
      } else if (state.target && state.phase !== 'combat') {
        const name = f.lang === 'zh' ? ZH_NAMES[state.target]! : f.term(ZH_NAMES[state.target]!);
        const w = textWidth(name) + 12;
        rect(g, 230 - w / 2, 126, w, 15, withAlpha('#05030c', 0.7));
        rect(g, 230 - w / 2, 140, w, 1, '#ff5d73');
        drawText(g, name, 230, 127, { color: '#ffe0e8', align: 'center', outline: null });
      }
      // Exposure creeps in as a red dithered edge.
      if (state.suspicion >= 5) {
        g.globalAlpha =
          Math.min(0.55, (state.suspicion - 4) * 0.09) * (0.85 + 0.15 * Math.sin(t * 3));
        g.drawImage(suspicionEdge(), 0, 0);
        g.globalAlpha = 1;
      }
    },
    react(f, o) {
      const prev = o.previous as TinyState;
      const s = o.state;
      if (s.health < prev.health) {
        hurtT = f.t;
        f.fx.hit(110, GROUND - 14, 'medium', Math.PI, ['#ff6b6b', '#ffffff']);
        f.fx.flash('#ff2040', 0.2);
        f.cue('hit');
      }
      if (
        o.action.id.startsWith('strike') ||
        (s.combat && prev.combat && s.combat.enemy < prev.combat.enemy)
      ) {
        hitT = f.t;
        const heavy = o.action.id === 'strike:heavy';
        f.fx.hit(230, GROUND - 30, heavy ? 'heavy' : 'medium', 0, [
          '#ffffff',
          '#ffe066',
          '#ff9a3a',
        ]);
        f.cue(heavy ? 'heavy' : 'hit');
      }
      if (o.action.id === 'brace') {
        f.fx.ring(110, GROUND - 12, '#9fe4ff', 20);
        f.cue('land');
      }
      if (s.forged > prev.forged || o.action.id.startsWith('part:')) {
        forgeT = f.t;
        f.fx.sparks(200, GROUND - 38, -Math.PI / 2, ['#ffe066', '#ff9a3a', '#ffffff'], 26);
        f.fx.freeze(0.04);
        f.cue('hit');
      }
      if (s.phase === 'discovery' && prev.phase !== 'discovery') {
        spotT = f.t;
        f.fx.flash('#ff2040', 0.3);
        f.fx.addTrauma(0.45);
        f.fx.impact(1);
        f.cue('heavy');
      }
      if (o.action.id.startsWith('dodge')) {
        const dir = o.action.id.endsWith('left')
          ? Math.PI
          : o.action.id.endsWith('right')
            ? 0
            : Math.PI / 2;
        f.fx.dust(110, GROUND, '#c8a080', 10);
        f.fx.kick(Math.cos(dir) * 2, 0);
        f.cue('whoosh');
      }
      if (s.control > prev.control || s.influence > prev.influence) {
        f.fx.burst(230, 90, {
          count: 26,
          colors: ['#ff5d73', '#ffe066', '#ffffff'],
          speed: 90,
          gravity: 40,
        });
        f.cue('good');
      }
      if (s.coins > prev.coins) f.cue('coin');
      void hash01;
    },
  };
}

const module: GameModule<TinyState> = { definition, createScene };
export default module;
