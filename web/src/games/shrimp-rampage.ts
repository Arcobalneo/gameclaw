import { definition } from '@games/shrimp-rampage/src/definition';
import type { PumpkinState } from '@games/shrimp-rampage/src/engine';
import { fog, moon, ridge, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { bar, type Ctx, dither, easeOutBack, hash01, rect, VH, VW } from '../gfx/pixel';
import type { GameModule, GameScene, HitRegion } from '../gfx/scene';
import { buildSprite, PUMPKIN, PUMPKIN_PLAIN, SPROUT } from '../gfx/sprites';
import { drawText } from '../gfx/text';
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
  rect(g, x, y, PLOT_W, PLOT_H, '#2a160e');
  rect(g, x, y, PLOT_W, 2, '#4a2a18');
  for (let r = 0; r < 4; r += 1) rect(g, x + 4, y + 7 + r * 7, PLOT_W - 8, 2, '#1e0e08');
  dither(g, x, y + PLOT_H - 6, PLOT_W, 6, '#140806', 0.5);
  // Fence posts = durability.
  for (let d = 0; d < 3; d += 1) {
    const px = x + PLOT_W - 6 - d * 6;
    rect(g, px, y - 6, 3, 8, d < durability ? '#a07a4a' : '#3a2a20');
    rect(g, px, y - 6, 3, 1, d < durability ? '#d0a870' : '#3a2a20');
  }
  if (focus) {
    const a = 0.5 + 0.5 * Math.sin(t * 8);
    g.strokeStyle = `rgba(255,224,102,${(0.5 + a * 0.5).toFixed(2)})`;
    g.strokeRect(x - 1.5, y - 1.5, PLOT_W + 3, PLOT_H + 3);
  }
}

function createScene(): GameScene<PumpkinState> {
  const pulses = new Map<number, number>();

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
      // Farmhouse with lit window.
      rect(g, 8, 52, 28, 32, '#24141e');
      rect(g, 4, 48, 36, 6, '#3a1e28');
      rect(g, 16, 62, 8, 8, '#ffcf6a');
      glow(g, 20, 66, 18, '#ffb347', 0.4);

      const focusPlot = f.focus ? plotOf(f.focus.id, state) : -1;
      state.plots.forEach((plot, i) => {
        const { x, y } = plotRect(i);
        drawPlot(g, x, y, plot.durability, focusPlot === i, t);
        const cx = x + PLOT_W / 2;
        const bump = pulses.has(i) ? easeOutBack(Math.min(1, (t - pulses.get(i)!) / 0.4)) : 1;
        if (plot.stage === 1) {
          for (let k = 0; k < 3; k += 1)
            blit(g, buildSprite(SPROUT), x + 14 + k * 24, y + 20, {
              anchor: 'bc',
              squash: 1 / bump,
            });
        } else if (plot.stage === 2) {
          glow(g, cx, y + 12, 22, '#ffb347', 0.35);
          blit(g, buildSprite(PUMPKIN_PLAIN, {}, { rim: '#ffe0a0' }), cx - 20, y + 22, {
            anchor: 'bc',
            scale: 1.5 * bump,
          });
          blit(g, buildSprite(PUMPKIN_PLAIN, {}, { rim: '#ffe0a0' }), cx + 16, y + 24, {
            anchor: 'bc',
            scale: 1.2 * bump,
          });
        }
        drawText(g, plot.name, x + 4, y + PLOT_H + 2, {
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
            drawText(g, '!'.repeat(Math.min(3, m.agitation)), cx + 14, y - 8 - hop, {
              color: '#ff4d6d',
            });
        } else if (m.hinted) {
          const r = Math.sin(t * 7 + i) > 0 ? 1 : 0;
          for (let k = 0; k < 5; k += 1)
            rect(g, cx - 10 + k * 5 + r, y + 10 + (k % 2) * 3, 2, 4, '#3a7a2a');
          glow(g, cx, y + 10, 14, '#ff8a1e', 0.2 + 0.15 * Math.sin(t * 4));
          drawText(g, '?', cx, y - 6, { color: '#ffb347', align: 'center' });
        }
      }
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
    hud(f) {
      const { g, t, state } = f;
      drawText(g, `第 ${state.night}/4 夜${state.night >= 3 ? ' · 暴走' : ''}`, 8, 20, {
        color: state.night >= 3 ? '#ff6b6b' : '#ffd0a0',
      });
      pips(g, 8, 36, state.actionCap, state.actionsUsed, '#ffb347', state.actionsUsed, t);
      drawText(g, '体力', 8, 46, { color: '#c8a0ff' });
      bar(g, 34, 50, 60, 4, state.stamina / Math.max(1, state.staminaCap), '#c8a0ff');
      drawText(
        g,
        `收成 ${state.pumpkins}/4  安抚 ${state.captured}/3  🍬${state.candy}`.replace('🍬', '糖'),
        VW - 8,
        20,
        { color: '#ffe066', align: 'right' },
      );
      const note = state.notes.at(-1);
      if (note && f.since < 3) plate(g, note, VW / 2, 60, '#fff0c8', 300);
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
          f.fx.shake(2, 0.2);
        } else if (e.type === 'monster-soothed') {
          f.fx.burst(cx, y, {
            count: 40,
            colors: ['#ff9ae0', '#ffffff', '#ffe066'],
            speed: 110,
            gravity: -30,
          });
          f.fx.float(cx, y - 30, '安抚成功!', '#ff9ae0');
        } else if (e.type === 'harvest') {
          f.fx.burst(cx, y + 10, { count: 30, colors: ['#ffb347', '#ffe066'], speed: 100 });
          f.fx.float(cx, y - 20, '+南瓜', '#ffe066');
        } else if (e.type === 'trample' || e.type === 'plot-damaged') {
          f.fx.shake(4, 0.3);
          f.fx.flash('#ff2040', 0.2);
        } else if (e.type === 'night') {
          f.fx.flash('#1a0a3a', 0.6);
        }
      }
      if (action.startsWith('water'))
        f.fx.burst(cx, y, { count: 20, colors: ['#5ad1ff', '#c8f0ff'], speed: 50, gravity: 160 });
      if (action.startsWith('plant'))
        f.fx.burst(cx, y + 20, { count: 12, colors: ['#7ad94f'], speed: 40 });
    },
  };
}

const module: GameModule<PumpkinState> = { definition, createScene };
export default module;
