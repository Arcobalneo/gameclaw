import { definition } from '@games/claw-flip/src/definition';
import { type FlipState, isSafe } from '@games/claw-flip/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, makeCanvas, rect, VH, VW } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, pips, shadow } from '../gfx/world';

const STONE: SpriteDef = {
  rows: ['..ssss..', '.ssddss.', 'ssddddss', 'ssddddss', '.ssddss.', '..ssss..'],
  pal: { s: '#8a8078', d: '#4a4440' },
};

const SPIKE: SpriteDef = {
  rows: ['..r..', '.rrr.', 'rrrrr', '..s..'],
  pal: { r: '#ff5d73', s: '#3a2414' },
};

let gorge: HTMLCanvasElement | null = null;

function cliffs(): HTMLCanvasElement {
  if (gorge) return gorge;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#143028', '#0c1c16', '#081410'], 0, VH, 8);
  rect(g, 0, 150, VW, 66, '#0c2018');
  rect(g, 0, 40, 18, 176, '#1a3024');
  rect(g, VW - 18, 40, 18, 176, '#1a3024');
  gorge = c;
  return c;
}

function createScene(): GameScene<FlipState> {
  return {
    grade(): Grade {
      return { top: '#102818', bottom: '#081410', bloom: 0.45, vignette: 0.82 };
    },
    anchor: () => ({ x: 180, y: 120 }),
    hits(_state, actions): HitRegion[] {
      return actions.map((action, index) => ({
        x: 16 + index * 124,
        y: 168,
        w: 112,
        h: 40,
        actionId: action.id,
      }));
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(cliffs(), 0, 0);
      const stone = buildSprite(STONE);
      const spike = buildSprite(SPIKE);
      state.tiles.forEach((tile, index) => {
        const x = 28 + index * 44;
        const open = isSafe(tile, state.flipped);
        const bob = Math.round(Math.sin(t * 2 + index) * 1);
        if (tile === 'stone') {
          blit(g, stone, x + 18, 140 + bob, { scale: 2, anchor: 'c' });
        } else if (open) {
          const plate = state.flipped ? tile !== 'plate' : tile === 'plate';
          rect(g, x, 148, 36, 8, plate ? '#c4a060' : '#7ec8ff');
          rect(g, x, 148, 36, 2, '#fff6dc');
        } else {
          blit(g, spike, x + 18, 146, { scale: 2, anchor: 'c' });
        }
        if (index === state.pos) glow(g, x + 18, 124, 12, '#7ee0a0', 0.4);
      });
      const shrimp = buildSprite(SHRIMP);
      const x = state.pos < 0 ? 16 : 46 + state.pos * 44;
      shadow(g, x, 160, 12);
      blit(g, shrimp, x, 144 + Math.round(Math.sin(t * 3)), { scale: 2, anchor: 'bc' });
      const lever = state.flipped ? 48 : 20;
      rect(g, 348, 36, 12, 48, '#3a3028');
      rect(g, 344, lever + Math.round(Math.sin(t * 2)), 20, 8, '#ffc24a');
      glow(g, 354, lever + 4, 8, '#ffc24a', 0.3);
      pips(g, 16, 16, state.springMax, state.springs, '#7ee0a0', -1, t);
      pips(g, 16, 28, state.woundLimit, state.wounds, '#ff5d73', -1, t);
      f.actions.forEach((action, index) => {
        const label = say(f, action.label);
        const bx = 16 + index * 124;
        const on = f.focus?.id === action.id;
        rect(g, bx, 170, 108, 32, on ? '#243828' : '#101810');
        rect(g, bx, 170, 108, 2, on ? '#ffc24a' : '#3a6848');
        if (label) drawText(g, label, bx + 54, 178, { color: '#fff4d6', align: 'center' });
      });
    },
    react(f, outcome) {
      const id = String(outcome.events[0]?.type ?? '');
      const wound = outcome.result.log.some((line) => line.includes('踩伤'));
      if (id === 'flip') {
        f.cue('whoosh');
        f.fx.burst(200, 140, { count: 12, colors: ['#ffc24a', '#7ec8ff'], speed: 28, life: 0.35 });
        f.fx.kick(0, 2);
      } else if (wound) {
        f.cue('bad');
        f.fx.addTrauma(0.4);
        f.fx.flash('#ff5d73', 0.25);
      } else f.cue('land');
    },
  };
}

const module: GameModule<FlipState> = { definition, createScene };
export default module;
