import { definition } from '@games/shrimp-look/src/definition';
import type { LookState } from '@games/shrimp-look/src/model';
import { glow } from '../gfx/fx';
import {
  bar,
  type Ctx,
  dither,
  hash01,
  hashString,
  mix,
  rect,
  VH,
  VW,
  withAlpha,
} from '../gfx/pixel';
import type { GameModule, GameScene, HitRegion } from '../gfx/scene';
import { buildSprite, GHOST } from '../gfx/sprites';
import { drawText, fitText } from '../gfx/text';
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

function drawRoom(g: Ctx, seed: number, dread: number, t: number): void {
  const wall = mix('#1a1a34', '#2a0a14', Math.min(1, dread / 10));
  rect(g, 0, 0, VW, VH, '#05050c');
  rect(g, 60, WALL_TOP, VW - 120, HORIZON - WALL_TOP, wall);
  // Wallpaper stripes.
  for (let x = 64; x < VW - 60; x += 10)
    rect(g, x, WALL_TOP, 1, HORIZON - WALL_TOP, mix(wall, '#000000', 0.25));
  // Side walls in perspective.
  for (let y = 0; y < VH; y += 1) {
    const k =
      y < WALL_TOP ? (WALL_TOP - y) / WALL_TOP : y > HORIZON ? (y - HORIZON) / (VH - HORIZON) : 0;
    const w = 60 * k;
    rect(g, 0, y, 60 - w + w, 1, mix(wall, '#000000', 0.45));
    rect(g, VW - 60, y, 60, 1, mix(wall, '#000000', 0.45));
  }
  // Floor boards in perspective.
  for (let y = HORIZON; y < VH; y += 1) {
    const k = (y - HORIZON) / (VH - HORIZON);
    rect(g, 60 - 60 * k, y, VW - 120 + 120 * k, 1, mix('#1a120e', '#2a1c14', k));
  }
  for (let i = -6; i <= 6; i += 1) {
    const x0 = VW / 2 + i * 22;
    const x1 = VW / 2 + i * 60;
    g.strokeStyle = '#120c08';
    g.beginPath();
    g.moveTo(x0, HORIZON);
    g.lineTo(x1, VH);
    g.stroke();
  }
  // Ceiling + flickering bulb.
  rect(g, 60, 0, VW - 120, WALL_TOP, '#0a0a16');
  const flick = hash01(seed, Math.floor(t * 10)) > 0.92 ? 0.1 : 1;
  rect(g, VW / 2 - 1, 0, 2, 12, '#3a3a4a');
  rect(g, VW / 2 - 3, 12, 6, 4, flick > 0.5 ? '#fff4c0' : '#4a4a3a');
  glow(g, VW / 2, 16, 60, '#ffe9a0', 0.14 * flick);
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
    drawText(g, left ? '◀' : '▶', x + 16, 36, {
      color: focus ? '#ffe066' : '#6a6a8a',
      align: 'center',
    });
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
        drawText(g, '选择要调查的怪谈', VW / 2, 40, {
          color: '#cfe8ff',
          align: 'center',
          scale: 2,
        });
        f.actions
          .filter((a) => a.id !== 'abort')
          .forEach((a, i) => {
            const focus = f.focus?.id === a.id;
            plate(g, a.label, VW / 2, 80 + i * 22, focus ? '#ffe066' : '#9fc4ff', 260);
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
        plate(g, fitText(ph.title, 160), VW / 2, 22, '#cfe8ff', 220);
      }
      // Darkness with flashlight cone.
      const dark = 0.55 + Math.min(0.3, state.dread * 0.04);
      g.fillStyle = withAlpha('#020208', dark);
      g.beginPath();
      g.rect(0, 0, VW, VH);
      g.moveTo(VW / 2 + 16, VH);
      g.lineTo(beam + 50, HORIZON - 70);
      g.lineTo(beam - 50, HORIZON - 70);
      g.lineTo(VW / 2 - 16, VH);
      g.closePath();
      g.fill('evenodd');
      glow(g, beam, HORIZON - 30, 50, '#cfe8ff', 0.14);
      // Dread static.
      if (state.dread >= 4)
        dither(g, 0, Math.floor(hash01(Math.floor(t * 20), 9) * VH), VW, 3, '#ffffff', 0.15);
      if (scareT >= 0 && f.since < 0.35) {
        g.fillStyle = withAlpha('#ffffff', 0.4 * (1 - f.since / 0.35));
        g.fillRect(0, 0, VW, VH);
      }
    },
    hud(f) {
      const { g, state } = f;
      if (state.phase === 'case-select') return;
      const rows: [string, number, number, string][] = [
        ['专注', state.focus, 8, '#9fc4ff'],
        ['神经', state.nerve, 10, '#7cf0a0'],
        ['恐惧', state.dread, 10, '#ff4d6d'],
        ['证据', state.evidence, Math.max(1, state.requiredEvidence), '#ffe066'],
      ];
      rows.forEach(([label, v, max, color], i) => {
        drawText(g, label, 8, 150 + i * 12, { color });
        bar(g, 36, 155 + i * 12, 60, 3, v / max, color);
      });
      if (state.latestWitness && f.since < 4)
        plate(g, fitText(state.latestWitness, 300), VW / 2, 190, '#cfe8ff', 320);
    },
    react(f, o) {
      const ev = o.events[0];
      if (!ev) return;
      if (ev.type === 'inspect' && Number(ev.severity) >= 3) {
        scareT = 0;
        f.fx.shake(3 + Number(ev.severity), 0.3);
      } else if (ev.type === 'record') {
        f.fx.burst(VW / 2, 90, { count: 28, colors: ['#ffe066', '#ffffff'], speed: 90 });
        f.fx.float(VW / 2, 70, '证据 +1', '#ffe066');
      } else if (ev.type === 'move') f.fx.flash('#000000', 0.8);
      else if (ev.type === 'brace')
        f.fx.burst(VW / 2, 120, { count: 16, colors: ['#7cf0a0'], speed: 50, gravity: -20 });
    },
  };
}

const module: GameModule<LookState> = { definition, createScene };
export default module;
