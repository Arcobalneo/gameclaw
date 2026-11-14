import { definition } from '@games/claw-fair/src/definition';
import type { FairState } from '@games/claw-fair/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { rect } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit } from '../gfx/world';

function createScene(): GameScene<FairState> {
  return {
    grade(): Grade {
      return { top: '#201410', bottom: '#100804', bloom: 0.4, vignette: 0.8 };
    },
    anchor: () => ({ x: 180, y: 120 }),
    hits(_state, actions): HitRegion[] {
      return actions.map((action, index) => ({
        x: 16 + index * 92,
        y: 150,
        w: 84,
        h: 48,
        actionId: action.id,
      }));
    },
    draw(f) {
      const { g, state } = f;
      sky(g, ['#201410', '#140c08', '#0c0804'], 0, 216, 6);
      rect(g, 40, 90, 140, 50, '#6a3a22');
      rect(g, 210, 70, 120, 70, '#2a1a12');
      glow(g, 270, 100, 18, '#ffc24a', 0.35);
      drawText(g, String(state.yesterday), 100, 100, {
        color: '#fff4d6',
        align: 'center',
        scale: 2,
      });
      drawText(g, String(state.purse), 270, 90, { color: '#fff4d6', align: 'center', scale: 2 });
      const shrimp = buildSprite(SHRIMP);
      blit(g, shrimp, 160, 140, { scale: 2, anchor: 'bc' });
      f.actions.slice(0, 4).forEach((action, index) => {
        const label = say(f, action.label);
        if (label) drawText(g, label, 58 + index * 92, 168, { color: '#fff4d6', align: 'center' });
      });
    },
  };
}

const module: GameModule<FairState> = { definition, createScene };
export default module;
