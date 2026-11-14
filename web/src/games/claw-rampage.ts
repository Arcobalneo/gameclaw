import { definition } from '@games/claw-rampage/src/definition';
import type { PumpkinState } from '@games/claw-rampage/src/engine';
import { type Grade, LightMask } from '../gfx/art';
import { fog, moon, ridge, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  bar,
  type Ctx,
  dither,
  easeOutBack,
  ellipse,
  hash01,
  rect,
  VH,
  VW,
  withAlpha,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, PUMPKIN, PUMPKIN_PLAIN, SPROUT } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { tiny } from '../gfx/tiny';
import { blit, pips, plate, shadow } from '../gfx/world';

const PLOT_W = 92;
const PLOT_H = 34;

function plotRect(i: number): { x: number; y: number } {
  const row = Math.floor(i / 3);
  const col = i % 3;
  return { x: 42 + col * 104 + row * 10, y: 96 + row * 50 };
}

const MONSTER_TINT: Record<string, Record<string, string>> = {
  roller: { o: '#ff8a1e' },
  runner: { o: '#ff5a3a', h: '#a02a10' },
  bouncer: { o: '#ffb347' },
  floater: { o: '#c49aff', h: '#6a4ab0' },
};

function drawPlot(
  g: Ctx,
  x: number,
  y: number,
  durability: number,
  focus: boolean,
  t: number,
): void {
  // Raised bed: dark soil mound with lit furrow tops and a timber border.
  rect(g, x - 2, y + PLOT_H - 2, PLOT_W + 4, 4, withAlpha('#000000', 0.45));
  rect(g, x - 2, y - 1, PLOT_W + 4, PLOT_H + 2, '#4a2e1a');
  rect(g, x - 2, y - 1, PLOT_W + 4, 1, '#8a5a32');
  rect(g, x, y + 1, PLOT_W, PLOT_H - 2, '#2a160e');
  for (let r = 0; r < 4; r += 1) {
    const fy = y + 5 + r * 7;
    rect(g, x + 3, fy, PLOT_W - 6, 3, '#3a2014');
    rect(g, x + 3, fy, PLOT_W - 6, 1, '#5a3420');
    rect(g, x + 3, fy + 3, PLOT_W - 6, 1, '#160806');
    for (let k = 0; k < 6; k += 1)
      rect(g, x + 6 + hash01(k + r * 9, x) * (PLOT_W - 12), fy + 1, 1, 1, '#6a4428');
  }
  // Fence posts = durability.
  for (let d = 0; d < 3; d += 1) {
    const px = x + PLOT_W - 6 - d * 6;
    rect(g, px, y - 6, 3, 8, d < durability ? '#a07a4a' : '#3a2a20');
    rect(g, px, y - 6, 3, 1, d < durability ? '#d0a870' : '#3a2a20');
  }
  if (focus) {
    const a = 0.5 + 0.5 * Math.sin(t * 8);
    glow(g, x + PLOT_W / 2, y + PLOT_H / 2, 50, '#ffe066', 0.15 + a * 0.1);
  }
}

