import { definition } from '@games/claw-heist/src/definition';
import {
  type Direction,
  type HeistState,
  mapRows,
  resolveMove,
} from '@games/claw-heist/src/engine';
import { humanoid } from '../gfx/actors';
import { type Grade, LightMask } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  type Ctx,
  ctx2d,
  dither,
  hash01,
  makeCanvas,
  mix,
  rect,
  VH,
  VW,
  withAlpha,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, CAMERA_EYE, CHEST, SHRIMP, SHRIMP_WALK } from '../gfx/sprites';
import { tiny } from '../gfx/tiny';
import { blit, plate, shadow } from '../gfx/world';

const CELL_W = 48;
const CELL_H = 64;
const X0 = 24;
const ROW_Y = [38, 38 + CELL_H + 10];
const HERO_PAL = { b: '#8a6ae0', h: '#c8b0ff', d: '#3a2a7a', t: '#6a4ac0', c: '#b090ff' };

interface Cell {
  actor: string;
  feature: string;
}

function parse(state: HeistState): Cell[][] {
  return mapRows(state).map((row) =>
    [...row.matchAll(/\[(.)(.)\]/g)].map((m) => ({ actor: m[1]!, feature: m[2]! })),
  );
}

const cellXY = (r: number, c: number) => ({ x: X0 + c * CELL_W, y: ROW_Y[r] ?? 38 });

function drawCell(g: Ctx, x: number, y: number, feature: string, t: number): void {
  const dark = feature === ':';
  if (dark) dither(g, x, y, CELL_W, CELL_H - 4, '#000000', 0.45);
  const cx = x + CELL_W / 2 - 1;
  const fy = y + CELL_H - 4;
  switch (feature) {
    case '#':
      rect(g, x + 6, fy - 18, 16, 18, '#5a3a22');
      rect(g, x + 6, fy - 18, 16, 1, '#8a5a32');
      rect(g, x + 22, fy - 12, 14, 12, '#4a2e1a');
      rect(g, x + 22, fy - 12, 14, 1, '#7a4a2a');
      break;
    case 'X':
      glow(g, cx, fy - 20, 22, '#7cf0a0', 0.35 + 0.1 * Math.sin(t * 3));
      rect(g, cx - 10, fy - 36, 20, 36, '#0e3a24');
      rect(g, cx - 10, fy - 36, 20, 2, '#7cf0a0');
      rect(g, cx - 9, fy - 46, 18, 8, '#0a2a18');
      tiny(g, 'EXIT', cx, fy - 44, { color: '#7cf0a0', align: 'center' });
      break;
    case 'T':
      rect(g, cx - 8, fy - 20, 16, 20, '#24304a');
      rect(g, cx - 6, fy - 18, 12, 8, Math.sin(t * 6) > 0 ? '#4fd1ff' : '#2a8ac0');
      glow(g, cx, fy - 14, 12, '#4fd1ff', 0.3);
      break;
    case '$':
      blit(g, buildSprite(CHEST), cx, fy, { anchor: 'bc' });
      break;
    case '?':
    case 'O':
    case 'E': {
      const color = feature === 'O' ? '#ffe066' : feature === 'E' ? '#4a4a6a' : '#b28dff';
      rect(g, cx - 9, fy - 14, 18, 14, feature === 'E' ? '#2a2a3a' : '#3a2a5a');
      rect(g, cx - 9, fy - 14, 18, 1, color);
      if (feature !== 'E') {
        glow(g, cx, fy - 8, 14, color, 0.3 + 0.15 * Math.sin(t * 4));
        tiny(g, feature === 'O' ? '★' : '?', cx, fy - 26 + Math.round(Math.sin(t * 3) * 2), {
          color,
          align: 'center',
          scale: 2,
        });
      }
      break;
    }
    case 'V':
      rect(g, cx - 8, y + 4, 16, 8, '#2a2f4a');
      for (let i = 0; i < 4; i += 1) rect(g, cx - 7 + i * 4, y + 5, 2, 6, '#0a0a1a');
      break;
    case '~':
      for (let i = 0; i < 6; i += 1) {
        const yy = fy - ((t * 30 + i * 9) % 50);
        rect(g, cx - 8 + ((i * 5) % 16), yy, 3, 3, withAlpha('#ffffff', 0.35));
      }
      break;
  }
}

