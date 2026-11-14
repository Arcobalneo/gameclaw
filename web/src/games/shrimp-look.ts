import { definition } from '@games/shrimp-look/src/definition';
import type { LookState } from '@games/shrimp-look/src/model';
import { type Grade, LightMask } from '../gfx/art';
import { glow } from '../gfx/fx';
import {
  type Ctx,
  ctx2d,
  dither,
  hash01,
  hashString,
  makeCanvas,
  mix,
  rect,
  VH,
  VW,
  withAlpha,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, GHOST } from '../gfx/sprites';
import { drawText, fitText } from '../gfx/text';
import { tiny } from '../gfx/tiny';
import { blit, plate } from '../gfx/world';

const WALL_TOP = 30;
const HORIZON = 120;

interface Prop {
  id: string;
  label: string;
  x: number;
  kind: 'inspect' | 'interact' | 'move';
}

function propsOf(actions: readonly { id: string; label: string }[]): Prop[] {
  const inspect = actions.filter(
    (a) => a.id.startsWith('inspect:') || a.id.startsWith('interact:'),
  );
  const moves = actions.filter((a) => a.id.startsWith('move:'));
  const props: Prop[] = inspect.map((a, i) => ({
    id: a.id,
    label: a.label,
    x: 120 + ((i + 0.5) * 150) / Math.max(1, inspect.length),
    kind: a.id.startsWith('inspect:') ? 'inspect' : 'interact',
  }));
  for (const [i, a] of moves.entries())
    props.push({ id: a.id, label: a.label, x: i % 2 ? 342 : 42, kind: 'move' });
  return props;
}

const L = 64;
const R = VW - 64;
const roomCache = new Map<string, HTMLCanvasElement>();

function poly(g: Ctx, pts: number[], color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]!, pts[i + 1]!);
  g.closePath();
  g.fill();
}

/** One-point-perspective room, cached per room seed and dread band. */
function roomCanvas(seed: number, dread: number): HTMLCanvasElement {
  const band = Math.min(3, Math.floor(dread / 3));
  const key = `${seed}:${band}`;
  const hit = roomCache.get(key);
  if (hit) return hit;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  const wall = mix(['#2a2a44', '#2e2440', '#32203a', '#381a2a'][band]!, '#1a1a2a', 0.2);
  rect(g, 0, 0, VW, VH, '#05050c');
  // Ceiling, floor, side walls.
  poly(g, [0, 0, VW, 0, R, WALL_TOP, L, WALL_TOP], mix(wall, '#000000', 0.6));
  poly(g, [L, HORIZON, R, HORIZON, VW, VH, 0, VH], '#2a1c14');
  poly(g, [0, 0, L, WALL_TOP, L, HORIZON, 0, VH], mix(wall, '#000000', 0.35));
  poly(g, [VW, 0, R, WALL_TOP, R, HORIZON, VW, VH], mix(wall, '#000000', 0.5));
  // Back wall with damask wallpaper + wainscot.
  rect(g, L, WALL_TOP, R - L, HORIZON - WALL_TOP, wall);
  for (let y = WALL_TOP + 4; y < HORIZON - 26; y += 12)
    for (let x = L + 6 + ((y / 12) % 2) * 8; x < R - 4; x += 16) {
      rect(g, x, y, 3, 1, mix(wall, '#ffffff', 0.08));
      rect(g, x + 1, y - 1, 1, 3, mix(wall, '#ffffff', 0.08));
    }
  rect(g, L, HORIZON - 26, R - L, 26, mix(wall, '#3a2010', 0.6));
  rect(g, L, HORIZON - 26, R - L, 2, mix(wall, '#c8a070', 0.25));
  for (let x = L + 8; x < R; x += 24) rect(g, x, HORIZON - 20, 16, 14, mix(wall, '#2a1408', 0.7));
  // Stains + peeling paper grow with dread.
  for (let i = 0; i < band * 5; i += 1) {
    const x = L + hash01(i, seed) * (R - L - 20);
    const y = WALL_TOP + hash01(i, seed + 1) * 50;
    dither(g, x, y, 10 + (i % 3) * 6, 8 + (i % 2) * 8, '#120608', 0.4);
  }
  // Floor boards converging to the vanishing point.
  for (let y = HORIZON; y < VH; y += 1) {
    const k = (y - HORIZON) / (VH - HORIZON);
    rect(g, L - L * k, y, R - L + (VW - R + L) * k, 1, mix('#20140e', '#3a2618', k));
  }
  g.strokeStyle = '#140c08';
  for (let i = -8; i <= 8; i += 1) {
    g.beginPath();
    g.moveTo(VW / 2 + i * ((R - L) / 16), HORIZON);
    g.lineTo(VW / 2 + i * (VW / 10), VH);
    g.stroke();
  }
  for (const yy of [132, 150, 178]) rect(g, 0, yy, VW, 1, withAlpha('#140c08', 0.6));
  // Edges of the box.
  g.strokeStyle = withAlpha('#000000', 0.6);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(L, WALL_TOP);
  g.lineTo(L, HORIZON);
  g.lineTo(0, VH);
  g.moveTo(VW, 0);
  g.lineTo(R, WALL_TOP);
  g.lineTo(R, HORIZON);
  g.lineTo(VW, VH);
  g.stroke();
  // Rug.
  poly(g, [150, 140, 234, 140, 262, 196, 122, 196], '#4a1a22');
  poly(g, [154, 143, 230, 143, 256, 193, 128, 193], '#6a2a2e');
  roomCache.set(key, c);
  return c;
}

