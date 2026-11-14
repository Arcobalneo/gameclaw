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
  harvest: { wall: '#c8a060', roof: '#8a4a2a', sky: ['#4a6a9a', '#e8b070', '#ffd890'] },
  mirror: { wall: '#7ab8d0', roof: '#3a6a8a', sky: ['#2a3a6a', '#6aa0c0', '#c8f0ff'] },
};

/* ---------- cached giant room ---------- */

const roomCache = new Map<string, HTMLCanvasElement>();

function castleSilhouette(g: Ctx, x: number, base: number, scale: number, k: (typeof KINGDOM)[string]): void {
  const w = 36 * scale;
  const h = 26 * scale;
  rect(g, x, base - h, w, h, k.wall);
  rect(g, x + w - 6 * scale, base - h, 6 * scale, h, shift(k.wall, -1.2));
  for (let i = 0; i < w; i += 5 * scale) rect(g, x + i, base - h - 3 * scale, 3 * scale, 3 * scale, k.wall);
  rect(g, x + w / 2 - 6 * scale, base - h - 14 * scale, 12 * scale, 14 * scale, k.wall);
  rect(g, x + w / 2 - 8 * scale, base - h - 18 * scale, 16 * scale, 4 * scale, k.roof);
  rect(g, x + w / 2 - 1, base - h - 24 * scale, 1, 6 * scale, '#2a1a2a');
  rect(g, x + w / 2, base - h - 24 * scale, 4 * scale, 2 * scale, '#ff5d73');
  for (let i = 1; i < 4; i += 1) rect(g, x + (w * i) / 4 - scale, base - h / 2, 2 * scale, 3 * scale, '#ffd36b');
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
  } else castleSilhouette(g, wx + 64, wy + wh - 10, 2, k);
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
  const rx = 50;
  const ry = 24;
  // Face skin + brow around the eye.
  ellipse(g, cx, cy + 6, rx + 22, ry + 30, '#c8885a');
  ellipse(g, cx - 4, cy + 2, rx + 18, ry + 24, '#e0a070');
  dither(g, cx + 20, cy - 30, 50, 70, '#b07048', 0.3);
  rect(g, cx - rx - 6, cy - ry - 18, rx * 2 + 4, 7, '#4a2a1a');
  rect(g, cx - rx - 2, cy - ry - 18, rx * 2 - 6, 2, '#6a3a22');
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
      for (let k = 0; k < 6; k += 1) rect(g, vx + k, cy + Math.round(Math.sin(i + k) * 2), 1, 1, '#e08080');
    }
    // Iris tracks the hero.
    const ix = Math.round(cx + clamp(lookX, -1, 1) * 20);
    const ir = Math.min(18, Math.round(ry * lid));
    const rings = ['#4a1a1a', '#8a2a2a', '#c84a3a', '#e8803a', '#ffb050'];
    rings.forEach((col, i) => ellipse(g, ix, cy, ir - i * 2.4, Math.min(ir - i * 2.4, ry * lid - 1), col));
    for (let a = 0; a < 16; a += 1) {
      const ang = (a / 16) * Math.PI * 2;
      rect(g, ix + Math.round(Math.cos(ang) * ir * 0.7), cy + Math.round(Math.sin(ang) * ir * 0.6 * lid), 1, 1, '#5a1a10');
    }
    const pr = 6 + Math.round(Math.sin(t * 1.3) * 1.5);
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
  for (let x = -rx + 6; x <= rx - 6; x += 1) rect(g, cx + x, lowY - Math.round((x * x) / (rx * 6)), 1, 2, '#a85a3a');
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
      const bob = running ? -Math.abs(Math.round(Math.sin(t * 24) * 2)) : Math.sin(t * 2.4) > 0.7 ? -1 : 0;

      if (phase === 'workshop') {
        // Thimble anvil with a glowing part on top.
        const ax = 200;
        ellipse(g, ax, GROUND + 2, 26, 5, withAlpha('#000000', 0.45));
        rect(g, ax - 20, GROUND - 34, 40, 34, '#9aa0b8');
        rect(g, ax - 20, GROUND - 34, 40, 3, '#e0e4f0');
        rect(g, ax + 10, GROUND - 34, 10, 34, '#6a7090');
        for (let y = GROUND - 28; y < GROUND; y += 4)
          for (let x = ax - 18; x < ax + 18; x += 4) rect(g, x + ((y >> 2) % 2) * 2, y, 1, 1, '#5a6080');
        const heat = 0.5 + 0.5 * Math.sin(t * 8);
        rect(g, ax - 8, GROUND - 38, 16, 4, mix('#ff7a2a', '#ffe066', heat));
        glow(g, ax, GROUND - 38, 26, '#ff9a3a', 0.45 + heat * 0.2);
        if (f.t - forgeT < 0.5) glow(g, ax, GROUND - 40, 50, '#ffe066', 0.7 * (1 - (f.t - forgeT) * 2));
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
        const by = GROUND - 8 - h;
        ellipse(g, 250, GROUND + 2, 40 - h * 0.3, 6 - h * 0.04, withAlpha('#000000', 0.5));
        rect(g, 214, by - 120, 54, 110, '#3a2a3a');
        rect(g, 214, by - 120, 6, 110, '#5a4a5a');
        for (let y = by - 110; y < by - 20; y += 10) rect(g, 226, y, 30, 2, '#e8e0d0');
        rect(g, 200, by - 24, 96, 18, '#2a1a20');
        rect(g, 200, by - 24, 96, 3, '#5a4048');
        rect(g, 196, by - 8, 104, 8, '#141014');
        for (let x = 200; x < 296; x += 8) rect(g, x, by - 2, 4, 2, '#3a3038');
        // Combo + round track.
        const c = state.combat;
        for (let i = 0; i < c.maxRounds; i += 1) {
          rect(g, 150 + i * 10, 34, 8, 4, i < c.round ? '#ff5d73' : '#3a2440');
          if (i === c.round) glow(g, 154 + i * 10, 36, 8, '#ff5d73', 0.5);
        }
        if (c.combo > 0) tiny(g, `COMBO ×${c.combo}`, 150, 44, { color: '#ffe066', scale: 2 });
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
      if (running) for (let i = 0; i < 4; i += 1) rect(g, heroX - 20 - i * 9, GROUND - 14 - i * 3, 6, 1, withAlpha('#ffffff', 0.4));
      ellipse(g, heroX, GROUND + 1, 9, 2, withAlpha('#000000', 0.45));
      blit(g, hero(step as 0 | 1, phase === 'ended' && state.outcome === 'won' ? 'up' : 'down'), heroX + shake, GROUND + 1 + bob, {
        anchor: 'bc',
        tint: '#ff2040',
        tintAlpha: f.t - hurtT < 0.12 ? 0.7 : 0,
      });
      if (state.weapon) {
        const wx = heroX + 9;
        rect(g, wx, GROUND - 22 + bob, 1, 10, '#c8d0e8');
        rect(g, wx - 1, GROUND - 24 + bob, 3, 2, '#ffe066');
        glow(g, wx, GROUND - 20, 8, '#9fe4ff', 0.4);
      }

      if (phase === 'discovery') {
        const open = 1 - Math.max(0, Math.sin(t * 0.9 + 1) > 0.97 ? 1 : 0) * 0.95;
        const peek = easeOutBack(Math.min(1, (f.t - spotT) / 0.6));
        const ey = Math.round(70 - (1 - peek) * 80);
        drawEye(g, 270, ey, t, (heroX - 270) / 140, open);
      }

      if (phase === 'escape' && state.escape) {
        // A giant hand's shadow sweeps in.
        const e = state.escape;
        const reach = 1 - e.beatsLeft / Math.max(1, e.beatsLeft + e.progress + 1);
        const sx = 300 - reach * 120 + Math.sin(t * 2) * 8;
        ellipse(g, sx, GROUND + 2, 50, 8, withAlpha('#000000', 0.35 + 0.15 * Math.sin(t * 4)));
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
      for (let i = 0; i < 52; i += 1) {
        const done = i < state.week;
        rect(g, 8 + i * 3, 9, 2, i % 4 === 3 ? 6 : 4, done ? '#ff8a9a' : '#3a2440');
      }
      tiny(g, `W${state.week}/52`, 8 + 52 * 3 + 6, 9, { color: '#ffd0d8' });
      if (state.phase === 'briefing') {
        ['bastion', 'harvest', 'mirror'].forEach((id, i) => {
          const name = f.lang === 'zh' ? ZH_NAMES[id]! : f.term(ZH_NAMES[id]!);
          const x = 166 + i * 68;
          const focus = f.focus?.id === `target:${id}`;
          const w = textWidth(name) + 10;
          rect(g, x - w / 2, 122, w, 15, withAlpha('#05030c', focus ? 0.9 : 0.6));
          drawText(g, name, x, 123, { color: focus ? '#ffe066' : '#ffe0e8', align: 'center', outline: null });
          if (focus) glow(g, x, 92, 40, '#ffe066', 0.25 + 0.1 * Math.sin(t * 6));
        });
      } else if (state.target) {
        const name = f.lang === 'zh' ? ZH_NAMES[state.target]! : f.term(ZH_NAMES[state.target]!);
        const w = textWidth(name) + 12;
        rect(g, 230 - w / 2, 126, w, 15, withAlpha('#05030c', 0.7));
        rect(g, 230 - w / 2, 140, w, 1, '#ff5d73');
        drawText(g, name, 230, 127, { color: '#ffe0e8', align: 'center', outline: null });
      }
      // Exposure creeps in as a red edge.
      if (state.suspicion >= 5) {
        const a = (state.suspicion - 4) / 6;
        for (let y = 0; y < VH; y += 2)
          for (let x = 0; x < VW; x += 2) {
            const edge = Math.min(x, VW - x, y * 1.6, (VH - y) * 1.6) / 40;
            if (edge < 1 && bayer(x >> 1, y >> 1) > edge + 0.4 - a * 0.4) rect(g, x, y, 2, 2, withAlpha('#ff1030', 0.25));
          }
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
      if (o.action.id.startsWith('strike') || (s.combat && prev.combat && s.combat.enemy < prev.combat.enemy)) {
        hitT = f.t;
        const heavy = o.action.id === 'strike:heavy';
        f.fx.hit(230, GROUND - 30, heavy ? 'heavy' : 'medium', 0, ['#ffffff', '#ffe066', '#ff9a3a']);
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
        const dir = o.action.id.endsWith('left') ? Math.PI : o.action.id.endsWith('right') ? 0 : Math.PI / 2;
        f.fx.dust(110, GROUND, '#c8a080', 10);
        f.fx.kick(Math.cos(dir) * 2, 0);
        f.cue('whoosh');
      }
      if (s.control > prev.control || s.influence > prev.influence) {
        f.fx.burst(230, 90, { count: 26, colors: ['#ff5d73', '#ffe066', '#ffffff'], speed: 90, gravity: 40 });
        f.cue('good');
      }
      if (s.coins > prev.coins) f.cue('coin');
      void hash01;
    },
  };
}

const module: GameModule<TinyState> = { definition, createScene };
export default module;
