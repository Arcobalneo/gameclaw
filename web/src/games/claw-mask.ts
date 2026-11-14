import { definition } from '@games/claw-mask/src/definition';
import { covered, type MaskState } from '@games/claw-mask/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, hash01, makeCanvas, rect, VH, VW } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP, SHRIMP_WALK, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, kelp, shadow } from '../gfx/world';

const CRYSTAL: SpriteDef = {
  rows: ['..c..', '.ccc.', 'cwcwc', '.ccc.', '..c..'],
  pal: { c: '#c49aff', w: '#fff6dc' },
};

const WAVE: SpriteDef = {
  rows: ['w.w.w.w', '.wwwww.', 'bbbbbbb'],
  pal: { w: '#fff6dc', b: '#7ec8ff' },
};

let canyon: HTMLCanvasElement | null = null;

/** Two rock walls with crystal pockets. The corridor itself is drawn live. */
function walls(): HTMLCanvasElement {
  if (canyon) return canyon;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#2a1848', '#160c28', '#0c0814'], 0, VH, 8);
  rect(g, 0, 0, 40, VH, '#140c20');
  rect(g, VW - 40, 0, 40, VH, '#100818');
  for (let y = 4; y < VH; y += 12) {
    const w = 18 + ((y * 3) % 22);
    rect(g, 0, y, w, 8, hash01(y, 1) > 0.5 ? '#3a2860' : '#2a1848');
    rect(g, VW - w, y + 4, w, 8, '#241838');
    rect(g, w - 4, y + 2, 6, 3, '#c49aff');
    rect(g, VW - w, y + 6, 6, 3, '#7ec8ff');
  }
  for (let x = 48; x < VW - 48; x += 16) {
    const h = 6 + (x % 20);
    rect(g, x, 0, 6, h, '#2a1848');
    rect(g, x + 1, h, 4, 5, '#c49aff');
  }
  rect(g, 40, 150, VW - 80, 10, '#1a2838');
  rect(g, 40, 160, VW - 80, 56, '#0c2030');
  rect(g, 40, 160, VW - 80, 2, '#3a6888');
  canyon = c;
  return c;
}

function createScene(): GameScene<MaskState> {
  return {
    grade(): Grade {
      return { top: '#201838', bottom: '#100818', bloom: 0.52, vignette: 0.86 };
    },
    anchor: () => ({ x: 190, y: 120 }),
    hits(_state, actions): HitRegion[] {
      return actions
        .filter((action) => action.id === 'step' || action.id.startsWith('mask:'))
        .map((action, index) => ({
          x: 24 + index * 118,
          y: 168,
          w: 108,
          h: 40,
          actionId: action.id,
        }));
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(walls(), 0, 0);
      kelp(g, 26, 168, 28, t, '#3a2860');
      kelp(g, 350, 168, 34, t, '#145060');
      const crystal = buildSprite(CRYSTAL);
      const wave = buildSprite(WAVE);
      for (let i = 0; i < 8; i += 1) {
        const x = 32 + i * 40;
        const ink = state.ink[i] === 'walk';
        const tide = state.tide[i] === 'walk';
        const showInk = covered(state.mask, i);
        const bob = Math.round(Math.sin(t * 2 + i) * 1);
        rect(g, x, 62, 34, 28, '#241430');
        rect(g, x, 64, 34, 3, '#4a3068');
        if (ink) blit(g, crystal, x + 17, 76, { scale: 2, anchor: 'c' });
        else rect(g, x + 8, 72, 18, 8, '#1a1020');
        rect(g, x, 104 + bob, 34, 28, '#0c2030');
        if (tide) blit(g, wave, x + 17, 118 + bob, { scale: 2, anchor: 'c' });
        else rect(g, x + 6, 114, 22, 6, '#081018');
        const frame = showInk ? '#ffe08a' : '#7ec8ff';
        rect(g, x, showInk ? 62 : 104 + bob, 34, 2, frame);
        const safe = (showInk ? state.ink[i] : state.tide[i]) === 'walk';
        rect(g, x + 6, 146, 22, 5, safe ? '#e8d0a0' : '#3a2418');
      }
      const visorX = 28 + state.mask * 40;
      const sway = Math.round(Math.sin(t * 3) * 1);
      rect(g, visorX, 56 + sway, 124, 3, '#ffe08a');
      rect(g, visorX, 136 + sway, 124, 3, '#ffe08a');
      rect(g, visorX, 56 + sway, 3, 83, '#ffe08a');
      rect(g, visorX + 121, 56 + sway, 3, 83, '#c4a060');
      glow(g, visorX + 62, 96, 28, '#ffe08a', 0.18);
      const walking = Math.floor(t * 4) % 2 === 0;
      const shrimp = buildSprite(walking ? SHRIMP_WALK : SHRIMP);
      const px = state.pos < 0 ? 18 : 49 + state.pos * 40;
      shadow(g, px, 158, 14);
      blit(g, shrimp, px, 150 + Math.round(Math.sin(t * 3)), { scale: 2, anchor: 'bc' });
      if (state.flood >= 0) {
        const w = Math.min(8, state.flood + 1) * 40;
        const pulse = Math.round(Math.sin(t * 6) * 2);
        rect(g, 32, 160 + pulse, w, 8, '#ff5d73');
        rect(g, 32, 160 + pulse, w, 2, '#ffd0d4');
        for (let i = 0; i < w; i += 8) rect(g, 32 + i, 156 + pulse, 3, 4, '#ff5d73');
      }
      f.actions
        .filter((action) => action.id === 'step' || action.id.startsWith('mask:'))
        .forEach((action, index) => {
          const label = say(f, action.label);
          const x = 24 + index * 118;
          const on = f.focus?.id === action.id;
          rect(g, x, 176, 104, 30, on ? '#3a2858' : '#140c20');
          rect(g, x, 176, 104, 3, on ? '#ffe08a' : '#4a3870');
          if (label) drawText(g, label, x + 52, 184, { color: '#fff4d6', align: 'center' });
        });
    },
    react(f, outcome) {
      const fell = outcome.result.log.some((line) => line.includes('坠落'));
      const slide = String(outcome.events[0]?.type ?? '') === 'slide';
      if (fell) {
        f.cue('splash');
        f.fx.addTrauma(0.5);
        f.fx.flash('#7ec8ff', 0.35);
        f.fx.burst(180, 150, {
          count: 16,
          colors: ['#7ec8ff', '#fff6dc'],
          speed: 36,
          life: 0.45,
          shape: 'drop',
        });
      } else if (slide) {
        f.cue('whoosh');
        f.fx.burst(28 + f.state.mask * 40 + 60, 96, {
          count: 8,
          colors: ['#ffe08a'],
          speed: 20,
          life: 0.3,
          shape: 'spark',
        });
      } else f.cue('land');
    },
  };
}

const module: GameModule<MaskState> = { definition, createScene };
export default module;