function drawRoom(g: Ctx, seed: number, dread: number, t: number): void {
  g.drawImage(roomCanvas(seed, dread), 0, 0);
  const flick = hash01(seed, Math.floor(t * 10)) > 0.92 ? 0.1 : 1;
  rect(g, VW / 2 - 1, 0, 1, 14, '#3a3a4a');
  rect(g, VW / 2 - 3, 14, 6, 4, flick > 0.5 ? '#fff4c0' : '#4a4a3a');
  glow(g, VW / 2, 18, 40, '#ffe9a0', 0.2 * flick);
}

function drawProp(g: Ctx, p: Prop, t: number, focus: boolean): void {
  const y = HORIZON + 4;
  const seed = hashString(p.id);
  if (p.kind === 'move') {
    const left = p.x < VW / 2;
    const x = left ? 14 : VW - 46;
    rect(g, x, 50, 32, 90, '#120a08');
    rect(g, x + 2, 52, 28, 88, '#2a1a10');
    rect(g, left ? x + 24 : x + 4, 96, 3, 3, '#c8a050');
    if (focus) glow(g, x + 16, 96, 30, '#ffe9a0', 0.35);
    for (let k = 0; k < 4; k += 1) {
      const ax = x + 16 + (left ? 3 - k : k - 3) * 1;
      rect(g, ax, 38 - k, 1, k * 2 + 1, focus ? '#ffe066' : '#6a6a8a');
    }
    return;
  }
  const kind = seed % 4;
  const x = Math.round(p.x);
  if (kind === 0) {
    // Shelf.
    rect(g, x - 18, y - 52, 36, 52, '#2a1a12');
    for (let r = 0; r < 4; r += 1) {
      rect(g, x - 16, y - 50 + r * 13, 32, 1, '#4a3020');
      for (let b = 0; b < 6; b += 1)
        rect(
          g,
          x - 15 + b * 5,
          y - 49 + r * 13,
          4,
          11,
          mix('#5a3a6a', '#2a4a5a', hash01(b + r * 7, seed)),
        );
    }
  } else if (kind === 1) {
    // Desk + lamp.
    rect(g, x - 20, y - 18, 40, 4, '#3a2418');
    rect(g, x - 18, y - 14, 3, 14, '#2a1810');
    rect(g, x + 15, y - 14, 3, 14, '#2a1810');
    rect(g, x + 6, y - 30, 2, 12, '#6a6a7a');
    rect(g, x + 2, y - 32, 10, 3, '#9a8a5a');
    glow(g, x + 7, y - 24, 16, '#ffe9a0', 0.35 + 0.1 * Math.sin(t * 7 + seed));
  } else if (kind === 2) {
    // Framed picture.
    rect(g, x - 14, y - 70, 28, 22, '#6a4a20');
    rect(g, x - 12, y - 68, 24, 18, '#1a2a2a');
    rect(g, x - 4, y - 64, 8, 8, '#3a4a4a');
  } else {
    // Filing cabinet.
    rect(g, x - 12, y - 40, 24, 40, '#3a3a4a');
    for (let r = 0; r < 3; r += 1) {
      rect(g, x - 10, y - 38 + r * 13, 20, 11, '#4a4a5a');
      rect(g, x - 3, y - 34 + r * 13, 6, 2, '#9a9aaa');
    }
  }
  if (focus) glow(g, x, y - 30, 28, '#9fc4ff', 0.3);
}

