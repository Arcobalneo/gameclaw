import { definition } from '@games/claw-berth/src/definition';
import type { BerthState, Docked } from '@games/claw-berth/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky, stars } from '../gfx/backdrop';
import {
  bar,
  type Ctx,
  ctx2d,
  dither,
  ellipse,
  hash01,
  makeCanvas,
  mix,
  rect,
  VH,
  VW,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { tiny } from '../gfx/tiny';
import { blit, kelp, pips, plate, shadow } from '../gfx/world';

const SLIPS = [28, 100, 172, 244];
const PIER = 158;

const HULL: SpriteDef = {
  rows: [
    '....mm......',
    '...mhhhm....',
    '..mbbbbbm...',
    '.mbbbbbbbm..',
    'mbbbbbbbbbm.',
    'dddddddddddd',
    '.dwwwwwwwwd.',
    '..dddddddd..',
  ],
  pal: {
    m: '#6a4830',
    h: '#fff6dc',
    b: '#c49862',
    d: '#5a3420',
    w: '#efe0c8',
  },
};

const HULL_HOT: SpriteDef = {
  ...HULL,
  pal: { ...HULL.pal, b: '#e07058', d: '#8a2830', w: '#ffd0c0' },
};

let harbor: HTMLCanvasElement | null = null;

function board(): HTMLCanvasElement {
  if (harbor) return harbor;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#0a1830', '#081428', '#06101c', '#040c14'], 0, VH, 12);
  stars(g, 0, 4, 40, 70, '#d8e8ff');
  moon(g, 330, 28, 9, '#fff6dc', '#9ec8ff');
  for (let i = 0; i < 40; i += 1) {
    const x = hash01(i, 2) * VW;
    const y = 70 + hash01(i, 3) * 70;
    ellipse(g, x, y, 8 + hash01(i, 4) * 18, 2, mix('#0c2848', '#163858', hash01(i, 5)));
  }
  rect(g, 0, PIER, VW, VH - PIER, '#1a3044');
  rect(g, 0, PIER, VW, 3, '#3a5870');
  dither(g, 0, PIER + 3, VW, VH - PIER - 3, '#0a1824', 0.18);
  for (const x of SLIPS) {
    rect(g, x + 4, 92, 4, PIER - 92, '#2a2018');
    rect(g, x + 52, 92, 4, PIER - 92, '#2a2018');
    rect(g, x + 4, 96, 52, 3, '#4a3828');
  }
  for (let i = 0; i < 18; i += 1) rect(g, 8 + i * 22, PIER + 8, 16, 3, '#243848');
  harbor = c;
  return c;
}

function hullOf(hot: boolean): HTMLCanvasElement {
  return buildSprite(hot ? HULL_HOT : HULL, {}, { rim: '#fff6dc' });
}

function shipBob(t: number, phase: number): number {
  return Math.round(Math.sin(t * 1.4 + phase) * 2);
}

function drawShip(
  g: Ctx,
  x: number,
  y: number,
  hot: boolean,
  t: number,
  phase: number,
  scale = 2,
): void {
  const sprite = hullOf(hot);
  shadow(g, x, y + 4, 18 * (scale / 2));
  blit(g, sprite, x, y + shipBob(t, phase), { scale, anchor: 'bc' });
}

function wake(g: Ctx, t: number): void {
  for (let i = 0; i < 14; i += 1) {
    const x = Math.round((i * 29 + t * 10) % (VW + 20)) - 10;
    const y = 108 + (i % 5) * 9;
    const w = 6 + (i % 3) * 3;
    rect(g, x, y, w, 1, i % 2 ? '#163858' : '#2a6898');
  }
}

function slipLanterns(g: Ctx, t: number): void {
  for (const x of SLIPS) {
    rect(g, x + 28, 78, 2, 14, '#3a2818');
    const flicker = 0.25 + 0.08 * Math.sin(t * 4 + x);
    ellipse(g, x + 29, 76, 5, 4, '#ffc24a');
    ellipse(g, x + 28, 75, 2, 2, '#fff6dc');
    g.globalAlpha = flicker;
    ellipse(g, x + 29, 76, 9, 7, '#ff9a3a');
    g.globalAlpha = 1;
  }
}

function hazardRope(g: Ctx, state: BerthState): void {
  for (let i = 0; i < state.berths.length - 1; i += 1) {
    const a = state.berths[i];
    const b = state.berths[i + 1];
    if (!a?.hazard || !b?.hazard) continue;
    const x0 = (SLIPS[i] ?? 0) + 30;
    const x1 = (SLIPS[i + 1] ?? 0) + 30;
    for (let x = x0; x <= x1; x += 2) rect(g, x, 100 + ((x / 2) % 2), 2, 1, '#ff5d73');
  }
}

function createScene(): GameScene<BerthState> {
  return {
    grade(): Grade {
      return { top: '#102848', bottom: '#040810', bloom: 0.42, vignette: 0.78 };
    },
    anchor: (state) => {
      const open = state.berths.findIndex((berth) => berth);
      const x = SLIPS[open >= 0 ? open : 0] ?? 28;
      return { x: x + 28, y: 120 };
    },
    hits(_state, actions): HitRegion[] {
      return actions
        .filter(
          (action) =>
            action.id.startsWith('dock:') || action.id.startsWith('tug:') || action.id === 'wait',
        )
        .map((action) => {
          if (action.id === 'wait') return { x: 300, y: 168, w: 72, h: 40, actionId: action.id };
          const index = Number(action.id.slice(action.id.indexOf(':') + 1));
          const x = SLIPS[index] ?? 28;
          return { x, y: 96, w: 60, h: 62, actionId: action.id };
        });
    },
    draw(f) {
      const { g, state, t, focus } = f;
      g.drawImage(board(), 0, 0);
      wake(g, t);
      slipLanterns(g, t);
      for (let i = 0; i < 3; i += 1) {
        const x = Math.round((20 + i * 140 + t * 14) % 420);
        const y = 40 + (i % 2) * 8 + Math.round(Math.sin(t * 2 + i) * 2);
        rect(g, x, y, 7, 2, '#e8f4ff');
        rect(g, x + 7, y, 3, 1, '#ffffff');
      }
      ellipse(g, 300, 48, 5, 5, '#ff5d73');
      rect(g, 299, 53, 2, 10, '#d8e8ff');
      kelp(g, 12, PIER - 2, 22, t, '#1a6048');
      kelp(g, 370, PIER - 2, 18, t + 1, '#145040');
      state.depths.forEach((depth, index) => {
        const x = SLIPS[index] ?? 28;
        const water = 118 - depth * 8;
        rect(g, x + 8, water, 44, PIER - water, mix('#0c3058', '#1a5888', depth / 4));
        rect(g, x + 8, water, 44, 2, '#7ec8e8');
        for (let mark = 1; mark <= depth; mark += 1) {
          rect(g, x + 58, PIER - 8 - mark * 10, 6, 2, '#9ec8ff');
        }
        const berth = state.berths[index];
        if (berth) drawDocked(g, x + 30, water + 8, berth, t, index);
        const aimed =
          focus?.id === `dock:${index}` || focus?.id === `tug:${index}` ? '#ffe066' : '';
        if (aimed) rect(g, x + 6, 94, 48, 2, aimed);
      });
      hazardRope(g, state);
      drawShip(g, 332, 78, state.current.hazard, t, 0.2, 2);
      drawShip(g, 360, 52, state.next.hazard, t, 1.4, 1);
      const wait = say(f, '等待');
      if (wait && focus?.id === 'wait') plate(g, wait, 336, 172, '#fff4d6', 64);
    },
    hud(f) {
      const { g, state, t } = f;
      const cargo = say(f, '货');
      const tugs = say(f, '拖');
      const anger = say(f, '怒');
      if (cargo) drawText(g, cargo, 8, 6, { color: '#fff4d6', outline: '#07040f' });
      bar(g, 40, 8, 72, 6, state.cargo / Math.max(1, state.quota), '#ffe066', '#1a1408');
      if (tugs) drawText(g, tugs, 8, 20, { color: '#9fe4ff', outline: '#07040f' });
      pips(g, tugs ? 36 : 8, 22, Math.max(state.tugs, 1), state.tugs, '#5ad1ff', -1, t);
      if (anger) drawText(g, anger, 8, 34, { color: '#ff8a9a', outline: '#07040f' });
      pips(g, anger ? 36 : 8, 36, state.angryLimit, state.angry, '#ff5d73', -1, t);
      bar(g, 300, 92, 70, 6, state.current.patience / 5, '#7cf0a0', '#102018');
      tiny(g, String(state.current.draft), 332, 64, { color: '#fff6dc', align: 'center' });
    },
    react(f, outcome) {
      const line = outcome.result.log.join(' ');
      const index = Number(outcome.action.id.slice(outcome.action.id.indexOf(':') + 1));
      const x = (SLIPS[index] ?? 300) + 28;
      if (line.includes('靠上')) {
        f.fx.splash(x, 130, '#9fe4ff', 14);
        f.fx.hit(x, 124, 'light', -Math.PI / 2, ['#ffffff', '#9fe4ff']);
        f.cue('splash');
      }
      if (line.includes('装完')) {
        f.fx.burst(x, 110, { count: 16, colors: ['#ffe066', '#ffffff'], speed: 80 });
        f.cue('coin');
      }
      if (line.includes('怒了') || line.includes('贴')) {
        f.fx.addTrauma(0.4);
        f.fx.flash('#ff5d73', 0.28);
        f.cue('bad');
      }
    },
  };
}

function drawDocked(g: Ctx, x: number, y: number, berth: Docked, t: number, index: number): void {
  drawShip(g, x, y, berth.hazard, t, index, 2);
  pips(g, x - 12, y + 8, 4, berth.left, '#7cf0a0', -1, t);
}

const module: GameModule<BerthState> = { definition, createScene };
export default module;
