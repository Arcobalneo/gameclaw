import { definition } from '@games/claw-flip/src/definition';
import type { FlipState } from '@games/claw-flip/src/engine';
import { isSafe } from '@games/claw-flip/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { rect } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit } from '../gfx/world';

function createScene(): GameScene<FlipState> {
  return {
    grade(): Grade {
      return { top: '#102818', bottom: '#081410', bloom: 0.4, vignette: 0.8 };
    },
    anchor: () => ({ x: 180, y: 120 }),
    hits(_state, actions): HitRegion[] {
      return actions.map((action, index) => ({
        x: 16 + index * 124,
        y: 164,
        w: 112,
        h: 40,
        actionId: action.id,
      }));
    },
    draw(f) {
      const { g, t, state } = f;
      sky(g, ['#102018', '#0c1612', '#08100c'], 0, 216, 6);
      state.tiles.forEach((tile, index) => {
        const x = 28 + index * 44;
        const open = isSafe(tile, state.flipped);
        if (tile === 'stone') {
          rect(g, x + 6, 132, 24, 16, '#6a6058');
          rect(g, x + 10, 126, 16, 8, '#8a8078');
        } else if (open) {
          rect(g, x, 146, 36, 8, tile === 'plate' ? '#c4a060' : '#7ec8ff');
        } else {
          rect(g, x + 14, 140, 6, 14, '#ff5d73');
        }
        if (index === state.pos) glow(g, x + 18, 124, 10, '#7ee0a0', 0.35);
      });
      const shrimp = buildSprite(SHRIMP);
      const x = state.pos < 0 ? 16 : 46 + state.pos * 44;
      blit(g, shrimp, x, 144 + Math.round(Math.sin(t * 3)), { scale: 2, anchor: 'bc' });
      const lever = state.flipped ? 36 : 12;
      rect(g, 340, 28, 16, 40, '#3a3028');
      rect(g, 344, lever, 8, 22, '#ffc24a');
      f.actions.forEach((action, index) => {
        const label = say(f, action.label);
        if (!label) return;
        drawText(g, label, 72 + index * 124, 176, { color: '#fff4d6', align: 'center' });
      });
    },
    react(f, outcome) {
      if (outcome.events.some((event) => event.type === 'flip')) f.cue('whoosh');
      if (outcome.result.log.some((line) => line.includes('踩伤'))) f.cue('bad');
    },
  };
}

const module: GameModule<FlipState> = { definition, createScene };
export default module;
