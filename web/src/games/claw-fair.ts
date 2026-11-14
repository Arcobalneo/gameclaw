import { definition } from '@games/claw-fair/src/definition';
import type { FairState } from '@games/claw-fair/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  bar,
  type Ctx,
  ctx2d,
  dither,
  ellipse,
  hash01,
  makeCanvas,
  rect,
  VH,
  VW,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, PERSON, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, pips, plate, shadow } from '../gfx/world';

const STALL_X = 36;
const BUTTONS = [24, 112, 200, 288];

const CRATE: SpriteDef = {
  rows: ['bbbbbb', 'bwwwdb', 'bwwddb', 'bddddb', 'bbbbbb'],
  pal: { b: '#8a5a30', w: '#e8c898', d: '#5a3418' },
};

const COIN: SpriteDef = {
  rows: ['..yy..', '.yYYy.', 'yYwwYy', '.yYYy.', '..yy..'],
  pal: { y: '#e8b030', Y: '#ffe066', w: '#fff6dc' },
};

const AWNING: SpriteDef = {
  rows: ['rrrrrrrrrrrr', 'ryryryryryry', 'rrrrrrrrrrrr', '.d.d.d.d.d.d'],
  pal: { r: '#c44838', y: '#ffe066', d: '#6a2820' },
};

let market: HTMLCanvasElement | null = null;

function board(): HTMLCanvasElement {
  if (market) return market;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#f0c090', '#e09868', '#c07048', '#6a3828'], 0, 90, 8);
  rect(g, 0, 90, VW, 40, '#c49868');
  dither(g, 0, 90, VW, 40, '#8a6840', 0.08);
  rect(g, 0, 128, VW, VH - 128, '#6a4030');
  rect(g, 0, 128, VW, 3, '#8a5840');
  for (let i = 0; i < 16; i += 1) {
    rect(g, 4 + i * 24, 136, 18, 4, hash01(i, 2) > 0.5 ? '#5a3424' : '#7a4c34');
  }
  rect(g, STALL_X, 70, 150, 58, '#f4e4c8');
  rect(g, STALL_X, 70, 150, 4, '#d8c4a0');
  rect(g, STALL_X, 124, 150, 4, '#8a6848');
  for (let i = 0; i < 5; i += 1) rect(g, STALL_X + 8 + i * 28, 78, 2, 42, '#e0d0b0');
  ellipse(g, 300, 168, 50, 10, '#3a2018');
  market = c;
  return c;
}

function coins(g: Ctx, x: number, y: number, n: number): void {
  const sprite = buildSprite(COIN, {}, { rim: '#fff6dc' });
  const count = Math.max(0, Math.min(6, n));
  for (let i = 0; i < count; i += 1)
    blit(g, sprite, x + (i % 3) * 10, y + Math.floor(i / 3) * 8, { scale: 2, anchor: 'c' });
}

function bunting(g: Ctx, t: number): void {
  for (let i = 0; i < 10; i += 1) {
    const x = 20 + i * 36;
    const y = 18 + Math.round(Math.sin(t * 1.5 + i) * 2);
    const color = i % 2 ? '#c44838' : '#ffe066';
    rect(g, x, y, 16, 10, color);
    rect(g, x, y, 16, 2, '#fff6dc');
    rect(g, x + 7, y + 10, 2, 4, '#6a2818');
  }
  rect(g, 16, 16, 352, 1, '#6a2818');
}

function priceMark(g: Ctx, yesterday: number, purse: number): void {
  const up = purse > yesterday;
  const color = up ? '#7cf0a0' : purse < yesterday ? '#ff8a6a' : '#ffe066';
  rect(g, 250, 96, 18, 2, color);
  if (up) {
    rect(g, 264, 92, 2, 6, color);
    rect(g, 262, 92, 6, 2, color);
  } else if (purse < yesterday) {
    rect(g, 264, 96, 2, 6, color);
    rect(g, 262, 100, 6, 2, color);
  }
}

