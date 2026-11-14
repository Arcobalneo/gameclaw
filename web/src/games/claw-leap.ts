import { definition } from '@games/claw-leap/src/definition';
import type { LeapState } from '@games/claw-leap/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  type Ctx,
  ctx2d,
  easeInOut,
  hash01,
  makeCanvas,
  mix,
  rect,
  VH,
  VW,
  withAlpha,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SLIME } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { tiny } from '../gfx/tiny';
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

/* Clean skyline: two cached, tileable layers with sparse warm windows and soft haze. */
const SKY_W = 768;
const skyline = new Map<string, HTMLCanvasElement>();
function skylineLayer(zone: number, far: boolean): HTMLCanvasElement {
  const key = `${zone}:${far}`;
  const hit = skyline.get(key);
  if (hit) return hit;
  const c = makeCanvas(SKY_W, VH);
  const g = ctx2d(c);
  const body = far
    ? ['#1c2050', '#2a1a48', '#12304a'][zone]!
    : ['#0c0e26', '#140a22', '#081624'][zone]!;
  const lit = far ? '#3a3a6a' : '#b08850';
  const base = far ? 160 : 190;
  let x = 0;
  let i = 0;
  while (x < SKY_W) {
    const w = (far ? 18 : 26) + Math.floor(hash01(i, far ? 3 : 9) * (far ? 22 : 30));
    const h = (far ? 30 : 34) + Math.floor(hash01(i, far ? 5 : 11) * (far ? 60 : 62));
    const top = base - h;
    rect(g, x, top, w, VH - top, body);
    // Lit edge toward the moon (top-right) and rooftop details.
    rect(g, x + w - 1, top, 1, base - top, mix(body, '#8a7ac8', far ? 0.25 : 0.18));
    rect(g, x, top, w, 1, mix(body, '#8a7ac8', 0.3));
    if (hash01(i, 21) > 0.6) rect(g, x + 4, top - 6, 2, 6, body);
    if (!far && hash01(i, 23) > 0.7) {
      rect(g, x + w / 2 - 4, top - 5, 8, 5, body);
      rect(g, x + w / 2, top - 12, 1, 7, body);
      rect(g, x + w / 2, top - 13, 1, 1, '#ff5d73');
    }
    // Sparse windows in a regular grid; most are dark.
    for (let wy = top + 6; wy < base - 6; wy += far ? 6 : 8)
      for (let wx = x + 3; wx < x + w - 4; wx += far ? 5 : 6)
        if (hash01(wx * 7 + wy, i) > (far ? 0.9 : 0.9))
          rect(g, wx, wy, far ? 1 : 2, far ? 2 : 3, lit);
    x += w + (far ? 1 : 2 + Math.floor(hash01(i, 13) * 6));
    i += 1;
  }
  // Haze toward the base so layers separate.
  for (let y = base - 40; y < VH; y += 1) {
    g.fillStyle = withAlpha(
      far ? '#5a4a98' : '#1a1a3a',
      Math.min(0.55, ((y - base + 40) / 80) * (far ? 0.8 : 0.6)),
    );
    g.fillRect(0, y, SKY_W, 1);
  }
  skyline.set(key, c);
  return c;
}

