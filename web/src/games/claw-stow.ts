import { GLYPHS } from '@games/claw-stow/src/content';
import { definition } from '@games/claw-stow/src/definition';
import { glyphName, type StowState } from '@games/claw-stow/src/engine';
import type { Grade } from '../gfx/art';
import {
  ctx2d,
  disc,
  easeOutBack,
  ellipse,
  hash01,
  makeCanvas,
  rect,
  withAlpha,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, plate, shadow } from '../gfx/world';

const COLORS = ['#7ec8ff', '#ffb45a', '#fff6dc', '#e8e8f0', '#8fd0a0', '#ff8a5c'];

const CRATE: SpriteDef = {
  rows: ['wwwww', 'wcccw', 'wcbcw', 'wcccw', 'wwwww'],
  pal: { w: '#a87848', c: '#6a4428', b: '#fff6dc' },
};
const TAG: SpriteDef = {
  rows: ['wwww', 'w..w', 'wwww'],
  pal: { w: '#fff6dc' },
};

interface StowArt {
  crate: HTMLCanvasElement;
  tag: HTMLCanvasElement;
  clerk: HTMLCanvasElement;
  clerkStep: HTMLCanvasElement;
}

let artCache: StowArt | null = null;
let room: HTMLCanvasElement | null = null;

function art(): StowArt {
  if (artCache) return artCache;
  const pal = { b: '#e8a060', c: '#fff0d0' };
  artCache = {
    crate: buildSprite(CRATE),
    tag: buildSprite(TAG, {}, { shade: false }),
    clerk: buildSprite(SHRIMP, pal),
    clerkStep: buildSprite(SHRIMP, pal, { flip: true }),
  };
  return artCache;
}

function slot(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: 118 + col * 78, y: 46 + row * 64 };
}

function roomLayer(): HTMLCanvasElement {
  if (room) return room;
  const c = makeCanvas(384, 216);
  const g = ctx2d(c);
  rect(g, 0, 0, 384, 216, '#1a120c');
  for (let y = 0; y < 216; y += 8) rect(g, 0, y, 384, 1, y % 16 ? '#24180f' : '#140e0a');
  rect(g, 0, 0, 384, 16, '#2a1c12');
  for (let x = 8; x < 384; x += 22) {
    rect(g, x, 0, 4, 16, '#6a4a2a');
    rect(g, x, 14, 10, 2, '#3a2818');
  }
  ellipse(g, 40, 28, 10, 6, '#ffd27a');
  disc(g, 40, 28, 3, '#fff6dc');
  for (let i = 0; i < 18; i += 1) {
    rect(g, 90 + hash01(i, 1) * 250, 150 + hash01(i, 2) * 40, 8, 2, '#3a2818');
  }
  rect(g, 0, 188, 384, 28, '#120c08');
  room = c;
  return c;
}