function createScene(): GameScene<FairState> {
  return {
    grade(): Grade {
      return { top: '#ffd0a0', bottom: '#2a1008', bloom: 0.36, vignette: 0.72, strength: 0.2 };
    },
    anchor: () => ({ x: 250, y: 100 }),
    hits(_state, actions): HitRegion[] {
      return actions.slice(0, 4).map((action, index) => ({
        x: BUTTONS[index] ?? 24,
        y: 168,
        w: 80,
        h: 40,
        actionId: action.id,
      }));
    },
    draw(f) {
      const { g, state, t, focus } = f;
      g.drawImage(board(), 0, 0);
      bunting(g, t);
      priceMark(g, state.yesterday, state.purse);
      const awning = buildSprite(AWNING, {}, { rim: '#fff6dc' });
      blit(g, awning, STALL_X + 75, 62 + Math.round(Math.sin(t * 1.2) * 1), {
        scale: 2,
        anchor: 'bc',
      });
      const crate = buildSprite(CRATE);
      for (let i = 0; i < Math.min(state.stock, 6); i += 1) {
        blit(g, crate, STALL_X + 18 + (i % 3) * 22, 108 + Math.floor(i / 3) * 14, {
          scale: 2,
          anchor: 'bc',
        });
      }
      drawText(g, String(state.yesterday), STALL_X + 118, 86, {
        color: '#6a2818',
        align: 'center',
        scale: 2,
        outline: null,
      });
      const yest = say(f, '昨');
      if (yest)
        drawText(g, yest, STALL_X + 118, 106, {
          color: '#8a4030',
          align: 'center',
          outline: null,
        });
      const buyer = buildSprite(PERSON, {}, { rim: '#ffffff' });
      const bob = Math.round(Math.sin(t * 2) * 1);
      shadow(g, 286, 124, 16);
      blit(g, buyer, 286, 118 + bob, { scale: 3, anchor: 'bc' });
      glow(g, 330, 78, 16, '#ffe066', 0.28 + 0.06 * Math.sin(t * 3));
      coins(g, 318, 78, state.purse);
      const purse = say(f, '袋');
      if (purse) drawText(g, purse, 348, 64, { color: '#fff4d6', align: 'center' });
      drawText(g, String(state.purse), 348, 82, { color: '#fff6dc', align: 'center', scale: 2 });
      f.actions.slice(0, 4).forEach((action, index) => {
        const x = BUTTONS[index] ?? 24;
        const hot = focus?.id === action.id;
        rect(g, x, 168, 80, 36, hot ? '#c44838' : '#8a3828');
        rect(g, x, 168, 80, 3, hot ? '#ffe066' : '#e8a070');
        const label = say(f, action.label);
        if (label)
          drawText(g, label, x + 40, 178, {
            color: '#fff4d6',
            align: 'center',
            outline: '#3a1008',
          });
      });
      if (focus) {
        const detail = say(f, focus.detail ?? '');
        if (detail) plate(g, detail, 192, 142, '#fff4d6', 220);
      }
    },
    hud(f) {
      const { g, state, t } = f;
      const coinsLabel = say(f, '钱');
      const stock = say(f, '货');
      const walks = say(f, '走');
      if (coinsLabel) drawText(g, coinsLabel, 8, 6, { color: '#ffe066' });
      bar(g, 40, 8, 80, 6, state.coins / Math.max(1, state.quota), '#ffe066', '#3a2010');
      if (stock) drawText(g, `${stock} ${state.stock}`, 8, 20, { color: '#e8c898' });
      if (walks) pips(g, 200, 8, state.walkLimit, state.walkaways, '#ff8a6a', -1, t);
      drawText(g, `${state.day}/${state.days}`, 376, 6, { color: '#fff4d6', align: 'right' });
    },
    react(f, outcome) {
      const line = outcome.result.log.join(' ');
      if (line.includes('卖出')) {
        f.fx.burst(286, 90, { count: 22, colors: ['#ffe066', '#ffffff'], speed: 100 });
        f.fx.flash('#fff6c0', 0.22);
        f.cue('coin');
      } else if (line.includes('走了')) {
        f.fx.addTrauma(0.35);
        f.fx.hit(286, 100, 'medium', Math.PI, ['#ff8a8a', '#ffffff']);
        f.cue('bad');
      } else if (line.includes('进了货')) {
        f.fx.burst(80, 100, { count: 12, colors: ['#e8c898', '#8a5a30'], speed: 60 });
        f.cue('land');
      }
    },
  };
}

const module: GameModule<FairState> = { definition, createScene };
export default module;
