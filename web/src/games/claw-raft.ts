import { definition } from '@games/claw-raft/src/definition';
import { type RaftState, type Side, sideLabel } from '@games/claw-raft/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  ctx2d,
  disc,
  easeOutCubic,
  ellipse,
  hash01,
  line,
  makeCanvas,
  rect,
  withAlpha,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, CHEST, SHRIMP, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, kelp, pips, plate, shadow } from '../gfx/world';

const HOLDS: Array<[Side, number]> = [
  ['port', 108],
  ['mid', 192],
  ['starboard', 276],
];

const CRATE: SpriteDef = {
  rows: ['wwwww', 'wbbbw', 'wbYbw', 'wbbbw', 'wwwww'],
  pal: { w: '#c48a52', b: '#6a4020', Y: '#ffe08a' },
};
const ROPE: SpriteDef = {
  rows: ['r.r.r', '.r.r.', 'r.r.r'],
  pal: { r: '#e8d0a0' },
};

interface RaftArt {
  chest: HTMLCanvasElement;
  crate: HTMLCanvasElement;
  rope: HTMLCanvasElement;
  pilot: HTMLCanvasElement;
  pilotStep: HTMLCanvasElement;
}

let artCache: RaftArt | null = null;
let sea: HTMLCanvasElement | null = null;

function art(): RaftArt {
  if (artCache) return artCache;
  const pal = { b: '#ffb07a', c: '#ffe0c0' };
  artCache = {
    chest: buildSprite(CHEST),
    crate: buildSprite(CRATE),
    rope: buildSprite(ROPE, {}, { shade: false }),
    pilot: buildSprite(SHRIMP, pal),
    pilotStep: buildSprite(SHRIMP, pal, { flip: true }),
  };
  return artCache;
}

function seaLayer(): HTMLCanvasElement {
  if (sea) return sea;
  const c = makeCanvas(384, 216);
  const g = ctx2d(c);
  sky(g, ['#ffb07a', '#c45a48', '#3a2048', '#14243a'], 0, 150, 12);
  for (let i = 0; i < 7; i += 1) {
    const x = 20 + i * 54;
    const h = 16 + (i % 3) * 10;
    rect(g, x, 78 - h, 30, h, '#1a1020');
    rect(g, x + 6, 74 - h, 4, 5, i % 2 ? '#ffd27a' : '#2a1840');
  }
  rect(g, 0, 86, 384, 130, '#12344a');
  for (let i = 0; i < 30; i += 1) {
    ellipse(
      g,
      hash01(i, 2) * 384,
      100 + hash01(i, 3) * 90,
      10 + hash01(i, 4) * 16,
      3,
      hash01(i, 5) > 0.5 ? '#0c2838' : '#1a4060',
    );
  }
  sea = c;
  return c;
}

function gustMark(gust: number): string {
  if (gust <= -2) return '<<';
  if (gust < 0) return '<';
  if (gust >= 2) return '>>';
  return gust > 0 ? '>' : '=';
}

