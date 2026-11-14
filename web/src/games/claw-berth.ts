import { definition } from '@games/claw-berth/src/definition';
import type { BerthState } from '@games/claw-berth/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky } from '../gfx/backdrop';
import { rect } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { drawText } from '../gfx/text';

function createScene(): GameScene<BerthState> {
  return {
    grade(): Grade {
      return { top: '#102030', bottom: '#081018', bloom: 0.4, vignette: 0.82 };
    },
    anchor: () => ({ x: 180, y: 110 }),
    hits(_state, actions): HitRegion[] {
      return actions
        .filter(
          (action) =>
            action.id.startsWith('dock:') || action.id.startsWith('tug:') || action.id === 'wait',
        )
        .map((action) => {
          if (action.id === 'wait') return { x: 300, y: 150, w: 70, h: 48, actionId: action.id };
          const index = Number(action.id.slice(action.id.indexOf(':') + 1));
          return { x: 24 + index * 68, y: 100, w: 60, h: 70, actionId: action.id };
        });
    },
    draw(f) {
      const { g, state } = f;
      sky(g, ['#102030', '#0c1824', '#081018'], 0, 216, 6);
      moon(g, 340, 28, 7, '#fff6dc', '#9ec8ff');
      rect(g, 0, 168, 384, 48, '#143044');
      state.berths.forEach((berth, index) => {
        const x = 28 + index * 68;
        const depth = state.depths[index] ?? 1;
        rect(g, x, 150 - depth * 10, 56, 18 + depth * 10, '#1a4060');
        if (berth) rect(g, x + 8, 132 - depth * 6, 40, 16, berth.hazard ? '#ff5d73' : '#d8c090');
      });
      const wait = say(f, '等待');
      if (wait) drawText(g, wait, 336, 164, { color: '#fff4d6', align: 'center' });
    },
  };
}

const module: GameModule<BerthState> = { definition, createScene };
export default module;
