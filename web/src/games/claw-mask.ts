import { definition } from '@games/claw-mask/src/definition';
import { covered, type MaskState, visible } from '@games/claw-mask/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { rect, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit } from '../gfx/world';

function createScene(): GameScene<MaskState> {
  return {
    grade(): Grade {
      return { top: '#201838', bottom: '#100818', bloom: 0.45, vignette: 0.82 };
    },
    anchor: () => ({ x: 180, y: 110 }),
    hits(_state, actions): HitRegion[] {
      return actions
        .filter((action) => action.id === 'step' || action.id.startsWith('mask:'))
        .map((action, index) => ({
          x: 24 + index * 118,
          y: 164,
          w: 108,
          h: 40,
          actionId: action.id,
        }));
    },
    draw(f) {
      const { g, t, state } = f;
      sky(g, ['#181028', '#100818', '#0c0810'], 0, 216, 6);
      for (let i = 0; i < 8; i += 1) {
        const x = 28 + i * 44;
        const ink = state.ink[i] === 'walk';
        const tide = state.tide[i] === 'walk';
        const showInk = covered(state.mask, i);
        const wave = Math.round(Math.sin(t * 2 + i) * 1);
        rect(g, x, 78, 36, 14, ink ? '#c49aff' : '#2a2030');
        rect(g, x, 116 + wave, 36, 14, tide ? '#7ec8ff' : '#1a2830');
        rect(g, x, showInk ? 78 : 116 + wave, 36, 14, withAlpha('#ffffff', 0.22));
        if (visible(state, i) === 'walk') rect(g, x + 8, 148, 20, 6, '#d8c090');
      }
      const visor = 28 + state.mask * 44;
      rect(g, visor, 70, 44 * 3 - 8, 2, '#ffe08a');
      rect(g, visor, 136, 44 * 3 - 8, 2, '#ffe08a');
      rect(g, visor, 70, 2, 68, '#ffe08a');
      rect(g, visor + 44 * 3 - 10, 70, 2, 68, '#ffe08a');
      const shrimp = buildSprite(SHRIMP);
      const px = state.pos < 0 ? 16 : 46 + state.pos * 44;
      const bob = Math.round(Math.sin(t * 3) * 1);
      blit(g, shrimp, px, 146 + bob, { scale: 2, anchor: 'bc' });
      if (state.flood >= 0) {
        const pulse = Math.round(Math.sin(t * 6) * 1);
        rect(g, 28, 158 + pulse, Math.min(8, state.flood + 1) * 44, 4, '#ff5d73');
      }
      f.actions
        .filter((action) => action.id === 'step' || action.id.startsWith('mask:'))
        .forEach((action, index) => {
          const label = say(f, action.label);
          if (!label) return;
          drawText(g, label, 78 + index * 118, 176, { color: '#fff4d6', align: 'center' });
        });
    },
    react(f, outcome) {
      const fell = outcome.result.log.some((line) => line.includes('坠落'));
      f.cue(fell ? 'splash' : 'whoosh');
      if (fell) f.fx.addTrauma(0.4);
    },
  };
}

const module: GameModule<MaskState> = { definition, createScene };
export default module;
