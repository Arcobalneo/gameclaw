import { definition } from '@games/claw-flip/src/definition';
import { type FlipState, isSafe } from '@games/claw-flip/src/engine';
import type { Grade } from '../gfx/art';
import { fog, godRays, sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, hash01, makeCanvas, rect, VH, VW, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP, SHRIMP_WALK, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, pips, shadow } from '../gfx/world';

const PLATE: SpriteDef = {
  rows: ['wwwwwwwwwwwwww', 'wddddddddddddw', 'wddwddddwddddw', 'bbbbbbbbbbbbbb'],
  pal: { w: '#fff6dc', d: '#e0b060', b: '#6a4a2a' },
};

const GAP: SpriteDef = {
  rows: ['ww..ww..ww..ww', '.wwwwwwwwwwww.', 'bbbbbbbbbbbbbb'],
  pal: { w: '#9ec8ff', b: '#1a4060' },
};

const STONE: SpriteDef = {
  rows: ['...ssss...', '..sddddss.', '.ssdddddss', 'ssddddddss', '.ssddddss.', '..ssssss..'],
  pal: { s: '#a09890', d: '#4a4440' },
};

const SPIKE: SpriteDef = {
  rows: ['..r....r..', '.rrr..rrr.', 'rrrrrrrrrr', '...ssss...'],
  pal: { r: '#ff5d73', s: '#3a2414' },
};

const COIL: SpriteDef = {
  rows: ['c.c.c.c', '.c.c.c.', 'c.c.c.c'],
  pal: { c: '#7ee0a0' },
};

let gorge: HTMLCanvasElement | null = null;

function cliffs(): HTMLCanvasElement {
  if (gorge) return gorge;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#163028', '#0c1814', '#081018'], 0, VH, 8);
  rect(g, 72, 24, VW - 144, 150, '#061410');
  rect(g, 176, 8, 10, 150, '#143048');
  rect(g, 180, 8, 3, 150, '#7ec8ff');
  for (let y = 20; y < 150; y += 8) rect(g, 184, y, 6, 2, withAlpha('#fff6dc', 0.35));
  for (let y = 0; y < 168; y += 8) {
    const left = 56 + ((y * 7) % 22);
    const right = 52 + ((y * 5) % 24);
    rect(g, 0, y, left, 7, y % 16 === 0 ? '#2a5840' : '#1a3028');
    rect(g, left - 6, y, 6, 3, '#3a6848');
    rect(g, VW - right, y, right, 7, '#143028');
    rect(g, VW - right, y + 3, 5, 2, '#245040');
    if (y % 24 === 0) {
      rect(g, left - 4, y, 3, 18, '#3a6848');
      rect(g, VW - right - 2, y, 3, 16, '#2a5840');
    }
  }
  for (let x = 80; x < 300; x += 18) {
    const h = 8 + (x % 22);
    rect(g, x, 0, 6, h, '#1a3028');
    rect(g, x + 1, h, 4, 4, '#3a6848');
  }
  rect(g, 64, 148, VW - 128, 8, '#3a2414');
  rect(g, 64, 148, VW - 128, 2, '#c4a060');
  rect(g, 0, 168, VW, 48, '#061018');
  rect(g, 0, 168, VW, 3, '#1a4060');
  for (let i = 0; i < 18; i += 1) {
    rect(g, 70 + hash01(i, 3) * 240, 176 + hash01(i, 4) * 28, 12, 2, withAlpha('#7ec8ff', 0.4));
  }
  gorge = c;
  return c;
}