function createScene(): GameScene<PumpkinState> {
  const pulses = new Map<number, number>();
  const lights = new LightMask();

  const plotOf = (actionId: string, state: PumpkinState) => {
    const m = /:(p\d+)$/.exec(actionId);
    return m ? state.plots.findIndex((p) => p.id === m[1]) : -1;
  };

  return {
    anchor: () => ({ x: VW / 2, y: 100 }),
    hits(state, actions): HitRegion[] {
      return state.plots.flatMap((plot, i) => {
        const a = actions.find((x) => x.id.endsWith(`:${plot.id}`));
        if (!a) return [];
        const { x, y } = plotRect(i);
        return [{ x, y: y - 8, w: PLOT_W, h: PLOT_H + 8, actionId: a.id }];
      });
    },
    draw(f) {
      const { g, t, state } = f;
      const rampage = state.night >= 3;
      sky(
        g,
        rampage
          ? ['#3a0a2a', '#2a0a20', '#14060f', '#0a0408']
          : ['#1a0a3a', '#140a2e', '#0c0618', '#06030c'],
        0,
        VH,
        10,
      );
      stars(g, t, 21, 60, 70);
      moon(g, 330, 32, 12, rampage ? '#ffb0a0' : '#fff0c8', rampage ? '#ff4a4a' : '#ffb347');
      ridge(g, { seed: 6, base: 82, amp: 26, color: '#160a1e', kind: 'trees', scale: 16 }, t * 1.5);
      fog(g, t, 70, 18, '#5a3a7a', 0.25, 4);
      rect(g, 0, 84, VW, VH - 84, '#1a0e0a');
      dither(g, 0, 84, VW, 10, '#2a1810', 0.5);
      // Farmhouse: gabled roof, lit window, porch lantern.
      rect(g, 6, 50, 40, 34, '#2a1620');
      rect(g, 6, 50, 2, 34, '#4a2a34');
      for (let k = 0; k < 14; k += 1)
        rect(g, 2 + k, 50 - k, 48 - k * 2, 1, k < 2 ? '#5a2a30' : '#3a1a24');
      rect(g, 14, 60, 10, 10, '#ffcf6a');
      rect(g, 18, 60, 1, 10, '#6a3a20');
      rect(g, 14, 64, 10, 1, '#6a3a20');
      rect(g, 30, 66, 10, 18, '#1a0c10');
      glow(g, 19, 65, 22, '#ffb347', 0.45);
      // Scarecrow.
      rect(g, 360, 56, 2, 30, '#5a3a20');
      rect(g, 350, 64, 22, 2, '#5a3a20');
      rect(g, 355, 60, 12, 12, '#7a4a7a');
      ellipse(g, 361, 54, 5, 5, '#d8b070');
      rect(g, 355, 49, 12, 2, '#3a2a1a');
      rect(g, 358, 45, 6, 4, '#3a2a1a');
      rect(g, 359, 53, 1, 1, '#1a0a0a');
      rect(g, 362, 53, 1, 1, '#1a0a0a');
      // Picket fence along the horizon.
      for (let fx = 52; fx < 344; fx += 8) {
        rect(g, fx, 76, 3, 10, '#5a4030');
        rect(g, fx, 76, 3, 1, '#9a7050');
      }
      rect(g, 52, 79, 292, 1, '#4a3022');
      rect(g, 52, 83, 292, 1, '#4a3022');

      for (let k = 0; k < 40; k += 1) {
        const gx = (k * 47) % VW;
        const gy = 90 + ((k * 29) % 120);
        rect(g, gx, gy, 1, 3, '#2a3a1a');
        rect(g, gx + 2, gy + 1, 1, 2, '#3a4a22');
      }
      const focusPlot = f.focus ? plotOf(f.focus.id, state) : -1;
      state.plots.forEach((plot, i) => {
        const { x, y } = plotRect(i);
        drawPlot(g, x, y, plot.durability, focusPlot === i, t);
        const cx = x + PLOT_W / 2;
        const bump = pulses.has(i) ? easeOutBack(Math.min(1, (t - pulses.get(i)!) / 0.4)) : 1;
        if (plot.stage === 1) {
          for (let k = 0; k < 3; k += 1)
            blit(g, buildSprite(SPROUT), x + 18 + k * 28, y + 24, {
              anchor: 'bc',
              scale: 2,
              squash: 1 / bump,
            });
        } else if (plot.stage === 2) {
          glow(g, cx, y + 12, 22, '#ffb347', 0.35);
          blit(g, buildSprite(PUMPKIN_PLAIN, {}, { rim: '#ffe0a0' }), cx - 20, y + 22, {
            anchor: 'bc',
            scale: 2 * bump,
          });
          blit(g, buildSprite(PUMPKIN_PLAIN, {}, { rim: '#ffe0a0' }), cx + 16, y + 24, {
            anchor: 'bc',
            scale: 1.6 * bump,
          });
        }
        const nm = say(f, plot.name);
        if (nm)
          drawText(g, nm, x + 4, y + PLOT_H + 3, {
            color: focusPlot === i ? '#ffe066' : '#9a7a6a',
          });
      });

      // Monsters.
      for (const m of state.monsters) {
        const i = m.plot;
        const { x, y } = plotRect(Math.max(0, Math.min(5, i)));
        const cx = x + PLOT_W / 2 + (hash01(i, 3) - 0.5) * 30;
        if (m.revealed) {
          const hop =
            m.kind === 'bouncer'
              ? Math.abs(Math.sin(t * 5 + i)) * 8
              : m.kind === 'floater'
                ? 6 + Math.sin(t * 2) * 3
                : Math.abs(Math.sin(t * 9)) * 2;
          shadow(g, cx, y + 20, 22);
          glow(g, cx, y + 8 - hop, 20, m.kind === 'floater' ? '#c49aff' : '#ff8a1e', 0.35);
          blit(
            g,
            buildSprite(PUMPKIN, MONSTER_TINT[m.kind], { rim: '#ffe0a0' }),
            cx,
            y + 20 - hop,
            { anchor: 'bc', scale: 1.5 },
          );
          bar(g, cx - 12, y - 18 - hop, 24, 2, m.calm / Math.max(1, m.need), '#ff9ae0');
          if (m.agitation > 0)
            tiny(g, '!'.repeat(Math.min(3, m.agitation)), cx + 14, y - 8 - hop, {
              color: '#ff4d6d',
              scale: 2,
            });
        } else if (m.hinted) {
          const r = Math.sin(t * 7 + i) > 0 ? 1 : 0;
          for (let k = 0; k < 5; k += 1)
            rect(g, cx - 10 + k * 5 + r, y + 10 + (k % 2) * 3, 2, 4, '#3a7a2a');
          glow(g, cx, y + 10, 14, '#ff8a1e', 0.2 + 0.15 * Math.sin(t * 4));
          tiny(g, '?', cx, y - 8 + Math.round(Math.sin(t * 3) * 2), {
            color: '#ffb347',
            align: 'center',
            scale: 2,
          });
        }
      }
      // Night lighting: farmhouse, moon wash, monster lanterns.
      lights.begin('#06030c', rampage ? 0.34 : 0.4);
      lights.light(19, 66, 60, 0.9);
      lights.light(330, 32, 90, 0.5);
      lights.light(VW / 2, 120, 160, 0.35);
      for (const m of state.monsters)
        if (m.revealed) {
          const { x, y } = plotRect(Math.max(0, Math.min(5, m.plot)));
          lights.light(x + PLOT_W / 2, y + 8, 40, 0.8);
        }
      lights.end(g);
      // Floating embers.
      if (Math.random() < 0.25)
        f.fx.mote(
          Math.random() * VW,
          VH,
          (Math.random() - 0.5) * 6,
          -10 - Math.random() * 8,
          rampage ? '#ff6a4a' : '#ffb347',
          5,
          1,
          true,
        );
    },
    grade: (s): Grade =>
      s.night >= 3
        ? { top: '#ff9080', bottom: '#0a0208', strength: 0.3, bloom: 0.65 }
        : { top: '#ffc890', bottom: '#06030c', strength: 0.26, bloom: 0.6 },
    hud(f) {
      const { g, t, state } = f;
      pips(g, 8, 8, state.actionCap, state.actionsUsed, '#ffb347', state.actionsUsed, t);
      const note = state.notes.at(-1);
      const nt = note && f.since < 3 ? say(f, note) : '';
      if (nt) plate(g, nt, VW / 2, 194, '#fff0c8', 300);
    },
    react(f, o) {
      const action = o.action.id;
      const i = plotOf(action, o.state);
      const { x, y } = plotRect(Math.max(0, i));
      const cx = x + PLOT_W / 2;
      if (i >= 0) pulses.set(i, f.t);
      for (const e of o.events) {
        if (e.type === 'monster-revealed') {
          f.fx.burst(cx, y + 10, { count: 26, colors: ['#ff8a1e', '#ffe066'], speed: 90 });
          f.fx.hit(cx, y + 6, 'medium', -Math.PI / 2, ['#ff8a1e', '#ffe066']);
          f.cue('heavy');
        } else if (e.type === 'monster-soothed') {
          f.cue('good');
          f.fx.burst(cx, y, {
            count: 40,
            colors: ['#ff9ae0', '#ffffff', '#ffe066'],
            speed: 110,
            gravity: -30,
          });
          f.fx.float(cx, y - 30, '♥', '#ff9ae0', 1.2, true);
        } else if (e.type === 'harvest') {
          f.fx.burst(cx, y + 10, { count: 30, colors: ['#ffb347', '#ffe066'], speed: 100 });
          f.fx.float(cx, y - 20, '+1', '#ffe066', 1.1, true);
          f.cue('coin');
        } else if (e.type === 'trample' || e.type === 'plot-damaged') {
          f.fx.hit(cx, y + 10, 'heavy', Math.PI / 2, ['#8a5a32', '#ff6b6b']);
          f.fx.dust(cx, y + 20, '#6a4428', 14);
          f.fx.flash('#ff2040', 0.2);
          f.cue('heavy');
        } else if (e.type === 'night') {
          f.fx.flash('#1a0a3a', 0.6);
        }
      }
      if (action.startsWith('water')) {
        f.fx.splash(cx, y + 10, '#5ad1ff', 18);
        f.cue('splash');
      }
      if (action.startsWith('plant')) {
        f.fx.dust(cx, y + 20, '#6a4428', 10);
        f.fx.burst(cx, y + 20, { count: 12, colors: ['#7ad94f'], speed: 40 });
        f.cue('land');
      }
    },
  };
}

const module: GameModule<PumpkinState> = { definition, createScene };
export default module;
