import { definition } from '@games/claw-count/src/definition';
import type { CountState } from '@games/claw-count/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, hash01, makeCanvas, rect, VH, VW, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP, SHRIMP_WALK, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, pips, shadow } from '../gfx/world';

const PLANK: SpriteDef = {
  rows: [
    'wwwwwwwwwwwwwwww',
    'wddddddddddddddw',
    'wddwddddddwddddw',
    'wddddddddddddddw',
    'bbbbbbbbbbbbbbbb',
  ],
  pal: { w: '#fff6dc', d: '#e8d0a0', b: '#6a4a2a' },
};

const SUNK: SpriteDef = {
  rows: ['................', '..wwww....wwww..', 'wwwwwwwwwwwwwwww', '.bbbbbbbbbbbbbb.'],
  pal: { w: '#7ec8ff', b: '#1a4060' },
};

const MAGNET: SpriteDef = {
  rows: ['rr.....rr', 'rr.....rr', 'r.......r', 'r.......r', '.rrrrrrr.', '..rrrrr..', '...rrr...'],
  pal: { r: '#ff5d73' },
};

const DIAL: SpriteDef = {
  rows: ['gggggggg', 'gwwwwwwg', 'gwwwwwwg', 'gwwwwwwg', 'gwwwwwwg', 'gggggggg'],
  pal: { g: '#c4a060', w: '#1a140c' },
};

let night: HTMLCanvasElement | null = null;

/** A counted pier: posts, a far hull, and a dark channel. Painted once. */
function bridge(): HTMLCanvasElement {
  if (night) return night;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#243860', '#141c38', '#0c1018'], 0, VH, 10);
  rect(g, 0, 34, VW, 1, '#3a2818');
  for (let x = 18; x < VW; x += 26) {
    rect(g, x, 34, 1, 8, '#3a2818');
    rect(g, x - 4, 42, 10, 8, x % 52 === 18 ? '#ffc24a' : '#c4483a');
    rect(g, x - 2, 44, 6, 3, '#fff6dc');
  }
  rect(g, 248, 58, 96, 40, '#1a2438');
  rect(g, 248, 58, 96, 4, '#c4a888');
  rect(g, 260, 70, 18, 14, '#ffc24a');
  rect(g, 288, 70, 18, 14, '#7ec8ff');
  rect(g, 316, 70, 12, 14, '#3a2818');
  rect(g, 286, 46, 4, 14, '#3a2818');
  rect(g, 278, 42, 20, 6, '#e8d0a0');
  for (let x = 12; x < VW; x += 22) {
    rect(g, x, 168, 4, 48, '#1a140c');
    rect(g, x - 3, 206, 10, 4, '#3a2818');
  }
  rect(g, 0, 174, VW, 42, '#14283c');
  rect(g, 0, 174, VW, 3, '#5aa0c8');
  for (let i = 0; i < 28; i += 1) {
    rect(g, hash01(i, 6) * VW, 182 + hash01(i, 7) * 24, 8, 2, '#3a6888');
  }
  night = c;
  return c;
}

