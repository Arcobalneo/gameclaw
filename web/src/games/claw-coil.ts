import { definition } from '@games/claw-coil/src/definition';
import type { CoilState } from '@games/claw-coil/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, dither, ellipse, hash01, makeCanvas, rect, VH, VW } from '../gfx/pixel';
import type { GameModule, GameScene, HitRegion } from '../gfx/scene';
import { buildSprite, type SpriteDef } from '../gfx/sprites';
import { blit, shadow } from '../gfx/world';

const OX = 78;
const OY = 28;
const CELL = 32;

const HEAD: SpriteDef = {
  rows: ['..ww..', '.rhrhr', 'rrerrr', '.llll.', 'l....l'],
  pal: { w: '#fff0dc', r: '#ff5a3a', h: '#ffb08a', e: '#1a0808', l: '#c23a2e' },
};
const TAIL: SpriteDef = {
  rows: ['..rr..', '.rrrr.', 'rrdrr.', '.rrrr.', '..rr..'],
  pal: { r: '#e04830', d: '#8a2018' },
};
const CRATE: SpriteDef = {
  rows: ['bbbbbb', 'b.bb.b', 'bbbbbb', 'b.bb.b', 'bbbbbb', '.dddd.'],
  pal: { b: '#e0b060', d: '#6a4018' },
};

let yardCache: HTMLCanvasElement | null = null;

function yard(): HTMLCanvasElement {
  if (yardCache) return yardCache;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#143028', '#0c1c16', '#081410'], 0, VH, 8);
  rect(g, 0, 150, VW, 66, '#102018');
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const edge = x === 0 || y === 0 || x === 6 || y === 4;
      const px = OX + x * CELL;
      const py = OY + y * CELL;
      rect(g, px, py, CELL - 2, CELL - 2, edge ? '#101810' : '#24382c');
      if (!edge && hash01(x * 7 + y, 2) > 0.7) ellipse(g, px + 8, py + 18, 3, 2, '#1a3024');
    }
  }
  dither(g, OX, OY, 7 * CELL, 5 * CELL, '#3a6848', 0.06);
  yardCache = c;
  return c;
}

function createScene(): GameScene<CoilState> {
  return {
    grade(): Grade {
      return { top: '#8fd0a0', bottom: '#041008', bloom: 0.42, vignette: 0.8 };
    },
    anchor: (state) => {
      const head = state.snake[0] ?? [2, 2];
      return { x: OX + head[0] * CELL + 14, y: OY + head[1] * CELL + 16 };
    },
    hits(state, actions): HitRegion[] {
      const head = state.snake[0] ?? [2, 2];
      const spots: Record<string, [number, number]> = {
        n: [head[0], head[1] - 1],
        s: [head[0], head[1] + 1],
        w: [head[0] - 1, head[1]],
        e: [head[0] + 1, head[1]],
      };
      return actions
        .filter((action) => spots[action.id])
        .map((action) => {
          const pair = spots[action.id] ?? [0, 0];
          return {
            x: OX + pair[0] * CELL,
            y: OY + pair[1] * CELL,
            w: CELL - 4,
            h: CELL - 4,
            actionId: action.id,
          };
        });
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(yard(), 0, 0);
      for (let i = 0; i < 4; i += 1) {
        const x = 40 + i * 90;
        const sway = Math.round(Math.sin(t * 1.2 + i) * 2);
        rect(g, x, 40, 3, 120, '#2a2418');
        glow(g, x + sway, 36, 8, '#ffc24a', 0.3);
        rect(g, x - 4 + sway, 32, 10, 6, '#ffe08a');
      }
      for (let i = 0; i < 6; i += 1) {
        ellipse(g, 30 + hash01(i, 9) * 40, 170 + (i % 3) * 8, 6, 3, '#1a3024');
      }
      const [dx, dy] = state.dock;
      glow(g, OX + dx * CELL + 14, OY + dy * CELL + 14, 16, '#7ee0a0', 0.4 + 0.1 * Math.sin(t * 3));
      rect(g, OX + dx * CELL + 6, OY + dy * CELL + 6, CELL - 14, CELL - 14, '#2f8a58');
      rect(g, OX + dx * CELL + 8, OY + dy * CELL + 8, CELL - 18, 2, '#b8ffd0');
      const [cx, cy] = state.crate;
      const wobble = Math.round(Math.sin(t * 2.2) * 1);
      shadow(g, OX + cx * CELL + 14, OY + cy * CELL + 24, 16);
      blit(g, buildSprite(CRATE), OX + cx * CELL + 14, OY + cy * CELL + 22 + wobble, {
        scale: 2,
        anchor: 'bc',
      });
      state.snake.forEach((cell, index) => {
        const px = OX + cell[0] * CELL + 14;
        const py = OY + cell[1] * CELL + 24 + (index === 0 ? Math.round(Math.sin(t * 3)) : 0);
        shadow(g, px, py, index === 0 ? 16 : 12);
        blit(g, buildSprite(index === 0 ? HEAD : TAIL), px, py, {
          scale: index === 0 ? 2 : 1.5,
          anchor: 'bc',
        });
      });
    },
    react(f, outcome) {
      const bumped = outcome.result.log.some((line) => line.includes('撞'));
      const docked = outcome.result.log.some((line) => line.includes('进坞'));
      if (bumped) {
        f.fx.addTrauma(0.35);
        f.fx.hit(180, 90, 'medium', 0, ['#ff5d73', '#fff6dc']);
        f.cue('bad');
      } else if (docked) {
        f.fx.burst(200, 100, { count: 20, colors: ['#7ee0a0', '#fff6dc'], speed: 48, life: 0.6 });
        f.cue('coin');
      } else f.cue('land');
    },
  };
}

const module: GameModule<CoilState> = { definition, createScene };
export default module;