function createScene(): GameScene<FlipState> {
  return {
    grade(): Grade {
      return { top: '#102818', bottom: '#081410', bloom: 0.48, vignette: 0.84 };
    },
    anchor: () => ({ x: 180, y: 120 }),
    hits(_state, actions): HitRegion[] {
      return actions.map((action, index) => ({
        x: 12 + index * 124,
        y: 170,
        w: 112,
        h: 38,
        actionId: action.id,
      }));
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(cliffs(), 0, 0);
      godRays(g, t, '#c8ffd8', 3, 0.05);
      for (let i = 0; i < 7; i += 1) {
        const y = (Math.floor(t * 28 + i * 19) % 130) + 12;
        rect(g, 176 + (i % 3) * 5, y, 2, 2, i % 2 ? '#9ec8ff' : '#c4a888');
      }
      for (const lx of [40, 344]) {
        const swing = Math.round(Math.sin(t * 2 + lx) * 2);
        rect(g, lx, 48, 1, 14, '#3a2414');
        rect(g, lx - 4 + swing, 62, 8, 6, '#ffc24a');
        glow(g, lx + swing, 64, 8, '#ffc24a', 0.35);
      }
      fog(g, t, 128, 22, '#9ec8ff', 0.22, 8);
      for (let x = 0; x < VW; x += 16) {
        const y = 166 + Math.round(Math.sin(t * 1.6 + x * 0.05) * 2);
        rect(g, x, y, 10, 2, withAlpha('#7ec8ff', 0.35));
      }
      const plate = buildSprite(PLATE);
      const gap = buildSprite(GAP);
      const stone = buildSprite(STONE);
      const spike = buildSprite(SPIKE);
      state.tiles.forEach((tile, index) => {
        const x = 24 + index * 44;
        const open = isSafe(tile, state.flipped);
        const bob = Math.round(Math.sin(t * 2 + index) * 1);
        if (tile === 'stone') blit(g, stone, x + 16, 138 + bob, { scale: 2, anchor: 'c' });
        else if (open) {
          const water = state.flipped === (tile === 'gap');
          blit(g, water ? gap : plate, x + 16, 152, { scale: 2, anchor: 'c' });
        } else blit(g, spike, x + 16, 146, { scale: 2, anchor: 'c' });
        if (index === state.pos) glow(g, x + 16, 120, 14, '#7ee0a0', 0.45);
      });
      const walking = Math.floor(t * 4) % 2 === 0;
      const shrimp = buildSprite(walking ? SHRIMP_WALK : SHRIMP);
      const sx = state.pos < 0 ? 16 : 40 + state.pos * 44;
      shadow(g, sx, 164, 14);
      blit(g, shrimp, sx, 146 + Math.round(Math.sin(t * 3)), { scale: 2, anchor: 'bc' });
      const lever = state.flipped ? 56 : 24;
      const kick = f.since < 0.2 ? 4 : 0;
      rect(g, 352, 28, 10, 64, '#3a3028');
      rect(g, 346, lever + kick, 22, 8, '#ffc24a');
      rect(g, 354, lever + kick, 6, 4, '#fff6dc');
      glow(g, 356, lever + 4, 10, '#ffc24a', 0.35);
      const coil = buildSprite(COIL);
      for (let i = 0; i < state.springs; i += 1) {
        blit(g, coil, 20 + i * 16, 22, { scale: 2, anchor: 'c' });
      }
      pips(g, 16, 32, state.woundLimit, state.wounds, '#ff5d73', -1, t);
      f.actions.forEach((action, index) => {
        const label = say(f, action.label);
        const bx = 12 + index * 124;
        const on = f.focus?.id === action.id;
        rect(g, bx, 174, 110, 32, on ? '#243828' : '#101810');
        rect(g, bx, 174, 110, 3, on ? '#ffc24a' : '#3a6848');
        if (label) drawText(g, label, bx + 55, 182, { color: '#fff4d6', align: 'center' });
      });
    },
    react(f, outcome) {
      const id = String(outcome.events[0]?.type ?? '');
      const wound = outcome.result.log.some((line) => line.includes('踩伤'));
      if (id === 'flip') {
        f.cue('whoosh');
        f.fx.burst(200, 140, {
          count: 16,
          colors: ['#ffc24a', '#7ec8ff', '#fff6dc'],
          speed: 34,
          life: 0.4,
        });
        f.fx.kick(0, 3);
        f.fx.impact(2);
      } else if (id.startsWith('hop')) {
        f.cue('whoosh');
        f.fx.burst(180, 120, {
          count: 8,
          colors: ['#7ee0a0'],
          speed: 24,
          life: 0.3,
          shape: 'spark',
        });
      } else if (wound) {
        f.cue('bad');
        f.fx.addTrauma(0.5);
        f.fx.flash('#ff5d73', 0.3);
      } else f.cue('land');
    },
  };
}

const module: GameModule<FlipState> = { definition, createScene };
export default module;