function createScene(): GameScene<LookState> {
  let beam = VW / 2;
  let scareT = -10;
  const lights = new LightMask();

  return {
    anchor: () => ({ x: VW / 2, y: 90 }),
    hits(state, actions): HitRegion[] {
      if (state.phase !== 'exploring') return [];
      return propsOf(actions).map((p) =>
        p.kind === 'move'
          ? { x: p.x < VW / 2 ? 14 : VW - 46, y: 50, w: 32, h: 90, actionId: p.id }
          : { x: p.x - 20, y: HORIZON - 70, w: 40, h: 76, actionId: p.id },
      );
    },
    draw(f) {
      const { g, t, state } = f;
      const seed = hashString(state.roomId ?? state.caseId ?? 'x');
      drawRoom(g, seed, state.dread, t);
      if (state.phase === 'case-select') {
        const cases = f.actions.filter((a) => a.id !== 'abort');
        cases.forEach((a, i) => {
          const focus = f.focus?.id === a.id;
          const x = VW / 2 - ((cases.length - 1) * 76) / 2 + i * 76;
          const y = 150 - (focus ? 6 : 0) + Math.round(Math.sin(t * 2 + i) * 1);
          // Case folder on the rug.
          rect(g, x - 24, y - 30, 48, 34, withAlpha('#000000', 0.4));
          rect(g, x - 26, y - 34, 18, 5, '#b8904a');
          rect(g, x - 26, y - 30, 52, 32, focus ? '#e8c070' : '#9a7a44');
          rect(g, x - 26, y - 30, 52, 1, '#ffe0a0');
          rect(g, x - 20, y - 22, 26, 2, '#6a4a20');
          rect(g, x - 20, y - 16, 34, 1, '#8a6a30');
          rect(g, x - 20, y - 12, 30, 1, '#8a6a30');
          rect(g, x + 10, y - 26, 12, 14, '#2a2a3a');
          rect(g, x + 12, y - 24, 8, 6, '#6a7a9a');
          tiny(g, `${i + 1}`, x - 20, y - 7, { color: '#4a2a10' });
          if (focus) {
            glow(g, x, y - 14, 40, '#ffe9a0', 0.35);
            const lb = say(f, a.label);
            if (lb) plate(g, fitText(lb, 240), VW / 2, 60, '#ffe066', 260);
          }
        });
        return;
      }
      const props = propsOf(f.actions);
      const target = props.find((p) => p.id === f.focus?.id)?.x ?? VW / 2 + Math.sin(t * 0.6) * 60;
      beam += (target - beam) * Math.min(1, f.dt * 4);
      for (const p of props) drawProp(g, p, t, p.id === f.focus?.id);
      // Phenomenon: ghost + ASCII glyphs on the wall.
      const ph = state.currentPhenomenon;
      if (ph) {
        const flick = Math.sin(t * 11) > 0.7 ? 0.35 : 0.8;
        const gx = 300 + Math.sin(t * 0.7) * 20;
        glow(g, gx, 70, 34, '#9fc4ff', 0.25);
        blit(g, buildSprite(GHOST, {}, { outline: null }), gx, 92 + Math.sin(t * 2) * 4, {
          anchor: 'bc',
          scale: 2,
          alpha: flick,
        });
        for (const [i, line] of ph.ascii.slice(0, 4).entries())
          drawText(g, line, 92, 40 + i * 12, { color: '#9fc4ff', outline: null, alpha: 0.65 });
        const title = say(f, ph.title);
        if (title) plate(g, fitText(title, 160), VW / 2, 22, '#cfe8ff', 220);
      }
      // Darkness: flashlight cone from the viewer + the bulb pool.
      lights.begin('#020208', 0.5 + Math.min(0.3, state.dread * 0.035));
      lights.cone(VW / 2, VH + 10, Math.atan2(HORIZON - 40 - VH - 10, beam - VW / 2), 0.32, 210, 1);
      lights.light(VW / 2, 20, 70, 0.55);
      lights.light(beam, HORIZON - 30, 40, 0.5);
      lights.end(g);
      // Dread static.
      if (state.dread >= 4)
        dither(g, 0, Math.floor(hash01(Math.floor(t * 20), 9) * VH), VW, 3, '#ffffff', 0.15);
      if (scareT >= 0 && f.since < 0.35) {
        g.fillStyle = withAlpha('#ffffff', 0.4 * (1 - f.since / 0.35));
        g.fillRect(0, 0, VW, VH);
      }
    },
    grade: (s): Grade => ({
      top: s.dread >= 6 ? '#ff90a0' : '#b0c8ff',
      bottom: '#020208',
      strength: 0.3,
      bloom: 0.55,
    }),
    hud(f) {
      const { g, state } = f;
      if (state.phase === 'case-select') return;
      if (state.latestWitness && f.since < 4) {
        const w = say(f, state.latestWitness);
        if (w) plate(g, fitText(w, 300), VW / 2, 194, '#cfe8ff', 320);
      }
    },
    react(f, o) {
      const ev = o.events[0];
      if (!ev) return;
      if (ev.type === 'inspect' && Number(ev.severity) >= 3) {
        scareT = 0;
        f.fx.addTrauma(0.2 + Number(ev.severity) * 0.08);
        f.fx.impact(1);
        f.cue('heavy');
      } else if (ev.type === 'record') {
        f.fx.burst(VW / 2, 90, { count: 28, colors: ['#ffe066', '#ffffff'], speed: 90 });
        f.fx.float(VW / 2, 70, '+1', '#ffe066', 1.1, true);
        f.cue('coin');
      } else if (ev.type === 'move') f.fx.flash('#000000', 0.8);
      else if (ev.type === 'brace')
        f.fx.burst(VW / 2, 120, { count: 16, colors: ['#7cf0a0'], speed: 50, gravity: -20 });
    },
  };
}

const module: GameModule<LookState> = { definition, createScene };
export default module;
