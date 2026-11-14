import { definition } from '@games/claw-reef/src/definition';
import { HEIGHT, type ReefState, WIDTH } from '@games/claw-reef/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky } from '../gfx/backdrop';
import { rect } from '../gfx/pixel';
import type { GameModule, GameScene, HitRegion } from '../gfx/scene';
import { buildSprite, SHRIMP } from '../gfx/sprites';
import { blit } from '../gfx/world';

const CELL = 36;
const OX = 80;
const OY = 36;

function createScene(): GameScene<ReefState> {
  return {
    grade(): Grade {
      return { top: '#082028', bottom: '#041014', bloom: 0.4, vignette: 0.82 };
    },
    anchor: () => ({ x: 190, y: 100 }),
    hits(state): HitRegion[] {
      return [
        {
          x: OX + state.x * CELL - 8,
          y: OY + (state.y - 1) * CELL,
          w: CELL,
          h: CELL,
          actionId: 'step:n',
        },
        {
          x: OX + state.x * CELL - 8,
          y: OY + (state.y + 1) * CELL,
          w: CELL,
          h: CELL,
          actionId: 'step:s',
        },
        {
          x: OX + (state.x - 1) * CELL - 8,
          y: OY + state.y * CELL,
          w: CELL,
          h: CELL,
          actionId: 'step:w',
        },
        {
          x: OX + (state.x + 1) * CELL - 8,
          y: OY + state.y * CELL,
          w: CELL,
          h: CELL,
          actionId: 'step:e',
        },
        { x: 300, y: 160, w: 64, h: 36, actionId: 'anchor' },
      ];
    },
    draw(f) {
      const { g, state } = f;
      sky(g, ['#082028', '#061820', '#041014'], 0, 216, 6);
      moon(g, 40, 24, 7, '#fff6dc', '#9ec8ff');
      for (let y = 0; y < HEIGHT; y += 1) {
        for (let x = 0; x < WIDTH; x += 1) {
          const edge = x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1;
          rect(g, OX + x * CELL, OY + y * CELL, CELL - 2, CELL - 2, edge ? '#0c2830' : '#143840');
        }
      }
      state.goals.forEach((goal) => {
        const key = `${goal[0]},${goal[1]}`;
        const got = state.got.includes(key);
        rect(
          g,
          OX + (goal[0] ?? 0) * CELL + 8,
          OY + (goal[1] ?? 0) * CELL + 8,
          16,
          16,
          got ? '#3a6a48' : '#ffc24a',
        );
      });
      const shrimp = buildSprite(SHRIMP);
      blit(g, shrimp, OX + state.x * CELL + 16, OY + state.y * CELL + 28, {
        scale: 2,
        anchor: 'bc',
      });
    },
  };
}

const module: GameModule<ReefState> = { definition, createScene };
export default module;
