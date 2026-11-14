import { definition } from '@games/claw-count/src/definition';
import type { CountState } from '@games/claw-count/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, hash01, makeCanvas, rect, VH, VW, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, pips, shadow } from '../gfx/world';

const MAGNET: SpriteDef = {
  rows: ['rr...rr', 'r.....r', 'r.....r', '.rrrrr.', '..rrr..'],
  pal: { r: '#ff5d73' },
};

let night: HTMLCanvasElement | null = null;

function bridge(): HTMLCanvasElement {
  if (night) return night;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#1a2448', '#101830', '#0c1018'], 0, VH, 8);
  rect(g, 0, 170, VW, 46, '#121820');
  for (let i = 0; i < 20; i += 1) {
    rect(g, hash01(i, 4) * VW, 180 + hash01(i, 5) * 20, 6, 1, '#243040');
  }
  night = c;
  return c;
}

function createScene(): GameScene<CountState> {
  return {
    grade(): Grade {
      return { top: '#243050', bottom: '#0c1018', bloom: 0.45, vignette: 0.82 };
    },
    anchor: () => ({ x: 180, y: 120 }),
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const regions: HitRegion[] = [];
      const step = actions.find((action) => action.id === 'step');
      if (step) regions.push({ x: 250, y: 150, w: 110, h: 48, actionId: 'step' });
      const magnet = actions.find((action) => action.id === 'magnet');
      if (magnet) regions.push({ x: 16, y: 150, w: 70, h: 48, actionId: 'magnet' });
      actions
        .filter((action) => action.id.startsWith('set:'))
        .forEach((action, index) => {
          regions.push({ x: 16 + index * 40, y: 20, w: 34, h: 34, actionId: action.id });
        });
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(bridge(), 0, 0);
      stars(g, t, 2, 8, 60);
      moon(g, 40, 24, 8, '#fff6dc', '#9eb4ff');
      for (let x = 0; x < VW; x += 14) {
        const y = 166 + Math.round(Math.sin(t * 1.4 + x * 0.05) * 2);
        rect(g, x, y, 8, 2, withAlpha('#7ec8ff', 0.35));
      }
      state.tiles.forEach((tile, index) => {
        const x = 36 + index * 52;
        const on = tile.includes(state.count);
        const here = index === state.pos;
        const sink = on ? 0 : 12 + Math.round(Math.sin(t * 2 + index) * 1);
        rect(g, x, 148 + sink, 40, on ? 16 : 6, on ? '#e8d0a0' : '#3a3028');
        rect(g, x, 148 + sink, 40, 2, on ? '#fff6dc' : '#241c14');
        if (here) glow(g, x + 20, 136, 14, '#7ee0a0', 0.45);
        const label = say(f, tile.join('/'));
        if (label) {
          drawText(g, label, x + 20, 124, { color: on ? '#fff4d6' : '#6a6058', align: 'center' });
        }
      });
      const shrimp = buildSprite(SHRIMP);
      const x = state.pos <= 0 ? 24 : 36 + (state.pos - 1) * 52 + 20;
      shadow(g, x, 166, 14);
      blit(g, shrimp, x, 150 + Math.round(Math.sin(t * 3)), { scale: 2, anchor: 'bc' });
      const magnet = buildSprite(MAGNET);
      blit(g, magnet, 36, 156 + Math.round(Math.sin(t * 4) * 1), { scale: 2, anchor: 'c' });
      for (const count of [0, 1, 2, 3]) {
        const on = state.count === count;
        const bx = 20 + count * 40;
        rect(g, bx, 22, 32, 32, on ? '#ffc24a' : '#1a140c');
        rect(g, bx, 22, 32, 2, on ? '#fff6dc' : '#6a4a2a');
        drawText(g, String(count), bx + 16, 30, {
          color: '#fff4d6',
          align: 'center',
          scale: on ? 2 : 1,
        });
      }
      pips(g, 200, 18, state.budgetMax, state.budget, '#7ee0a0', -1, t);
      pips(g, 200, 30, state.fallLimit, state.falls, '#ff5d73', -1, t);
      const step = say(f, '迈步');
      if (step && f.actions.some((action) => action.id === 'step')) {
        const on = f.focus?.id === 'step';
        rect(g, 262, 164, 96, 32, on ? '#3a3020' : '#1a140c');
        rect(g, 262, 164, 96, 2, '#ffc24a');
        drawText(g, step, 310, 172, { color: '#fff4d6', align: 'center' });
      }
    },
    react(f, outcome) {
      const type = String(outcome.events[0]?.type ?? '');
      const fell = outcome.result.log.some((line) => line.includes('坠落'));
      if (type === 'magnet') f.cue('coin');
      else if (fell) {
        f.cue('bad');
        f.fx.addTrauma(0.4);
        f.fx.burst(180, 150, {
          count: 10,
          colors: ['#7ec8ff', '#fff6dc'],
          speed: 30,
          life: 0.4,
          shape: 'drop',
        });
      } else if (type === 'step') f.cue('land');
      else f.cue('whoosh');
    },
  };
}

const module: GameModule<CountState> = { definition, createScene };
export default module;