function tileLayer(g: Ctx, layer: HTMLCanvasElement, offset: number): void {
  const o = ((Math.round(offset) % SKY_W) + SKY_W) % SKY_W;
  g.drawImage(layer, -o, 0);
  g.drawImage(layer, SKY_W - o, 0);
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
          x: VW / 2 - (arr.length * 84) / 2 + i * 84,
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
      tileLayer(g, skylineLayer(Math.min(2, zone), true), -ox * 0.15);
      tileLayer(g, skylineLayer(Math.min(2, zone), false), -ox * 0.4);
      rect(g, 0, STREET_Y, VW, VH - STREET_Y, '#0a0c1c');
      rect(g, 0, STREET_Y, VW, 1, '#3a4270');
      for (let x = (ox % 24) - 24; x < VW; x += 24) rect(g, x, STREET_Y + 8, 12, 1, '#2a3058');
      rect(g, 0, STREET_Y + 1, VW, 2, '#151a34');

      if (state.phase === 'nature' || state.phase === 'color') {
        const opts = f.actions.filter((a) => a.id !== 'abort');
        const col = state.phase === 'color';
        opts.forEach((a, i) => {
          const x = VW / 2 - (opts.length * 84) / 2 + i * 84 + 32;
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
            say(f, a.label.split(/[：:（(]/)[0] ?? a.label) || a.id.split(':')[1]!.toUpperCase(),
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
          if (w.wind) {
            const dir = w.wind > 0 ? 1 : -1;
            const wy = lampTop(w.height) - 26;
            for (let k = 0; k < 3; k += 1) {
              const ph = (t * 1.6 + k / 3) % 1;
              const lx = Math.round(x - 20 + ph * 40 * dir + (dir < 0 ? 40 : 0));
              rect(g, lx, wy + k * 5, 10, 1, withAlpha('#9fe4ff', Math.sin(ph * Math.PI) * 0.9));
            }
          }
        }
      }

      // Slime.
      const size = 1.5 + state.size * 0.4;
      const base = state.street[cur];
      let sx = lampX(state, cur) + ox;
      let sy = lampTop(base?.height ?? 4);
      let rot = 0;
      if (hop && t < hop.start) {
        squash = 0.65;
        sx = hop.fromX + ox;
        sy = hop.fromY;
      } else if (hop) {
        const k = Math.min(1, (t - hop.start) / 0.75);
        const e = easeInOut(k);
        sx = hop.fromX + (hop.toX - hop.fromX) * e + ox;
        const peak = Math.min(hop.fromY, hop.toY) - 46;
        sy = (1 - e) * (1 - e) * hop.fromY + 2 * (1 - e) * e * peak + e * e * hop.toY;
        if (hop.fall && k >= 1) sy = hop.toY + Math.min(80, (t - hop.start - 0.75) * 260);
        rot = k;
        if (k < 1 && Math.random() < 0.6)
          f.fx.mote(sx, sy - 6, -10, 4, COLORS[state.color ?? 'mint'] ?? '#7cf0a0', 0.4, 1);
        if (k < 0.15) squash = 1.35;
        if (t - hop.start > (hop.fall ? 1.3 : 0.75)) {
          if (!hop.fall) {
            f.fx.dust(sx, sy, '#8a7ac8', 8);
            f.cue('land');
          }
          hop = null;
          squash = 0.6;
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
        glow(g, (sx + px) / 2, sy - 8, 26, '#c8ffda', 0.3 + 0.1 * Math.sin(t * 5));
      }
    },
    grade(state): Grade {
      const zone = Math.min(2, Math.floor((state.level - 1) / 15));
      return {
        top: ['#c8a0ff', '#ff90c0', '#80d0ff'][zone]!,
        bottom: '#05030c',
        strength: 0.28,
        bloom: 0.7,
      };
    },
    hud(f) {
      const { g, t, state } = f;
      if (state.phase === 'nature' || state.phase === 'color') return;
      tiny(g, `${state.level}/45`, 8, 9, { color: '#ffe066' });
      pips(g, 36, 8, 15, state.cleared % 15, '#7cf0a0', state.cleared % 15, t);
      const lj = state.lastJump;
      if (lj && f.since < 1.8) {
        const names: Record<string, [string, string, string]> = {
          perfect: ['完美落地!', 'PERFECT!', '#ffe066'],
          clean: ['稳稳落地', 'CLEAN', '#9dffb0'],
          edge: ['擦边!', 'EDGE!', '#ffb347'],
          short: ['跳短了…', 'SHORT', '#ff8a8a'],
          long: ['跳过头…', 'TOO FAR', '#ff8a8a'],
        };
        const [zh, en, col] = names[lj.result] ?? ['', '', '#fff'];
        const k = Math.min(1, f.since / 0.18);
        const alpha = Math.min(1, 1.8 - f.since);
        const y = Math.round(58 - (1 - k) * 8);
        if (f.lang === 'zh')
          drawText(g, zh, VW / 2, y, { color: col, align: 'center', scale: 2, alpha });
        else tiny(g, en, VW / 2, y, { color: col, align: 'center', scale: 3, alpha });
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
        hop = { fromX, fromY, toX, toY: lampTop(target?.height ?? 4), fall, start: f.t + 0.12 };
        f.cue('whoosh');
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
          f.fx.addTrauma(0.4);
          f.fx.flash('#ff2040', 0.2);
          f.cue('bad');
        } else f.fx.kick(0, 1.5);
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