function createScene(): GameScene<RaftState> {
  let splash = false;
  let dumped = false;

  return {
    grade(): Grade {
      return { top: '#ffb07a', bottom: '#0c1828', bloom: 0.38, vignette: 0.72, strength: 0.32 };
    },
    anchor: (state) => ({
      x: 192 + (state.holds.port - state.holds.starboard + state.gust) * 4,
      y: 120,
    }),
    reset() {
      splash = false;
      dumped = false;
    },
    hits(_state, actions): HitRegion[] {
      const regions: HitRegion[] = [];
      for (const hold of HOLDS) {
        if (!actions.some((action) => action.id === hold[0])) continue;
        regions.push({ x: hold[1] - 28, y: 96, w: 64, h: 52, actionId: hold[0] });
      }
      if (actions.some((action) => action.id === 'shift')) {
        regions.push({ x: 150, y: 168, w: 84, h: 32, actionId: 'shift' });
      }
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(seaLayer(), 0, 0);
      moon(g, 330, 28, 7, '#ffe0a0', '#ffb07a');
      const tilt = state.holds.port - state.holds.starboard + state.gust;
      const raftX = 192 + tilt * 5;
      const bob = Math.round(Math.sin(t * 2.1) * 2);
      const roll = Math.round(Math.sin(t * 1.4) + tilt);
      for (let i = 0; i < 12; i += 1) {
        const y = 150 + Math.round(Math.sin(t * 2 + i) * 3);
        rect(g, (i * 36 + Math.round(t * 14)) % 420, y, 18, 2, withAlpha('#7ec8ff', 0.4));
      }
      const gust = state.gust;
      for (let i = 0; i < 4; i += 1) {
        const dir = Math.sign(gust) || 1;
        const x = 300 + dir * ((t * 28 + i * 14) % 40);
        rect(g, x, 48 + i * 6, 10 + Math.abs(gust) * 4, 2, withAlpha('#fff6dc', 0.55));
      }
      const next = gustMark(state.nextGust);
      disc(g, 28, 36, 10, '#ffe0a0');
      rect(g, 18, 52, 22, 2, '#fff6dc');
      shadow(g, raftX, 146 + bob, 90);
      rect(g, raftX - 96, 128 + bob + roll, 192, 10, '#6a4020');
      rect(g, raftX - 90, 118 + bob, 180, 14, '#8a5a32');
      rect(g, raftX - 90, 118 + bob, 180, 2, '#c48a52');
      line(g, raftX - 70, 118 + bob, raftX + 70, 118 + bob + roll, '#e8d0a0');
      const focus = f.focus?.id;
      for (const hold of HOLDS) {
        const weight = state.holds[hold[0]];
        const x = raftX + (hold[1] - 192);
        const hot = focus === hold[0];
        rect(g, x - 24, 100 + bob, 48, 20, hot ? '#e8c878' : '#c48a52');
        rect(g, x - 22, 102 + bob, 44, 16, '#3a2414');
        for (let i = 0; i < Math.min(weight, 6); i += 1) {
          blit(g, art().crate, x - 16 + (i % 3) * 12, 114 + bob - Math.floor(i / 3) * 8, {
            scale: 1,
            anchor: 'bc',
          });
        }
        const name = say(f, sideLabel(hold[0]));
        if (name) {
          drawText(g, name, x, 86 + bob, {
            color: hot ? '#fff6dc' : '#ffe0c0',
            align: 'center',
            outline: '#1a1008',
          });
        }
      }
      const crate = state.crates[state.index];
      if (crate && state.outcome === 'ongoing') {
        const swing = Math.round(Math.sin(t * 3) * 4);
        line(g, 192, 40, 192 + swing, 70, '#e8d0a0');
        blit(g, art().chest, 192 + swing, 78, { scale: 2, anchor: 'bc' });
        drawText(g, String(crate.w), 192 + swing, 52, {
          color: '#fff6dc',
          align: 'center',
          outline: '#1a1008',
        });
        if (f.since < 0.35 && !splash) {
          const k = easeOutCubic(f.since / 0.35);
          blit(g, art().chest, 192 + (raftX - 192) * k, 78 + k * 30, {
            scale: 2,
            anchor: 'bc',
            alpha: 1 - k,
          });
        }
      }
      if (dumped && f.since < 0.6) {
        const a = 1 - f.since / 0.6;
        ellipse(g, raftX, 150, 20 + f.since * 30, 6, withAlpha('#ffffff', 0.35 * a));
        ellipse(g, raftX - tilt * 8, 156, 12, 4, withAlpha('#7ec8ff', 0.4 * a));
      }
      const step = Math.floor(t * 2) % 2;
      blit(g, step ? art().pilotStep : art().pilot, 48, 176 + bob, { scale: 2, anchor: 'bc' });
      kelp(g, 12, 210, 24, t, '#0e4038');
      kelp(g, 368, 212, 28, t + 1, '#0e4038');
      const shift = say(f, '挪一成');
      if (shift && f.actions.some((action) => action.id === 'shift')) {
        const hot = focus === 'shift';
        rect(g, 150, 168, 84, 28, hot ? '#4a3018' : '#2a1c10');
        rect(g, 150, 168, 84, 2, '#e8d0a0');
        blit(g, art().rope, 164, 182, { scale: 2, anchor: 'c' });
        drawText(g, shift, 198, 174, { color: '#fff4d6', align: 'center' });
      }
      glow(g, 340, 170, 8, '#ffd27a', 0.2);
      drawText(g, next, 348, 44, { color: '#fff6dc', align: 'center', outline: '#1a1008' });
    },
    hud(f) {
      const { g, state } = f;
      const now = say(f, state.gust < 0 ? '向左' : state.gust > 0 ? '向右' : '正中');
      rect(g, 8, 6, 120, 18, withAlpha('#1a1020', 0.72));
      if (now) drawText(g, now, 14, 8, { color: '#fff6dc', outline: '#1a1020' });
      pips(g, 250, 10, 8, state.index, '#ffd27a', state.index, f.t);
      pips(g, 250, 20, Math.max(state.hands, 1), state.hands, '#e8d0a0');
      const hint = say(f, '先看这一阵，再看下一阵。箱子想去的一侧不会额外偏。');
      if (hint && state.notes.length === 0 && state.outcome === 'ongoing') {
        plate(g, hint, 180, 198, '#ffe0c0', 300);
      }
    },
    react(f, outcome) {
      const stash = outcome.events.find((event) => event.type === 'stash');
      splash = Boolean(stash);
      dumped = stash?.kind === 'dump' || stash?.kind === 'capsize';
      const x = 192 + (f.state.holds.port - f.state.holds.starboard) * 4;
      if (!stash) {
        if (outcome.events.some((event) => event.type === 'shift')) {
          f.cue('whoosh');
          f.fx.burst(x, 120, { count: 8, colors: ['#e8d0a0', '#fff6dc'], speed: 24, life: 0.4 });
        }
        return;
      }
      if (dumped) {
        f.cue(stash.kind === 'capsize' ? 'bad' : 'splash');
        f.fx.shake(stash.kind === 'capsize' ? 4 : 2);
        f.fx.burst(x, 140, {
          count: 18,
          colors: ['#7ec8ff', '#ffffff', '#c48a52'],
          speed: 48,
          life: 0.6,
          shape: 'drop',
        });
        f.fx.float(x, 100, stash.kind === 'capsize' ? 'X' : '-', '#ff8aa0');
      } else {
        f.cue(stash.kind === 'calm' ? 'coin' : 'land');
        f.fx.float(x, 96, '+', '#ffe08a', 0.7);
      }
    },
  };
}

const module: GameModule<RaftState> = { definition, createScene };
export default module;