/** Cached cross-section: brick shell, two floors of rooms with wainscot and slabs. */
let shell: HTMLCanvasElement | null = null;
function building(cols: number): HTMLCanvasElement {
  if (shell) return shell;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#1a1030', '#0e0820', '#05030c'], 0, VH, 8);
  // Outer brick.
  for (let y = 0; y < VH; y += 6)
    for (let x = (y / 6) % 2 ? -6 : 0; x < VW; x += 12) {
      rect(g, x, y, 11, 5, mix('#2a1a2e', '#3a2238', hash01(x, y)));
      rect(g, x, y, 11, 1, '#4a2e44');
    }
  const w = cols * CELL_W;
  for (const ry of ROW_Y) {
    // Interior wall + wainscot + floor slab.
    rect(g, X0 - 4, ry - 4, w + 6, CELL_H + 8, '#0a0614');
    for (let x = X0; x < X0 + w; x += 1) {
      const band = (x - X0) % CELL_W;
      g.fillStyle = band < 2 ? '#1a1430' : '#2a2448';
      g.fillRect(x, ry, 1, CELL_H - 22);
    }
    for (let x = X0; x < X0 + w; x += 6) rect(g, x, ry, 1, CELL_H - 22, '#262040');
    rect(g, X0, ry + CELL_H - 22, w, 18, '#3a2a3a');
    rect(g, X0, ry + CELL_H - 22, w, 2, '#5a4258');
    for (let x = X0; x < X0 + w; x += 12) rect(g, x, ry + CELL_H - 18, 1, 14, '#2a1e2c');
    rect(g, X0 - 4, ry + CELL_H - 4, w + 8, 6, '#4a4a5a');
    rect(g, X0 - 4, ry + CELL_H - 4, w + 8, 1, '#8a8aa0');
    rect(g, X0 - 4, ry + CELL_H + 2, w + 8, 2, '#141018');
    // Ceiling pipe + lamps.
    rect(g, X0, ry + 1, w, 3, '#3a3448');
    rect(g, X0, ry + 1, w, 1, '#6a6280');
    for (let i = 0; i < cols; i += 1) {
      const lx = X0 + i * CELL_W + CELL_W / 2;
      rect(g, lx - 1, ry + 4, 2, 4, '#2a2438');
      rect(g, lx - 4, ry + 8, 8, 2, '#5a5270');
    }
  }
  shell = c;
  return c;
}

