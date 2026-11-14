import { definition } from '@games/claw-sum/src/definition';
import type { SumState } from '@games/claw-sum/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, disc, dither, ellipse, makeCanvas, rect, VH, VW, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { drawText } from '../gfx/text';
import { pips, plate } from '../gfx/world';

let roomCache: HTMLCanvasElement | null = null;

function room(): HTMLCanvasElement {
  if (roomCache) return roomCache;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#3a1848', '#1c1028', '#100818'], 0, VH, 10);
  rect(g, 0, 150, VW, 66, '#1a1020');
  ellipse(g, 150, 168, 70, 10, '#2a1830');
  rect(g, 78, 40, 144, 16, '#4a3058');
  rect(g, 70, 52, 160, 96, '#3a2848');
  rect(g, 78, 60, 144, 80, '#241430');
  dither(g, 78, 60, 144, 80, '#c49aff', 0.05);
  roomCache = c;
  return c;
}

function createScene(): GameScene<SumState> {
  return {
    grade(): Grade {
      return { top: '#e0b0ff', bottom: '#08040c', bloom: 0.55, vignette: 0.78 };
    },
    anchor: () => ({ x: 150, y: 100 }),
    hits(_state, actions): HitRegion[] {
      return actions.map((action, index) => ({
        x: 16 + index * 92,
        y: 156,
        w: 86,
        h: 46,
        actionId: action.id,
      }));
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(room(), 0, 0);
      const ratio = Math.max(0.05, Math.min(1.15, state.value / Math.max(1, state.target)));
      const fill = Math.round(68 * Math.min(1, ratio));
      const boil = state.value > state.target;
      rect(g, 90, 128 - fill, 120, fill, boil ? '#ff6a8a' : '#7a48d8');
      rect(g, 90, 128 - fill, 120, 3, boil ? '#ffd0dc' : '#d0b0ff');
      for (let i = 0; i < 5; i += 1) {
        const x = 104 + ((i * 22 + Math.round(t * 18)) % 90);
        const y = 118 - Math.round((t * 14 + i * 9) % Math.max(8, fill));
        disc(g, x, y, 2, withAlpha('#ffffff', 0.7));
      }
      if (boil) glow(g, 150, 70, 20, '#ff6a8a', 0.35 + 0.15 * Math.sin(t * 8));
      for (let i = 0; i < 6; i += 1) {
        const h = 6 + Math.round(Math.sin(t * 8 + i) * 3);
        rect(g, 96 + i * 18, 148 - h, 6, h, i % 2 ? '#ffb45a' : '#ff6a2a');
      }
      rect(g, 210, 96, 8, 40, '#6a5878');
      rect(g, 214, 96, 70, 4, '#8a7898');
      for (let i = 0; i < 8; i += 1) rect(g, 82 + i * 16, 56, 3, 3, '#c8b0d8');
      const matched = state.value === state.target;
      glow(g, 292, 78, 26, matched ? '#7ee0a0' : '#ffc24a', 0.45);
      ellipse(g, 292, 84, 22, 22, '#1a1020');
      ellipse(g, 292, 84, 18, 18, matched ? '#245038' : '#3a2810');
      drawText(g, String(state.value), 150, 78, { color: '#fff4d6', align: 'center', scale: 2 });
      drawText(g, String(state.target), 292, 74, { color: '#fff4d6', align: 'center', scale: 2 });
      f.actions.forEach((action, index) => {
        const label = say(f, action.label);
        const on = f.focus?.id === action.id;
        rect(g, 16 + index * 92, 160, 86, 38, on ? '#5a2878' : '#241428');
        rect(g, 16 + index * 92, 160, 86, 2, action.risk === 'high' ? '#ff6a8a' : '#c49aff');
        if (label) drawText(g, label, 59 + index * 92, 170, { color: '#fff4d6', align: 'center' });
      });
      if (f.focus?.detail) {
        const detail = say(f, f.focus.detail);
        if (detail) plate(g, detail, 190, 132, '#fff4d6', 200);
      }
    },
    hud(f) {
      const { g, t, state } = f;
      pips(g, 16, 12, state.pullCap, state.pulls, '#c49aff', state.pulls, t);
      pips(g, 16, 26, state.stages, state.exacts, '#7ee0a0');
    },
    react(f, outcome) {
      const exact = outcome.result.log.some((line) => line.includes('正好'));
      const miss = outcome.result.log.some((line) => line.includes('没对准'));
      if (exact) {
        f.fx.flash('#7ee0a0', 0.35);
        f.fx.burst(150, 90, { count: 22, colors: ['#7ee0a0', '#fff6dc'], speed: 55, life: 0.6 });
        f.cue('coin');
      } else if (miss) {
        f.fx.addTrauma(0.4);
        f.fx.hit(150, 90, 'heavy', Math.PI / 2, ['#ff6a8a', '#ffffff']);
        f.cue('bad');
      } else {
        f.fx.splash(150, 110, '#d0b0ff', 10);
        f.cue('hit');
      }
    },
  };
}

const module: GameModule<SumState> = { definition, createScene };
export default module;