function createScene(): GameScene<StowState> {
  let popped = -1;
  let good = false;

  return {
    grade(): Grade {
      return { top: '#ffb45a', bottom: '#100c08', bloom: 0.28, vignette: 0.74, strength: 0.22 };
    },
    anchor: () => ({ x: 200, y: 100 }),
    reset() {
      popped = -1;
      good = false;
    },
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const regions: HitRegion[] = [];
      for (let i = 0; i < state.bays.length; i += 1) {
        const action =
          actions.find((item) => item.id === `pull:${i}`) ??
          actions.find((item) => item.id === `shelve:${i}`) ??
          actions.find((item) => item.id === `mark:${i}`) ??
          actions.find((item) => item.id === `swap:${i}`);
        if (!action) continue;
        const at = slot(i);
        regions.push({ x: at.x, y: at.y, w: 68, h: 52, actionId: action.id });
      }
      if (actions.some((action) => action.id === 'hold')) {
        regions.push({ x: 300, y: 168, w: 72, h: 32, actionId: 'hold' });
      }
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(roomLayer(), 0, 0);
      const flicker = 0.35 + Math.sin(t * 6) * 0.08;
      disc(g, 40, 28, 16, withAlpha('#ffd27a', flicker));
      const slip = state.events[state.index];
      if (slip && state.outcome === 'ongoing') {
        const label = say(f, GLYPHS[slip.glyph] ?? '贝');
        const order = slip.kind === 'order';
        rect(g, 16, 48, 78, 52, '#efe4cf');
        rect(g, 16, 48, 78, 3, order ? '#c45a48' : '#3a6a48');
        rect(g, 20, 64, 70, 28, order ? '#f0c8b8' : '#d8ead0');
        if (label) drawText(g, label, 55, 70, { color: '#1a1008', align: 'center' });
        const kind = say(f, order ? '提取' : '进货');
        if (kind) drawText(g, kind, 55, 52, { color: '#6a4030', align: 'center' });
      }
      const focus = f.focus?.id ?? '';
      state.bays.forEach((bay, index) => {
        const at = slot(index);
        const hot = focus.endsWith(`:${index}`);
        rect(g, at.x, at.y + 36, 68, 8, '#6a4a2a');
        rect(g, at.x + 2, at.y + 34, 64, 3, '#a87848');
        rect(g, at.x + 4, at.y + 8, 60, 28, hot ? '#4a3420' : '#2a1c12');
        if (hot) rect(g, at.x + 4, at.y + 8, 60, 1, '#ffe08a');
        if (!bay) return;
        const color = COLORS[bay.glyph] ?? '#fff6dc';
        const drop = popped === index ? 1 - easeOutBack(Math.min(1, f.since / 0.3)) : 0;
        shadow(g, at.x + 34, at.y + 34, 16);
        blit(g, art().crate, at.x + 34, at.y + 30 - drop * 10, {
          scale: 2,
          anchor: 'bc',
          tint: color,
          tintAlpha: 0.72,
        });
        if (bay.labeled) blit(g, art().tag, at.x + 34, at.y + 10, { scale: 2, anchor: 'bc' });
        const cracks = Math.min(4, bay.age);
        for (let i = 0; i < cracks; i += 1) {
          rect(g, at.x + 22 + i * 5, at.y + 18, 2, 7, '#1a1008');
        }
        if (bay.age + 1 >= (bay.labeled ? state.spoil + 3 : state.spoil)) {
          disc(g, at.x + 48, at.y + 14, 2, withAlpha('#9ecf6a', 0.7));
        }
        const name = say(f, glyphName(bay.glyph));
        if (name) drawText(g, name, at.x + 34, at.y + 18, { color: '#1a1008', align: 'center' });
      });
      const step = Math.floor(t * 2) % 2;
      blit(g, step ? art().clerkStep : art().clerk, 48, 176 + Math.round(Math.sin(t * 2)), {
        scale: 2,
        anchor: 'bc',
      });
      const hold = say(f, '放过');
      if (hold && f.actions.some((action) => action.id === 'hold')) {
        const hot = focus === 'hold';
        rect(g, 300, 168, 72, 28, hot ? '#4a2820' : '#241410');
        rect(g, 300, 168, 72, 2, '#c45a48');
        drawText(g, hold, 336, 174, { color: '#fff4d6', align: 'center' });
      }
      if (good && f.since < 0.5) {
        disc(g, 200, 80, 8 + f.since * 20, withAlpha('#ffe08a', 0.25 * (1 - f.since)));
      }
    },
    hud(f) {
      const { g, state } = f;
      rect(g, 250, 8, 120, 16, withAlpha('#120c08', 0.7));
      for (let i = 0; i < state.quota; i += 1) {
        rect(g, 256 + i * 10, 12, 7, 7, i < state.correct ? '#8fd0a0' : '#3a2818');
      }
      for (let i = 0; i < state.cap; i += 1) {
        rect(g, 256 + i * 10, 22, 7, 4, i < state.mispicks ? '#ff6a6a' : '#3a2818');
      }
      const hint = say(f, '先看后三张。来不及的那箱才值得贴标签。');
      if (hint && state.notes.length === 0 && state.outcome === 'ongoing') {
        plate(g, hint, 190, 198, '#fff0d0', 280);
      }
    },
    react(f, outcome) {
      const kind = String(outcome.events[0]?.type ?? '');
      good = false;
      popped = -1;
      if (kind === 'pull') {
        const wrong = outcome.result.log.some((line) => line.includes('取错'));
        good = !wrong;
        f.cue(wrong ? 'bad' : 'coin');
        f.fx.shake(wrong ? 2.4 : 0);
        f.fx.burst(200, 90, {
          count: 14,
          colors: wrong ? ['#ff5d73', '#ffffff'] : ['#8fd0a0', '#fff6dc'],
          speed: 36,
          life: 0.5,
        });
        f.fx.float(200, 70, wrong ? 'X' : '+', wrong ? '#ff8aa0' : '#ffe08a');
      } else if (kind === 'hold') {
        f.cue('bad');
        f.fx.float(320, 160, '-', '#ff8aa0');
      } else {
        f.cue('land');
        const match = /(\d+)/.exec(kind);
        popped = match ? Number(match[1]) : -1;
      }
    },
  };
}

const module: GameModule<StowState> = { definition, createScene };
export default module;
