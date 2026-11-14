import { definition } from '@games/claw-coil/src/definition';
import type { CoilState } from '@games/claw-coil/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { rect } from '../gfx/pixel';
import type { GameModule, GameScene, HitRegion } from '../gfx/scene';
import { buildSprite, SHRIMP } from '../gfx/sprites';
import { blit } from '../gfx/world';

const OX = 70;
const OY = 28;
const CELL = 28;

function createScene(): GameScene<CoilState> {
  return {
    grade(): Grade {
      return { top: '#142018', bottom: '#08100c', bloom: 0.35, vignette: 0.8 };
    },
    anchor: () => ({ x: 190, y: 100 }),
    hits(_state, actions): HitRegion[] {
      const spot: Record<string, [number, number]> = {
        n: [160, 160],
        s: [160, 188],
        w: [120, 174],
        e: [200, 174],
      };
      return actions
        .filter((action) => spot[action.id])
        .map((action) => {
          const pair = spot[action.id] ?? [0, 0];
          return { x: pair[0], y: pair[1], w: 36, h: 24, actionId: action.id };
        });
    },
    draw(f) {
      const { g, state } = f;
      sky(g, ['#101810', '#0c140c', '#080c08'], 0, 216, 6);
      for (let y = 0; y < 5; y += 1) {
        for (let x = 0; x < 7; x += 1) {
          const edge = x === 0 || y === 0 || x === 6 || y === 4;
          rect(g, OX + x * CELL, OY + y * CELL, CELL - 2, CELL - 2, edge ? '#1a241c' : '#243028');
        }
      }
      const [dx, dy] = state.dock;
      rect(g, OX + dx * CELL + 4, OY + dy * CELL + 4, CELL - 10, CELL - 10, '#3a6a48');
      const [cx, cy] = state.crate;
      rect(g, OX + cx * CELL + 6, OY + cy * CELL + 6, CELL - 14, CELL - 14, '#c4a060');
      const shrimp = buildSprite(SHRIMP);
      state.snake.forEach((cell, index) => {
        blit(g, shrimp, OX + cell[0] * CELL + 13, OY + cell[1] * CELL + 22, {
          scale: index === 0 ? 1 : 1,
          anchor: 'bc',
          alpha: index === 0 ? 1 : 0.7,
        });
      });
    },
  };
}

const module: GameModule<CoilState> = { definition, createScene };
export default module;
