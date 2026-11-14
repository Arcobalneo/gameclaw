import { definition } from '@games/claw-mask/src/definition';
import { covered, type MaskState } from '@games/claw-mask/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, makeCanvas, rect, VH, VW, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, shadow } from '../gfx/world';

const VISOR: SpriteDef = {
  rows: ['gggggggggggg', 'g..........g', 'g..........g', 'gggggggggggg'],
  pal: { g: '#ffe08a' },
};

let canyon: HTMLCanvasElement | null = null;

function walls(): HTMLCanvasElement {
  if (canyon) return canyon;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#241838', '#140c20', '#0c0814'], 0, VH, 8);
  rect(g, 0, 0, 20, VH, '#1a1028');
  rect(g, VW - 20, 0, 20, VH, '#1a1028');
  for (let y = 20; y < VH; y += 16) {
    rect(g, 2, y, 8, 6, '#3a2858');
    rect(g, VW - 12, y + 6, 8, 6, '#3a2858');
  }
  canyon = c;
  return c;
}

function createScene(): GameScene<MaskState> {
  return {
    grade(): Grade {
      return { top: '#201838', bottom: '#100818', bloom: 0.5, vignette: 0.84 };
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
      g.drawImage(walls(), 0, 0);
      for (let i = 0; i < 8; i += 1) {
        const x = 28 + i * 44;
        const ink = state.ink[i] === 'walk';
        const tide = state.tide[i] === 'walk';
        const showInk = covered(state.mask, i);
        const wave = Math.round(Math.sin(t * 2 + i) * 1);
        rect(g, x, 70, 36, 22, '#2a1840');
        rect(g, x + 4, 74, 28, 8, ink ? '#c49aff' : '#1a1028');
        rect(g, x, 108 + wave, 36, 22, '#102028');
        rect(g, x + 4, 114 + wave, 28, 8, tide ? '#7ec8ff' : '#0c1820');
        if (showInk) rect(g, x, 70, 36, 22, withAlpha('#ffe08a', 0.18));
        else rect(g, x, 108 + wave, 36, 22, withAlpha('#7ec8ff', 0.12));
        const safe = (showInk ? state.ink[i] : state.tide[i]) === 'walk';
        rect(g, x + 8, 146, 20, 6, safe ? '#d8c090' : '#3a2418');
      }
      const visorX = 24 + state.mask * 44;
      const visor = buildSprite(VISOR);
      blit(g, visor, visorX + 60, 96 + Math.round(Math.sin(t * 3) * 1), { scale: 2, anchor: 'c' });
      glow(g, visorX + 60, 96, 20, '#ffe08a', 0.2);
      const shrimp = buildSprite(SHRIMP);
      const px = state.pos < 0 ? 16 : 46 + state.pos * 44;
      shadow(g, px, 160, 12);
      blit(g, shrimp, px, 152 + Math.round(Math.sin(t * 3)), { scale: 2, anchor: 'bc' });
      if (state.flood >= 0) {
        const w = Math.min(8, state.flood + 1) * 44;
        const pulse = Math.round(Math.sin(t * 6) * 1);
        rect(g, 28, 164 + pulse, w, 6, '#ff5d73');
        rect(g, 28, 164 + pulse, w, 2, '#ffb0b8');
      }
      f.actions
        .filter((action) => action.id === 'step' || action.id.startsWith('mask:'))
        .forEach((action, index) => {
          const label = say(f, action.label);
          const x = 24 + index * 118;
          const on = f.focus?.id === action.id;
          rect(g, x, 176, 100, 28, on ? '#3a2858' : '#1a1028');
          rect(g, x, 176, 100, 2, on ? '#ffe08a' : '#4a3870');
          if (label) drawText(g, label, x + 50, 184, { color: '#fff4d6', align: 'center' });
        });
    },
    react(f, outcome) {
      const fell = outcome.result.log.some((line) => line.includes('坠落'));
      f.cue(fell ? 'splash' : 'whoosh');
      if (fell) {
        f.fx.addTrauma(0.45);
        f.fx.flash('#7ec8ff', 0.25);
      }
    },
  };
}

const module: GameModule<MaskState> = { definition, createScene };
export default module;
