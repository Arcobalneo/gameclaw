import { definition } from '@games/claw-sum/src/definition';
import { budgetOf, type SumState } from '@games/claw-sum/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  type Ctx,
  ctx2d,
  disc,
  dither,
  ellipse,
  hash01,
  makeCanvas,
  mix,
  rect,
  VH,
  VW,
  withAlpha,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, pips, plate, shadow } from '../gfx/world';

const KETTLE_X = 86;
const KETTLE_Y = 58;
const KETTLE_W = 128;
const KETTLE_H = 78;

const BOTTLE: SpriteDef = {
  rows: ['..nn..', '.nnnn.', '.llll.', '.llll.', '..dd..'],
  pal: { n: '#d8c8e8', l: '#9a68d8', d: '#4a2868' },
};

const MEDAL: SpriteDef = {
  rows: ['..gg..', '.gGGg.', 'gGwwGg', '.gGGg.', '..rr..', '.rrrr.'],
  pal: { g: '#e8b030', G: '#ffe066', w: '#fff6dc', r: '#c44838' },
};

const LADLE: SpriteDef = {
  rows: ['......hh', '.....hh.', '....ss..', '...ss...', '..ss....', '.oo.....'],
  pal: { h: '#fff6dc', s: '#8a6848', o: '#c49862' },
};

let roomCache: HTMLCanvasElement | null = null;

function room(): HTMLCanvasElement {
  if (roomCache) return roomCache;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#4a2060', '#2a143c', '#160c22', '#0c0814'], 0, 150, 12);
  for (let i = 0; i < 28; i += 1) {
    const x = hash01(i, 2) * VW;
    const y = 8 + hash01(i, 3) * 40;
    ellipse(g, x, y, 10 + hash01(i, 4) * 16, 4, mix('#3a1848', '#6a3080', hash01(i, 5)));
  }
  rect(g, 0, 148, VW, 68, '#1a1020');
  for (let i = 0; i < 16; i += 1) {
    rect(g, i * 24, 156, 22, 8, i % 2 ? '#241428' : '#2c1834');
    rect(g, i * 24, 168, 22, 8, i % 2 ? '#2c1834' : '#241428');
  }
  dither(g, 0, 148, VW, 68, '#c49aff', 0.04);
  rect(g, 18, 36, 52, 100, '#2a1838');
  rect(g, 22, 40, 44, 6, '#4a3060');
  for (let row = 0; row < 3; row += 1) {
    rect(g, 22, 52 + row * 26, 44, 3, '#6a4878');
    for (let n = 0; n < 3; n += 1) ellipse(g, 30 + n * 14, 62 + row * 26, 4, 6, '#3a2050');
  }
  rect(g, 250, 28, 118, 112, '#241430');
  rect(g, 254, 32, 110, 70, '#120818');
  rect(g, 254, 32, 110, 4, '#6a4878');
  for (let i = 0; i < 5; i += 1) rect(g, 262 + i * 20, 108, 12, 24, '#3a2848');
  ellipse(g, 150, 168, 78, 12, '#120810');
  rect(g, 70, 18, 90, 28, '#120818');
  rect(g, 74, 22, 82, 20, '#2a1840');
  for (let i = 0; i < 6; i += 1) rect(g, 78 + i * 13, 26, 8, 2, '#6a88c0');
  ellipse(g, 140, 30, 6, 6, '#fff6dc');
  rect(g, 200, 70, 8, 70, '#4a3860');
  rect(g, 200, 70, 40, 6, '#6a5878');
  rect(g, 232, 70, 6, 16, '#6a5878');
  for (let i = 0; i < 5; i += 1) rect(g, 120 + i * 14, 176, 10, 4, '#3a2844');
  roomCache = c;
  return c;
}

function steam(g: Ctx, t: number, boil: boolean): void {
  const n = boil ? 8 : 4;
  for (let i = 0; i < n; i += 1) {
    const life = (t * (boil ? 0.7 : 0.35) + i / n) % 1;
    const x = 150 + Math.round(Math.sin(t * 2 + i) * 18);
    const y = 52 - Math.round(life * 28);
    ellipse(g, x, y, 3 + life * 4, 2 + life * 2, withAlpha('#ffffff', 0.35 * (1 - life)));
  }
}

