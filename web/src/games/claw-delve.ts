import { definition } from '@games/claw-delve/src/definition';
import type { DelveState } from '@games/claw-delve/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  type Ctx,
  ctx2d,
  dither,
  ellipse,
  hash01,
  makeCanvas,
  mix,
  rect,
  VH,
  VW,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, type Palette, SHRIMP, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, pips, shadow } from '../gfx/world';

const COLS = [108, 168, 228];
const ROW = 34;

const PICK: SpriteDef = {
  rows: ['..h.', '.hh.', 'ss..', 's...'],
  pal: { h: '#d8d0c0', s: '#8a6840' },
};

const BEAM: SpriteDef = {
  rows: ['bbbbbbbb', 'dwwwwwd.', 'ddddddd.'],
  pal: { b: '#c4a060', d: '#6a4028', w: '#efe0c0' },
};

const ORE: SpriteDef = {
  rows: ['..gg..', '.gGGg.', 'gGGGGg', '.gGGg.', '..gg..'],
  pal: { g: '#e8c060', G: '#fff0a0' },
};

let shaft: HTMLCanvasElement | null = null;

function board(): HTMLCanvasElement {
  if (shaft) return shaft;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#1c140c', '#120e0a', '#0c0a08', '#080604'], 0, VH, 10);
  rect(g, 88, 8, 168, 196, '#1a120c');
  for (let layer = 0; layer < 5; layer += 1) {
    const y = 16 + layer * ROW;
    for (let col = 0; col < 3; col += 1) {
      const x = COLS[col] ?? 108;
      rect(g, x, y, 48, 28, '#24180e');
      dither(g, x, y, 48, 28, '#3a2818', 0.12);
      for (let n = 0; n < 4; n += 1) {
        const px = x + 4 + Math.floor(hash01(layer * 9 + col * 3 + n, 2) * 36);
        const py = y + 4 + Math.floor(hash01(layer * 9 + col * 3 + n, 4) * 16);
        rect(g, px, py, 3, 2, mix('#3a2818', '#5a4030', hash01(n, layer + 1)));
      }
    }
    rect(g, 96, y + 26, 180, 4, '#2a1c12');
  }
  rect(g, 88, 8, 6, 196, '#3a2a1c');
  rect(g, 250, 8, 6, 196, '#3a2a1c');
  ellipse(g, 192, 10, 40, 8, '#0a0806');
  shaft = c;
  return c;
}

function lamp(g: Ctx, x: number, y: number, t: number): void {
  glow(g, x, y, 10, '#ffc24a', 0.25 + 0.08 * Math.sin(t * 3));
  rect(g, x - 2, y - 3, 4, 5, '#6a4020');
  rect(g, x - 1, y - 2, 2, 3, '#ffe066');
}

function ladder(g: Ctx): void {
  rect(g, 78, 16, 3, 180, '#6a4830');
  rect(g, 92, 16, 3, 180, '#6a4830');
  for (let y = 24; y < 190; y += 12) rect(g, 78, y, 17, 2, '#c4a060');
}

function dust(g: Ctx, t: number, collapses: number): void {
  const n = 8 + collapses * 6;
  for (let i = 0; i < n; i += 1) {
    const x = 100 + Math.floor(hash01(i, 6) * 140);
    const y = Math.floor((hash01(i, 8) * 180 + t * (8 + collapses * 4)) % 180) + 12;
    rect(g, x, y, 2, 2, collapses ? '#a08060' : '#5a4030');
  }
}

function cracks(g: Ctx, collapses: number): void {
  for (let i = 0; i < collapses; i += 1) {
    const x = 110 + i * 28;
    for (let k = 0; k < 8; k += 1) rect(g, x + k * 3, 20 + k * 6 + (k % 2) * 4, 3, 1, '#1a1008');
  }
}

