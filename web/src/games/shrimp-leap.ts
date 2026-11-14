import { definition } from '@games/shrimp-leap/src/definition';
import type { LeapState } from '@games/shrimp-leap/src/engine';
import { fog, moon, ridge, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { type Ctx, easeInOut, hash01, mix, rect, VH, VW } from '../gfx/pixel';
import type { GameModule, GameScene, HitRegion } from '../gfx/scene';
import { buildSprite, SLIME } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, pips, plate, shadow } from '../gfx/world';

const PX_PER_M = 15;
const STREET_Y = 196;
const COLORS: Record<string, string> = {
  coral: '#ff7a59',
  mint: '#7cf0a0',
  amber: '#ffc24a',
  lilac: '#c49aff',
};

function slimeSprite(color: string | null) {
  const c = COLORS[color ?? 'mint'] ?? '#7cf0a0';
  return buildSprite(
    SLIME,
    { b: c, h: mix(c, '#ffffff', 0.6), d: mix(c, '#000000', 0.4) },
    { rim: '#ffffff' },
  );
}

function lampTop(height: number): number {
  return STREET_Y - 36 - height * 9;
}

function drawLamp(g: Ctx, x: number, height: number, t: number, i: number, target: boolean): void {
  const top = lampTop(height);
  const flick = hash01(i, Math.floor(t * 8)) > 0.97 ? 0.4 : 1;
  glow(g, x, top + 4, target ? 36 : 26, '#ffe9a0', (target ? 0.55 : 0.4) * flick);
  // Light cone onto the street.
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = `rgba(255,233,160,${(0.05 * flick).toFixed(3)})`;
  g.beginPath();
  g.moveTo(x - 4, top + 6);
  g.lineTo(x + 4, top + 6);
  g.lineTo(x + 26, STREET_Y);
  g.lineTo(x - 26, STREET_Y);
  g.fill();
  g.globalCompositeOperation = 'source-over';
  rect(g, x - 2, top + 6, 4, STREET_Y - top - 6, '#2a3458');
  rect(g, x - 2, top + 6, 1, STREET_Y - top - 6, '#4a5a8a');
  rect(g, x - 4, STREET_Y - 4, 8, 4, '#1a2240');
  rect(g, x - 9, top, 18, 3, target ? '#ffe066' : '#5a6a9a');
  rect(g, x - 9, top, 18, 1, '#a0b0e0');
  rect(g, x - 5, top + 3, 10, 4, '#fff4c0');
}

interface Hop {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fall: boolean;
  start: number;
}

