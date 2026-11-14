import { definition } from '@games/claw-sum/src/definition';
import type { SumState } from '@games/claw-sum/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { disc, rect } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { drawText } from '../gfx/text';

function createScene(): GameScene<SumState> {
  return {
    grade(): Grade {
      return { top: '#201828', bottom: '#100810', bloom: 0.45, vignette: 0.85 };
    },
    anchor: () => ({ x: 190, y: 100 }),
    hits(_state, actions): HitRegion[] {
      return actions.map((action, index) => ({
        x: 24 + index * 92,
        y: 150,
        w: 80,
        h: 48,
        actionId: action.id,
      }));
    },
    draw(f) {
      const { g, state } = f;
      sky(g, ['#201428', '#140c18', '#0c0810'], 0, 216, 6);
      glow(g, 120, 90, 28, '#c49aff', 0.4);
      glow(g, 260, 90, 28, '#7ee0a0', 0.35);
      disc(g, 120, 90, 26, '#2a1840');
      disc(g, 260, 90, 26, '#143028');
      drawText(g, String(state.value), 120, 80, { color: '#fff4d6', align: 'center', scale: 2 });
      drawText(g, String(state.target), 260, 80, { color: '#fff4d6', align: 'center', scale: 2 });
      f.actions.forEach((action, index) => {
        const label = say(f, action.label);
        rect(g, 28 + index * 92, 156, 76, 36, '#241828');
        if (label) drawText(g, label, 66 + index * 92, 166, { color: '#fff4d6', align: 'center' });
      });
    },
  };
}

const module: GameModule<SumState> = { definition, createScene };
export default module;