function createScene(): GameScene<DelveState> {
  return {
    grade(): Grade {
      return { top: '#2a1c10', bottom: '#080604', bloom: 0.34, vignette: 0.84 };
    },
    anchor: (state) => ({
      x: (COLS[state.col] ?? 168) + 24,
      y: 28 + state.layer * ROW,
    }),
    hits(state, actions): HitRegion[] {
      const regions: HitRegion[] = [];
      const y = 16 + state.layer * ROW;
      const left = actions.find((action) => action.id === 'shift:-1');
      const right = actions.find((action) => action.id === 'shift:1');
      const down = actions.find((action) => action.id === 'cut');
      const brace = actions.find((action) => action.id === 'brace');
      if (left) {
        const x = COLS[state.col - 1] ?? 108;
        regions.push({ x, y, w: 48, h: 28, actionId: left.id });
      }
      if (right) {
        const x = COLS[state.col + 1] ?? 228;
        regions.push({ x, y, w: 48, h: 28, actionId: right.id });
      }
      if (down && state.layer + 1 < state.layers) {
        const x = COLS[state.col] ?? 168;
        regions.push({ x, y: y + ROW, w: 48, h: 28, actionId: down.id });
      }
      if (brace) regions.push({ x: 300, y, w: 64, h: 36, actionId: brace.id });
      return regions;
    },
    draw(f) {
      const { g, state, t, focus } = f;
      g.drawImage(board(), 0, 0);
      ladder(g);
      dust(g, t, state.collapses);
      if (state.collapses) cracks(g, state.collapses);
      state.oreCol.forEach((ore, layer) => {
        const y = 16 + layer * ROW;
        for (let col = 0; col < 3; col += 1) {
          const x = COLS[col] ?? 108;
          const open = state.open[layer]?.[col] === true;
          if (open) {
            rect(g, x + 2, y + 2, 44, 24, '#120e0a');
            dither(g, x + 2, y + 2, 44, 24, '#000000', 0.25);
          }
          if (ore === col && !state.mined[layer]) {
            const sprite = buildSprite(ORE, {}, { rim: '#fff6dc' });
            blit(g, sprite, x + 24, y + 16, { scale: 2, anchor: 'c' });
            glow(g, x + 24, y + 14, 8, '#ffe066', 0.2 + 0.08 * Math.sin(t * 2 + layer));
          }
        }
        if (state.braced[layer]) {
          const beam = buildSprite(BEAM, {}, { rim: '#fff6dc' });
          blit(g, beam, 192, y + 6, { scale: 2, anchor: 'c' });
        }
      });
      lamp(g, 100, 22 + state.layer * ROW, t);
      lamp(g, 278, 22 + (state.layer + 2) * 8, t + 1);
      const miner = buildSprite(SHRIMP, PAL, { rim: '#ffffff' });
      const mx = (COLS[state.col] ?? 168) + 24;
      const my = 36 + state.layer * ROW + Math.round(Math.sin(t * 2) * 1);
      shadow(g, mx, my + 6, 14);
      blit(g, miner, mx, my, { scale: 2, anchor: 'bc' });
      const pick = buildSprite(PICK);
      blit(g, pick, mx + 10, my - 8 + Math.round(Math.sin(t * 4) * 2), { scale: 2, anchor: 'c' });
      const brace = f.actions.find((action) => action.id === 'brace');
      if (brace) {
        const label = say(f, brace.label);
        const hot = focus?.id === 'brace';
        rect(g, 300, 16 + state.layer * ROW, 64, 28, hot ? '#6a4828' : '#3a2818');
        rect(g, 300, 16 + state.layer * ROW, 64, 2, '#e8c080');
        if (label)
          drawText(g, label, 332, 22 + state.layer * ROW, {
            color: '#fff4d6',
            align: 'center',
            outline: '#07040f',
          });
      }
      if (focus?.id.startsWith('shift')) {
        const dir = focus.id.endsWith('1') && !focus.id.includes('-') ? 1 : -1;
        const x = COLS[state.col + dir];
        if (x !== undefined) rect(g, x, 16 + state.layer * ROW, 48, 2, '#9fe4ff');
      }
      if (focus?.id === 'cut') {
        const x = COLS[state.col];
        if (x !== undefined) rect(g, x, 16 + (state.layer + 1) * ROW, 48, 2, '#ff8a6a');
      }
    },
    hud(f) {
      const { g, state, t } = f;
      const ore = say(f, '矿');
      const brace = say(f, '撑');
      const fall = say(f, '塌');
      if (ore) drawText(g, ore, 8, 6, { color: '#ffe066', outline: '#07040f' });
      pips(g, ore ? 36 : 8, 8, state.quota, state.ore, '#ffe066', -1, t);
      if (brace) drawText(g, brace, 8, 20, { color: '#e8c080', outline: '#07040f' });
      pips(g, brace ? 36 : 8, 22, Math.max(state.braces + 1, 3), state.braces, '#e8c080', -1, t);
      if (fall) drawText(g, fall, 8, 34, { color: '#ff8a6a', outline: '#07040f' });
      pips(g, fall ? 36 : 8, 36, state.collapseLimit, state.collapses, '#ff5d73', -1, t);
      drawText(g, `${state.layer + 1}/${state.layers}`, 8, 192, {
        color: '#c8b8a0',
        outline: '#07040f',
      });
    },
    react(f, outcome) {
      const line = outcome.result.log.join(' ');
      const x = (COLS[outcome.state.col] ?? 168) + 24;
      const y = 30 + outcome.state.layer * ROW;
      if (line.includes('挖到矿')) {
        f.fx.burst(x, y, { count: 18, colors: ['#ffe066', '#ffffff'], speed: 90 });
        f.fx.hit(x, y, 'light', -Math.PI / 2, ['#ffe066', '#ffffff']);
        f.cue('coin');
      }
      if (line.includes('塌了')) {
        f.fx.addTrauma(0.55);
        f.fx.flash('#ff8a6a', 0.3);
        f.fx.burst(192, y, { count: 24, colors: ['#6a4028', '#c4a060', '#3a2818'], speed: 70 });
        f.cue('heavy');
      } else if (line.includes('撑住')) {
        f.fx.hit(192, 20 + outcome.previous.layer * ROW, 'medium', 0, ['#e8c080', '#ffffff']);
        f.cue('land');
      } else if (line.includes('下到') || line.includes('移到')) {
        f.cue('whoosh');
      }
    },
  };
}

const PAL: Palette = { b: '#ffb08a', h: '#fff0e0', d: '#c4583a', t: '#e87858', c: '#ffd0b0' };

const module: GameModule<DelveState> = { definition, createScene };
export default module;
