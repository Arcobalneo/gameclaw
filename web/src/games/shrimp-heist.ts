import { definition } from '@games/shrimp-heist/src/definition';
import {
  type Direction,
  type HeistState,
  mapRows,
  resolveMove,
} from '@games/shrimp-heist/src/engine';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { bar, type Ctx, dither, rect, VH, VW, withAlpha } from '../gfx/pixel';
import type { GameModule, GameScene, HitRegion } from '../gfx/scene';
import { buildSprite, CAMERA_EYE, CHEST, GUARD, SHRIMP, SHRIMP_WALK } from '../gfx/sprites';
import { drawText } from '../gfx/text';
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
  rect(g, x, y, CELL_W - 2, CELL_H, dark ? '#0a0716' : '#16102e');
  rect(g, x, y + CELL_H - 4, CELL_W - 2, 4, '#2a2050');
  rect(g, x, y + CELL_H - 4, CELL_W - 2, 1, '#4a3a80');
  if (dark) dither(g, x, y, CELL_W - 2, CELL_H - 4, '#000000', 0.4);
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
      drawText(g, 'EXIT', cx, fy - 50, { color: '#7cf0a0', align: 'center' });
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
        drawText(g, feature === 'O' ? '★' : '?', cx, fy - 28, { color, align: 'center' });
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

function createScene(): GameScene<HeistState> {
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
      sky(g, ['#120a28', '#0a0618', '#05030c'], 0, VH, 8);
      rect(g, 0, 20, VW, 4, '#2a2050');
      if (state.phase === 'setup' || !state.profile) {
        drawText(g, '选择你的潜入风格', VW / 2, 40, {
          color: '#e6d8ff',
          align: 'center',
          scale: 2,
        });
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
              a.label.split(/[：:（(·]/)[0] ?? a.label,
              x,
              148,
              focus ? '#ffe066' : '#d8ccff',
              100,
            );
          });
        return;
      }
      const grid = parse(state);
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
            const tint = cell.actor === 'R' ? '#ff4d6d' : cell.actor === 'W' ? '#ffd166' : null;
            shadow(g, cx, fy, 14);
            blit(
              g,
              buildSprite(GUARD, tint ? { u: tint } : {}, {
                rim: '#ffffff',
                flip: cell.actor === 'W' && state.watcherFacing === 'left',
              }),
              cx,
              fy + Math.round(Math.sin(t * 4 + c)),
              { anchor: 'bc' },
            );
            glow(g, cx + 6, fy - 16, 14, '#ffe9a0', 0.25);
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
        { anchor: 'bc', alpha: hidden ? 0.55 : 1 },
      );
      if (state.carrying) {
        glow(g, hx, hy - 14, 10, '#ffe066', 0.6);
        rect(g, hx - 2, hy - 16, 4, 4, '#ffe066');
      }
      // Alarm wash.
      if (state.alert >= 2 || state.lockdown !== null) {
        g.fillStyle = withAlpha('#ff1030', 0.06 + 0.05 * Math.sin(t * 8));
        g.fillRect(0, 0, VW, VH);
      }
      if (alarmT >= 0 && f.since < 0.6)
        glow(g, hx, hy - 10, 50, '#ff2040', 0.5 * (1 - f.since / 0.6));
    },
    hud(f) {
      const { g, state } = f;
      if (!state.profile) return;
      drawText(g, '暴露', 10, 184, { color: '#ff9ab0' });
      bar(
        g,
        38,
        188,
        120,
        4,
        state.exposure / Math.max(1, state.exposureLimit),
        state.exposure / state.exposureLimit > 0.7 ? '#ff2a4a' : '#ff9ab0',
      );
      drawText(g, `${state.exposure}/${state.exposureLimit}`, 164, 184, { color: '#ffd0e0' });
      drawText(
        g,
        `警戒 ${'▮'.repeat(Math.max(0, state.alert))}${'▯'.repeat(Math.max(0, 3 - state.alert))}`,
        214,
        184,
        { color: '#ffd166' },
      );
      drawText(
        g,
        state.objectiveTaken
          ? '目标到手 → 撤离!'
          : state.objectiveKnown
            ? '已锁定真目标'
            : '寻找真目标',
        VW - 10,
        184,
        { color: state.objectiveTaken ? '#7cf0a0' : '#e6d8ff', align: 'right' },
      );
    },
    react(f, o) {
      const before = (o.previous as HeistState).position;
      if (before[0] !== o.state.position[0] || before[1] !== o.state.position[1]) {
        prevPos = [before[0], before[1]];
        moveT = f.t;
      }
      for (const e of o.events) {
        if (e.type === 'detection' || e.type === 'responder') {
          alarmT = 0;
          f.fx.shake(3, 0.3);
          f.fx.flash('#ff2040', 0.25);
        } else if (e.type === 'objective') {
          f.fx.burst(VW / 2, 100, { count: 40, colors: ['#ffe066', '#ffffff'], speed: 120 });
          f.fx.float(VW / 2, 80, '真目标!', '#ffe066');
        } else if (e.type === 'false-objective') f.fx.float(VW / 2, 80, '空货格…', '#a0a0c0');
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