function createScene(): GameScene<HeistState> {
  const lights = new LightMask();
  const guardSprite = (tint: string | null, flip: boolean, step: 0 | 1) =>
    buildSprite(
      humanoid({
        skin: '#e0b090',
        hair: '#2a1a14',
        style: 'cap',
        shirt: tint ?? '#3a4a7a',
        pants: '#1e2238',
        accent: '#ffd166',
        step,
      }),
      {},
      { flip },
    );
  let prevPos: [number, number] | null = null;
  let moveT = -10;
  let alarmT = -10;

  return {
    anchor: (s) => {
      const p = cellXY(s.position[0], s.position[1]);
      return { x: p.x + CELL_W / 2, y: p.y + 20 };
    },
    hits(state, actions): HitRegion[] {
      if (state.phase === 'setup') return [];
      return actions.flatMap((a) => {
        const m = /^move:([nsew])$/.exec(a.id);
        if (!m) return [];
        const mv = resolveMove(state, m[1] as Direction);
        if (!mv) return [];
        const { x, y } = cellXY(mv.pos[0], mv.pos[1]);
        return [{ x, y, w: CELL_W - 2, h: CELL_H, actionId: a.id }];
      });
    },
    draw(f) {
      const { g, t, state } = f;
      if (state.phase === 'setup' || !state.profile) {
        g.drawImage(building(7), 0, 0);
        g.fillStyle = withAlpha('#05030c', 0.72);
        g.fillRect(0, 0, VW, VH);
        f.actions
          .filter((a) => a.id !== 'abort')
          .forEach((a, i, arr) => {
            const x = VW / 2 - ((arr.length - 1) * 110) / 2 + i * 110;
            const focus = f.focus?.id === a.id;
            glow(g, x, 120, focus ? 40 : 22, '#b28dff', focus ? 0.5 : 0.25);
            blit(
              g,
              buildSprite(SHRIMP, HERO_PAL, { rim: '#ffffff' }),
              x,
              132 + Math.round(Math.sin(t * 3 + i) * (focus ? 3 : 1)),
              { anchor: 'bc', scale: 2 },
            );
            plate(
              g,
              say(f, a.label.split(/[：:（(·]/)[0] ?? a.label) ||
                a.id.split(':').pop()!.toUpperCase(),
              x,
              148,
              focus ? '#ffe066' : '#d8ccff',
              100,
            );
          });
        return;
      }
      const grid = parse(state);
      g.drawImage(building(grid[0]?.length ?? 7), 0, 0);
      for (const [r, row] of grid.entries())
        for (const [c, cell] of row.entries()) {
          const { x, y } = cellXY(r, c);
          drawCell(g, x, y, cell.feature, t);
        }
      // Camera scan + lights.
      for (const [r, row] of grid.entries())
        for (const [c, cell] of row.entries()) {
          if (cell.actor !== '^') continue;
          const { x, y } = cellXY(r, c);
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = withAlpha('#ff2a4a', 0.12 + 0.06 * Math.sin(t * 6));
          g.beginPath();
          g.moveTo(x + CELL_W / 2 - 2, y + 6);
          g.lineTo(x - 2, y + CELL_H - 4);
          g.lineTo(x + CELL_W, y + CELL_H - 4);
          g.fill();
          g.globalCompositeOperation = 'source-over';
          blit(g, buildSprite(CAMERA_EYE), x + CELL_W / 2 - 4, y + 2);
        }
      // Actors.
      for (const [r, row] of grid.entries())
        for (const [c, cell] of row.entries()) {
          const { x, y } = cellXY(r, c);
          const cx = x + CELL_W / 2 - 1;
          const fy = y + CELL_H - 4;
          if (cell.actor === 'P' || cell.actor === 'R' || cell.actor === 'W') {
            const tint = cell.actor === 'R' ? '#8a2a3a' : cell.actor === 'W' ? '#6a5a2a' : null;
            const flip = cell.actor === 'W' && state.watcherFacing === 'left';
            shadow(g, cx, fy, 14);
            blit(g, guardSprite(tint, flip, (Math.floor(t * 2 + c) % 2) as 0 | 1), cx, fy + 1, {
              anchor: 'bc',
            });
            const dir = flip ? -1 : 1;
            rect(g, cx + dir * 6, fy - 14, 3, 2, '#c8c8d0');
          }
        }
      // Hero (tweened between cells).
      const pos = state.position;
      const to = cellXY(pos[0], pos[1]);
      const from = prevPos ? cellXY(prevPos[0], prevPos[1]) : to;
      const k = Math.min(1, (t - moveT) / 0.3);
      const hx = from.x + (to.x - from.x) * k + CELL_W / 2 - 1;
      const hy = from.y + (to.y - from.y) * k + CELL_H - 4;
      const hidden =
        grid[pos[0]]?.[pos[1]]?.feature === ':' || grid[pos[0]]?.[pos[1]]?.feature === '#';
      shadow(g, hx, hy, 18);
      glow(g, hx, hy - 6, 16, '#b28dff', 0.35);
      blit(
        g,
        buildSprite(k < 1 && Math.floor(t * 12) % 2 ? SHRIMP_WALK : SHRIMP, HERO_PAL, {
          rim: '#ffffff',
        }),
        hx,
        hy,
        { anchor: 'bc', alpha: hidden ? 0.55 : 1, scale: 1.5 },
      );
      if (state.carrying) {
        glow(g, hx, hy - 14, 10, '#ffe066', 0.6);
        rect(g, hx - 2, hy - 16, 4, 4, '#ffe066');
      }
      // Lighting: dark building, lamp pools, guard torches, camera cones, hero glow.
      lights.begin('#05030c', state.alert >= 2 ? 0.45 : 0.62);
      for (const [r, row] of grid.entries())
        for (const [c, cell] of row.entries()) {
          const { x, y } = cellXY(r, c);
          const cx = x + CELL_W / 2;
          if (cell.feature !== ':') lights.light(cx, y + 24, 30, 0.7);
          if (cell.actor === 'P' || cell.actor === 'R' || cell.actor === 'W') {
            const flip = cell.actor === 'W' && state.watcherFacing === 'left';
            lights.cone(cx + (flip ? -6 : 6), y + CELL_H - 18, flip ? Math.PI : 0, 0.35, 60, 0.9);
          }
          if (cell.actor === '^') lights.cone(cx - 2, y + 6, Math.PI / 2, 0.6, 60, 0.8);
          if (cell.feature === 'X' || cell.feature === 'T')
            lights.light(cx, y + CELL_H - 20, 22, 0.8);
        }
      lights.light(hx, hy - 10, 18, 0.8);
      lights.end(g);
      // Alarm wash.
      if (state.alert >= 2 || state.lockdown !== null) {
        g.fillStyle = withAlpha('#ff1030', 0.06 + 0.05 * Math.sin(t * 8));
        g.fillRect(0, 0, VW, VH);
      }
      if (alarmT >= 0 && f.since < 0.6)
        glow(g, hx, hy - 10, 50, '#ff2040', 0.5 * (1 - f.since / 0.6));
    },
    grade: (s): Grade =>
      s.alert >= 2 || s.lockdown !== null
        ? { top: '#ff8090', bottom: '#14020a', strength: 0.3, bloom: 0.6 }
        : { top: '#c8b0ff', bottom: '#05030c', strength: 0.26, bloom: 0.6 },
    hud(f) {
      const { g, state, t } = f;
      if (!state.profile) return;
      // Alert lamps only — numbers live in the HUD.
      for (let i = 0; i < 3; i += 1) {
        const on = i < state.alert;
        const x = 10 + i * 10;
        rect(g, x, 8, 7, 5, on ? (Math.sin(t * 10) > 0 ? '#ff2a4a' : '#a01030') : '#2a1a2e');
        rect(g, x, 8, 7, 1, on ? '#ffb0c0' : '#4a3a4e');
      }
    },
    react(f, o) {
      const before = (o.previous as HeistState).position;
      if (before[0] !== o.state.position[0] || before[1] !== o.state.position[1]) {
        prevPos = [before[0], before[1]];
        moveT = f.t;
        f.cue('whoosh');
      }
      for (const e of o.events) {
        if (e.type === 'detection' || e.type === 'responder') {
          alarmT = 0;
          f.fx.addTrauma(0.35);
          f.fx.flash('#ff2040', 0.25);
          f.cue('bad');
        } else if (e.type === 'objective') {
          f.fx.burst(VW / 2, 100, { count: 40, colors: ['#ffe066', '#ffffff'], speed: 120 });
          f.fx.float(VW / 2, 80, '★', '#ffe066', 1.2, true);
          f.fx.impact(1);
          f.cue('coin');
        } else if (e.type === 'false-objective') f.fx.float(VW / 2, 80, '...', '#a0a0c0');
        else if (e.type === 'gear' || e.type === 'console' || e.type === 'cache')
          f.fx.burst(VW / 2, 110, { count: 20, colors: ['#4fd1ff', '#ffffff'], speed: 80 });
        else if (e.type === 'patrol-stunned')
          f.fx.burst(VW / 2, 110, { count: 16, colors: ['#ffffff'], speed: 60, shape: 'spark' });
      }
    },
  };
}

const module: GameModule<HeistState> = { definition, createScene };
export default module;
