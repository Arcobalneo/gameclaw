import { ITEM_LABEL } from '@games/claw-round/src/content';
import { definition } from '@games/claw-round/src/definition';
import type { RoundState } from '@games/claw-round/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky } from '../gfx/backdrop';
import { rect } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit } from '../gfx/world';

function createScene(): GameScene<RoundState> {
  return {
    grade(): Grade {
      return { top: '#102040', bottom: '#081018', bloom: 0.4, vignette: 0.8 };
    },
    anchor: () => ({ x: 180, y: 120 }),
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      return state.spots.map((_, index) => ({
        x: 28 + index * 70,
        y: 90,
        w: 60,
        h: 70,
        actionId:
          index === state.pos
            ? (actions.find((action) => action.id === 'grab' || action.id === 'pocket')?.id ??
              'step:1')
            : index > state.pos
              ? 'step:1'
              : 'step:-1',
      }));
    },
    draw(f) {
      const { g, state } = f;
      sky(g, ['#102038', '#0c1828', '#081018'], 0, 216, 8);
      moon(g, 40, 28, 8, '#fff6dc', '#9ec8ff');
      rect(g, 0, 160, 384, 56, '#143048');
      const shrimp = buildSprite(SHRIMP);
      state.spots.forEach((item, index) => {
        const x = 40 + index * 70;
        rect(g, x, 150, 48, 10, index === state.pos ? '#ffc24a' : '#6a4a2a');
        const label = item ? say(f, ITEM_LABEL[item]) : '';
        if (label) drawText(g, label, x + 24, 124, { color: '#fff4d6', align: 'center' });
      });
      blit(g, shrimp, 64 + state.pos * 70, 148, { scale: 2, anchor: 'bc' });
    },
  };
}

const module: GameModule<RoundState> = { definition, createScene };
export default module;