function flames(g: Ctx, t: number, hot: boolean): void {
  for (let i = 0; i < 7; i += 1) {
    const h = 5 + Math.round(Math.sin(t * (hot ? 10 : 6) + i) * (hot ? 5 : 3));
    const color = hot ? (i % 2 ? '#ffd27a' : '#ff5a3a') : i % 2 ? '#ffb45a' : '#ff6a2a';
    rect(g, 98 + i * 16, 146 - h, 7, h, color);
    rect(g, 100 + i * 16, 146 - h, 3, 2, '#fff6dc');
  }
}

function kettleBody(g: Ctx, fill: number, boil: boolean, t: number): void {
  rect(g, KETTLE_X, KETTLE_Y, KETTLE_W, 10, '#5a4068');
  rect(g, KETTLE_X + 8, KETTLE_Y + 8, KETTLE_W - 16, KETTLE_H, '#3a2848');
  rect(g, KETTLE_X + 14, KETTLE_Y + 14, KETTLE_W - 28, KETTLE_H - 18, '#1a1024');
  const inner = KETTLE_H - 26;
  const h = Math.round(inner * Math.min(1, fill));
  const top = KETTLE_Y + 14 + (inner - h);
  rect(g, KETTLE_X + 16, top, KETTLE_W - 32, h, boil ? '#ff6a8a' : '#7a48d8');
  if (h > 4) rect(g, KETTLE_X + 16, top, KETTLE_W - 32, 3, boil ? '#ffd0dc' : '#d0b0ff');
  for (let i = 0; i < 6; i += 1) {
    const x = KETTLE_X + 28 + ((i * 16 + Math.round(t * 16)) % (KETTLE_W - 52));
    const y = top + 6 + Math.round((t * 12 + i * 7) % Math.max(6, h - 8));
    disc(g, x, y, 2, withAlpha('#ffffff', boil ? 0.85 : 0.55));
  }
  rect(g, KETTLE_X - 10, KETTLE_Y + 28, 12, 8, '#6a5878');
  rect(g, KETTLE_X + KETTLE_W - 2, KETTLE_Y + 36, 18, 6, '#6a5878');
  ellipse(g, KETTLE_X + KETTLE_W + 16, KETTLE_Y + 48, 8, 10, '#4a3860');
}

function lever(g: Ctx, t: number, since: number, hot: boolean): void {
  const swing = Math.round(Math.sin(Math.min(1, since) * Math.PI) * 8);
  rect(g, 292, 118, 8, 28, '#4a3828');
  rect(g, 270 + swing, 112, 36, 6, hot ? '#ffd27a' : '#c49862');
  ellipse(g, 304 + swing, 114, 5, 5, '#fff6dc');
  glow(g, 304 + swing, 114, 8, '#ffc24a', 0.2 + 0.08 * Math.sin(t * 4));
}