function createScene(): GameScene<LeapState> {
  let cam = 0;
  let hop: Hop | null = null;
  let squash = 1;

  const lampX = (state: LeapState, idx: number) => (state.street[idx]?.x ?? idx * 5) * PX_PER_M;

  return {
    reset(f) {
      cam = lampX(f.state, Math.max(0, f.state.level - 1));
      hop = null;
    },
    anchor: () => ({ x: 120, y: 120 }),
    hits(state, actions): HitRegion[] {
      if (state.phase !== 'nature' && state.phase !== 'color') return [];
      return actions
        .filter((a) => a.id !== 'abort')
        .map((a, i, arr) => ({
          x: VW / 2 - (arr.length * 70) / 2 + i * 70,
          y: 60,
          w: 64,
          h: 90,
          actionId: a.id,
        }));
    },
    draw(f) {
      const { g, t, state } = f;
      const zone = Math.floor((state.level - 1) / 15);
      const skies = [
        ['#2a1650', '#1a1a4a', '#0c1430', '#060a18'],
        ['#3a1240', '#24123a', '#120a26', '#080612'],
        ['#0a2a40', '#0a1a34', '#061020', '#03070f'],
      ][Math.min(2, zone)]!;
      const cur = Math.max(0, state.level - 1);
      const focusX = lampX(state, cur) + 40;
      cam += (focusX - cam) * Math.min(1, f.dt * 2.5);
      const ox = Math.round(VW * 0.32 - cam);
      sky(g, skies, 0, VH, 12);
      stars(g, t, 5 + zone, 70, 110);
      moon(g, 320, 34, 9, '#fff6dc', '#c8b4ff');
      ridge(
        g,
        {
          seed: 4 + zone,
          base: 150,
          amp: 70,
          color: '#151a3a',
          kind: 'city',
          scale: 18,
          windows: '#3a3a6a',
        },
        -ox * 0.2,
      );
      fog(g, t, 120, 30, '#6a5aa8', 0.2, 2);
      ridge(
        g,
        {
          seed: 9 + zone,
          base: 182,
          amp: 50,
          color: '#0a0d22',
          kind: 'city',
          scale: 16,
          windows: '#a08a4a',
          edge: '#262c54',
        },
        -ox * 0.5,
      );
      rect(g, 0, STREET_Y, VW, VH - STREET_Y, '#0a0c1c');
      rect(g, 0, STREET_Y, VW, 1, '#3a4270');
      for (let x = (ox % 24) - 24; x < VW; x += 24) rect(g, x, STREET_Y + 8, 12, 1, '#2a3058');

      if (state.phase === 'nature' || state.phase === 'color') {
        const opts = f.actions.filter((a) => a.id !== 'abort');
        const col = state.phase === 'color';
        drawText(g, col ? '选一个颜色' : '选一种性格', VW / 2, 32, {
          color: '#ffe8d0',
          align: 'center',
          scale: 2,
        });
        opts.forEach((a, i) => {
          const x = VW / 2 - (opts.length * 70) / 2 + i * 70 + 32;
          const focus = f.focus?.id === a.id;
          const color = col
            ? (COLORS[a.id.split(':')[1] ?? ''] ?? '#7cf0a0')
            : (COLORS[state.color ?? ''] ?? ['#ff7a59', '#7cf0a0', '#c49aff'][i]!);
          glow(g, x, 110, focus ? 34 : 22, color, focus ? 0.55 : 0.3);
          const bounce = focus ? Math.abs(Math.sin(t * 6)) * 8 : Math.abs(Math.sin(t * 2 + i)) * 2;
          blit(g, slimeSprite(col ? (a.id.split(':')[1] ?? null) : state.color), x, 126 - bounce, {
            scale: 2,
            anchor: 'bc',
          });
          shadow(g, x, 128, 24);
          plate(
            g,
            a.label.split(/[：:（(]/)[0] ?? a.label,
            x,
            140,
            focus ? '#ffe066' : '#d8ccff',
            66,
          );
        });
        return;
      }

      // Lamps.
      const first = Math.max(0, cur - 3);
      for (let i = first; i < state.street.length; i += 1) {
        const x = Math.round(lampX(state, i) + ox);
        if (x < -30) continue;
        if (x > VW + 30) break;
        drawLamp(g, x, state.street[i]!.height, t, i, i === state.level);
        if (i === state.level) {
          const w = state.street[i]!;
          if (w.wind)
            drawText(g, w.wind > 0 ? '风 →' : '← 风', x, lampTop(w.height) - 26, {
              color: '#9fe4ff',
              align: 'center',
            });
        }
      }

      // Slime.
      const size = 1.5 + state.size * 0.4;
      const base = state.street[cur];
      let sx = lampX(state, cur) + ox;
      let sy = lampTop(base?.height ?? 4);
      let rot = 0;
      if (hop) {
        const k = Math.min(1, (t - hop.start) / 0.75);
        const e = easeInOut(k);
        sx = hop.fromX + (hop.toX - hop.fromX) * e + ox;
        const peak = Math.min(hop.fromY, hop.toY) - 46;
        sy = (1 - e) * (1 - e) * hop.fromY + 2 * (1 - e) * e * peak + e * e * hop.toY;
        if (hop.fall && k >= 1) sy = hop.toY + Math.min(80, (t - hop.start - 0.75) * 260);
        rot = k;
        if (k < 1 && Math.random() < 0.6)
          f.fx.mote(sx, sy - 6, -10, 4, COLORS[state.color ?? 'mint'] ?? '#7cf0a0', 0.4, 1);
        if (t - hop.start > (hop.fall ? 1.3 : 0.75)) {
          hop = null;
          squash = 1.5;
        }
      }
      squash += (1 - squash) * Math.min(1, f.dt * 10);
      const idle = hop ? 1 : 1 + Math.sin(t * 5) * 0.06;
      glow(g, sx, sy - 6, 18 * size, COLORS[state.color ?? 'mint'] ?? '#7cf0a0', 0.3);
      if (!hop) shadow(g, sx, sy + 1, 14 * size);
      blit(g, slimeSprite(state.color), sx, sy + 1, {
        scale: size,
        anchor: 'bc',
        squash: squash * idle * (rot > 0 && rot < 1 ? 0.85 : 1),
      });

      // Rescue partner stuck to a lamp.
      if (state.phase === 'rescue' && state.rescue) {
        const px = sx + 34;
        const wob = Math.sin(t * 9) * 2;
        blit(g, slimeSprite(state.color === 'lilac' ? 'mint' : 'lilac'), px + wob, sy + 1, {
          scale: 1,
          anchor: 'bc',
        });
        for (let i = 0; i < 5; i += 1)
          rect(g, sx + 6 + i * 5, sy - 6 + Math.round(Math.sin(t * 4 + i) * 2), 3, 2, '#c8ffda');
        plate(g, `黏连救援 · ${state.rescue.partner}`, (sx + px) / 2, sy - 44, '#ffe066', 160);
      }
    },
    hud(f) {
      const { g, t, state } = f;
      if (state.phase === 'nature' || state.phase === 'color') return;
      drawText(g, `第 ${state.level}/45 关`, 8, 20, { color: '#ffe066' });
      pips(
        g,
        8,
        36,
        15,
        ((state.cleared - 1) % 15) + 1 > 0 ? state.cleared % 15 : 0,
        '#7cf0a0',
        state.cleared % 15,
        t,
      );
      const lj = state.lastJump;
      if (lj && f.since < 2.2) {
        const names: Record<string, [string, string]> = {
          perfect: ['完美落地!', '#ffe066'],
          clean: ['稳稳落地', '#9dffb0'],
          edge: ['擦边!', '#ffb347'],
          short: ['跳短了…', '#ff8a8a'],
          long: ['跳过头…', '#ff8a8a'],
        };
        const [txt, col] = names[lj.result] ?? ['', '#fff'];
        drawText(g, txt, VW / 2, 52, {
          color: col,
          align: 'center',
          scale: 2,
          alpha: Math.min(1, 2.2 - f.since),
        });
      }
    },
    react(f, o) {
      const state = o.state;
      const jump = o.events.find((e) => e.type === 'jump');
      if (jump) {
        const level = Number(jump.level);
        const from = Math.max(0, level - 1);
        const fromX = lampX(state, from);
        const fromY = lampTop(state.street[from]?.height ?? 4);
        const toX = fromX + Number(jump.landing) * PX_PER_M;
        const target = state.street[level];
        const fall = jump.result === 'short' || jump.result === 'long';
        hop = { fromX, fromY, toX, toY: lampTop(target?.height ?? 4), fall, start: f.t };
        if (jump.result === 'perfect') {
          f.fx.burst(toX - cam + VW * 0.32 + 40, lampTop(target?.height ?? 4), {
            count: 30,
            colors: ['#ffe066', '#ffffff', '#7cf0a0'],
            speed: 90,
            life: 1,
          });
          f.fx.freeze(0.05);
        }
        if (fall) {
          f.fx.shake(4, 0.4);
          f.fx.flash('#ff2040', 0.2);
        } else f.fx.shake(1.5, 0.15);
      } else if (o.events.some((e) => e.type === 'rescue' || e.type === 'rescue-success')) {
        f.fx.burst(VW * 0.4, 120, { count: 24, colors: ['#c8ffda', '#ffffff'], speed: 70 });
      }
      if (o.events.some((e) => e.type === 'grow' || e.type === 'growth')) {
        f.fx.flash('#ffffff', 0.5);
        f.fx.burst(VW * 0.32, 120, { count: 60, colors: ['#ffe066', '#ffffff'], speed: 140 });
      }
    },
  };
}

const module: GameModule<LeapState> = { definition, createScene };
export default module;