function createScene(): GameScene<CountState> {
  return {
    grade(): Grade {
      return { top: '#243050', bottom: '#0c1018', bloom: 0.48, vignette: 0.84 };
    },
    anchor: () => ({ x: 180, y: 130 }),
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const regions: HitRegion[] = [];
      const step = actions.find((action) => action.id === 'step');
      if (step) regions.push({ x: 142, y: 184, w: 100, h: 28, actionId: 'step' });
      const magnet = actions.find((action) => action.id === 'magnet');
      if (magnet) regions.push({ x: 8, y: 148, w: 56, h: 48, actionId: 'magnet' });
      actions
        .filter((action) => action.id.startsWith('set:'))
        .forEach((action, index) => {
          regions.push({ x: 16 + index * 44, y: 16, w: 36, h: 36, actionId: action.id });
        });
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(bridge(), 0, 0);
      stars(g, t, 2, 6, 52);
      moon(g, 330, 22, 9, '#fff6dc', '#9eb4ff');
      for (let x = 18; x < VW; x += 26) {
        glow(g, x, 46, 7, '#ffc24a', 0.2 + 0.25 * Math.sin(t * 7 + x));
      }
      const boatX = 268 + Math.round(Math.sin(t * 0.6) * 12);
      const boatY = 186 + Math.round(Math.sin(t * 1.4) * 1);
      rect(g, boatX, boatY, 36, 6, '#6a4a2a');
      rect(g, boatX + 4, boatY - 8, 16, 8, '#e8d0a0');
      rect(g, boatX + 18, boatY - 14, 2, 10, '#3a2414');
      for (let i = 0; i < 7; i += 1) {
        rect(g, 322, 180 + i * 4, 16 - i, 2, withAlpha('#fff6dc', 0.28));
      }
      for (let x = 0; x < VW; x += 12) {
        const y = 172 + Math.round(Math.sin(t * 1.5 + x * 0.06) * 2);
        rect(g, x, y, 7, 2, withAlpha('#7ec8ff', 0.4));
      }
      const plank = buildSprite(PLANK);
      const sunk = buildSprite(SUNK);
      state.tiles.forEach((tile, index) => {
        const x = 28 + index * 56;
        const blank = tile.length === 0;
        const on = !blank && tile.includes(state.count);
        const here = index === state.pos;
        const bob = on ? 0 : 10 + Math.round(Math.sin(t * 2 + index) * 2);
        blit(g, on ? plank : sunk, x + 20, 156 + bob, { scale: 2, anchor: 'bc' });
        if (blank) blit(g, buildSprite(MAGNET), x + 20, 128, { scale: 1, anchor: 'c' });
        if (here) glow(g, x + 20, 128, 16, '#7ee0a0', 0.5);
        const label = say(f, blank ? '空' : tile.join('/'));
        if (label) {
          drawText(g, label, x + 20, 112, {
            color: on ? '#fff4d6' : '#6a6058',
            align: 'center',
            outline: '#0c1018',
          });
        }
      });
      const walking = Math.floor(t * 4) % 2 === 0;
      const shrimp = buildSprite(walking ? SHRIMP_WALK : SHRIMP);
      const sx = state.pos <= 0 ? 20 : 28 + (state.pos - 1) * 56 + 20;
      shadow(g, sx, 168, 16);
      blit(g, shrimp, sx, 146 + Math.round(Math.sin(t * 3)), { scale: 2, anchor: 'bc' });
      const magnet = buildSprite(MAGNET);
      const magY = 160 + (f.focus?.id === 'magnet' ? -4 : 0) + Math.round(Math.sin(t * 5) * 1);
      blit(g, magnet, 28, magY, { scale: 2, anchor: 'c' });
      if (state.magnets > 0) glow(g, 28, magY, 10, '#ff5d73', 0.35);
      const dial = buildSprite(DIAL);
      for (const count of [0, 1, 2, 3]) {
        const on = state.count === count;
        const bx = 16 + count * 44;
        blit(g, dial, bx + 16, 28, { scale: 2, anchor: 'c' });
        if (on) glow(g, bx + 16, 28, 14, '#ffc24a', 0.45);
        drawText(g, String(count), bx + 16, 22, {
          color: on ? '#ffc24a' : '#fff4d6',
          align: 'center',
          scale: on ? 2 : 1,
        });
      }
      pips(g, 210, 16, state.budgetMax, state.budget, '#7ee0a0', -1, t);
      pips(g, 210, 28, Math.max(state.fallLimit, state.falls), state.falls, '#ff5d73', -1, t);
      const step = say(f, '迈步');
      if (step && f.actions.some((action) => action.id === 'step')) {
        const on = f.focus?.id === 'step';
        rect(g, 142, 188, 100, 22, on ? '#3a3020' : '#1a140c');
        rect(g, 142, 188, 100, 2, '#ffc24a');
        drawText(g, step, 192, 192, { color: '#fff4d6', align: 'center' });
      }
      drawText(g, String(state.magnets), 44, 150, { color: '#ff5d73', align: 'left' });
    },
    react(f, outcome) {
      const type = String(outcome.events[0]?.type ?? '');
      const fell = outcome.result.log.some((line) => line.includes('坠落'));
      const x = f.state.pos <= 0 ? 20 : 28 + (f.state.pos - 1) * 56 + 20;
      if (type === 'magnet') {
        f.cue('coin');
        f.fx.burst(x, 140, {
          count: 12,
          colors: ['#ff5d73', '#fff6dc'],
          speed: 36,
          life: 0.4,
          shape: 'spark',
        });
        f.fx.float(x, 100, '!', '#ff5d73');
      } else if (fell) {
        f.cue('splash');
        f.fx.addTrauma(0.5);
        f.fx.flash('#7ec8ff', 0.3);
        f.fx.burst(x, 160, {
          count: 14,
          colors: ['#7ec8ff', '#fff6dc'],
          speed: 32,
          life: 0.45,
          shape: 'drop',
        });
      } else if (type === 'step') {
        f.cue('land');
        f.fx.burst(x, 150, { count: 4, colors: ['#e8d0a0'], speed: 12, life: 0.25, shape: 'dust' });
      } else {
        f.cue('whoosh');
        f.fx.burst(80, 28, { count: 8, colors: ['#ffc24a'], speed: 18, life: 0.3 });
      }
    },
  };
}

const module: GameModule<CountState> = { definition, createScene };
export default module;