function createScene(): GameScene<SumState> {
  return {
    grade(): Grade {
      return { top: '#e0b0ff', bottom: '#08040c', bloom: 0.55, vignette: 0.78 };
    },
    anchor: () => ({ x: 150, y: 96 }),
    hits(_state, actions): HitRegion[] {
      return actions.slice(0, 4).map((action, index) => ({
        x: 12 + index * 94,
        y: 168,
        w: 88,
        h: 42,
        actionId: action.id,
      }));
    },
    draw(f) {
      const { g, t, state, since } = f;
      g.drawImage(room(), 0, 0);
      const ratio = state.value / Math.max(1, state.target);
      const boil = state.value > state.target;
      const matched = state.value === state.target;
      kettleBody(g, Math.max(0.08, Math.min(1.15, ratio)), boil, t);
      steam(g, t, boil || matched);
      flames(g, t, boil);
      if (boil) glow(g, 150, 70, 28, '#ff6a8a', 0.28 + 0.12 * Math.sin(t * 8));
      const bottle = buildSprite(BOTTLE, {}, { rim: '#fff6dc' });
      for (let i = 0; i < 3; i += 1) {
        const bob = Math.round(Math.sin(t * 1.6 + i) * 1);
        blit(g, bottle, 36 + i * 14, 70 + (i % 2) * 22 + bob, { scale: 2, anchor: 'bc' });
      }
      const medal = buildSprite(MEDAL, {}, { rim: '#fff6dc' });
      for (let i = 0; i < state.stages; i += 1) {
        const won = i < state.exacts;
        blit(g, medal, 270 + (i % 4) * 22, 48 + Math.floor(i / 4) * 22, {
          scale: 2,
          anchor: 'c',
          alpha: won ? 1 : 0.28,
        });
      }
      drawText(g, String(state.value), 150, 78, { color: '#fff4d6', align: 'center', scale: 2 });
      const now = say(f, '现在');
      const goal = say(f, '目标');
      if (now) drawText(g, now, 150, 100, { color: '#d0b0ff', align: 'center', outline: null });
      glow(g, 320, 78, 18, matched ? '#7ee0a0' : '#ffc24a', 0.4);
      ellipse(g, 320, 82, 16, 16, '#1a1020');
      ellipse(g, 320, 82, 13, 13, matched ? '#245038' : '#3a2810');
      drawText(g, String(state.target), 320, 72, { color: '#fff4d6', align: 'center', scale: 2 });
      if (goal) drawText(g, goal, 320, 96, { color: '#ffe066', align: 'center' });
      const cook = buildSprite(SHRIMP, {}, { rim: '#ffffff' });
      const bob = Math.round(Math.sin(t * 3) * 1);
      shadow(g, 214, 146, 16);
      blit(g, cook, 214, 142 + bob, { scale: 2, anchor: 'bc' });
      blit(g, buildSprite(LADLE), 228, 128 + Math.round(Math.sin(t * 4) * 2), {
        scale: 2,
        anchor: 'c',
      });
      lever(g, t, since, boil);
      for (let i = 0; i < state.timeline.length && i < 3; i += 1) {
        const mark = state.timeline[i]?.includes('正好') ? '#7ee0a0' : '#ff8aa0';
        rect(g, 262, 118 + i * 8, 8, 6, mark);
        rect(g, 272, 120 + i * 8, 28, 2, '#3a2848');
      }
      f.actions.slice(0, 4).forEach((action, index) => {
        const x = 12 + index * 94;
        const on = f.focus?.id === action.id;
        rect(g, x, 168, 88, 40, on ? '#5a2878' : '#241428');
        rect(g, x, 168, 88, 3, action.risk === 'high' ? '#ff6a8a' : '#c49aff');
        const label = say(f, action.label);
        if (label) drawText(g, label, x + 44, 180, { color: '#fff4d6', align: 'center' });
      });
      if (f.focus?.detail) {
        const detail = say(f, f.focus.detail);
        if (detail) plate(g, detail, 192, 150, '#fff4d6', 210);
      }
    },
    hud(f) {
      const { g, t, state } = f;
      const pulls = say(f, '拉杆');
      const exact = say(f, '对准');
      const miss = say(f, '落空');
      const budget = budgetOf(state);
      if (pulls) drawText(g, pulls, 8, 6, { color: '#c49aff' });
      pips(g, pulls ? 48 : 8, 8, budget, state.pulls, '#c49aff', state.pulls, t);
      if (exact) drawText(g, exact, 8, 22, { color: '#7ee0a0' });
      pips(g, exact ? 48 : 8, 24, state.stages, state.exacts, '#7ee0a0');
      if (miss) drawText(g, miss, 200, 6, { color: '#ff8aa0' });
      pips(g, miss ? 248 : 200, 8, state.missLimit, state.misses, '#ff6a8a');
      drawText(g, `${state.stage}/${state.stages}`, 360, 6, {
        color: '#fff4d6',
        align: 'right',
      });
    },
    react(f, outcome) {
      const exact = outcome.result.log.some((line) => line.includes('正好'));
      const miss = outcome.result.log.some((line) => line.includes('没对准'));
      if (exact) {
        f.fx.flash('#7ee0a0', 0.35);
        f.fx.burst(150, 90, {
          count: 28,
          colors: ['#7ee0a0', '#fff6dc', '#ffe066'],
          speed: 70,
          life: 0.7,
        });
        f.cue('coin');
      } else if (miss) {
        f.fx.addTrauma(0.45);
        f.fx.hit(150, 90, 'heavy', Math.PI / 2, ['#ff6a8a', '#ffffff']);
        f.fx.flash('#ff6a8a', 0.25);
        f.cue('bad');
      } else {
        f.fx.splash(150, 110, '#d0b0ff', 12);
        f.cue('hit');
      }
    },
  };
}

const module: GameModule<SumState> = { definition, createScene };
export default module;
