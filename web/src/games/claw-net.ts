import { NET_H, NET_W } from '@games/claw-net/src/content';
import { definition } from '@games/claw-net/src/definition';
import type { NetState } from '@games/claw-net/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, disc, hash01, makeCanvas, rect, VH, VW, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, kelp, pips, shadow } from '../gfx/world';

const OX = 64;
const OY = 48;
const CW = 48;
const CH = 28;

const FISH: SpriteDef = {
  rows: [
    '...tt....',
    '..tbbbt..',
    '.tbbbbbt.',
    'tbbewbbbt',
    '.tbbbbbt.',
    '..tbbbt..',
    '...tt....',
    '....t....',
  ],
  pal: { t: '#ffb08a', b: '#ff6b4a', e: '#14081a', w: '#fff6dc' },
};

const BUOY: SpriteDef = {
  rows: ['..rr..', '.rwwr.', 'rwwwwr', '.rwwr.', '..ss..', '..ss..'],
  pal: { r: '#ff5d73', w: '#fff6dc', s: '#3a2414' },
};

let sea: HTMLCanvasElement | null = null;

function harbor(): HTMLCanvasElement {
  if (sea) return sea;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#0c2848', '#081828', '#061018'], 0, VH, 8);
  rect(g, 0, 150, VW, VH - 150, '#0a2030');
  for (let i = 0; i < 50; i += 1) {
    rect(g, hash01(i, 1) * VW, 160 + hash01(i, 2) * 40, 3, 1, '#143848');
  }
  rect(g, 20, 132, 340, 8, '#6a4a2a');
  rect(g, 28, 108, 8, 28, '#3a2814');
  rect(g, 340, 108, 8, 28, '#3a2814');
  rect(g, 16, 100, 40, 16, '#2a1c12');
  rect(g, 328, 100, 40, 16, '#2a1c12');
  for (let i = 0; i < 6; i += 1) rect(g, 40 + i * 52, 136, 2, 14, '#8a6840');
  rect(g, 280, 48, 80, 36, '#1a2830');
  rect(g, 280, 48, 80, 2, '#7ec8ff');
  sea = c;
  return c;
}

function createScene(): GameScene<NetState> {
  return {
    grade(): Grade {
      return { top: '#103050', bottom: '#061018', bloom: 0.5, vignette: 0.8 };
    },
    anchor: () => ({ x: 180, y: 100 }),
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const regions: HitRegion[] = [];
      const haul = actions.find((action) => action.id === 'haul');
      if (haul) regions.push({ x: 300, y: 156, w: 72, h: 44, actionId: 'haul' });
      for (let y = 0; y < NET_H; y += 1) {
        for (let x = 0; x < NET_W; x += 1) {
          const tie = actions.find((action) => action.id === `tie:${x}:${y}`);
          const cut = actions.find((action) => action.id === `cut:${x}:${y}`);
          const id = tie?.id ?? cut?.id;
          if (!id) continue;
          regions.push({ x: OX + x * CW, y: OY + y * CH, w: CW - 6, h: CH - 4, actionId: id });
        }
      }
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(harbor(), 0, 0);
      stars(g, t, 2, 6, 40);
      moon(g, 40, 22, 8, '#fff6dc', '#9ec8ff');
      kelp(g, 16, 150, 36, t, '#1a6848');
      kelp(g, 360, 150, 42, t, '#145840');
      for (let x = 0; x < VW; x += 12) {
        const y = 148 + Math.round(Math.sin(t * 1.5 + x * 0.07) * 2);
        rect(g, x, y, 8, 2, withAlpha('#7ec8ff', 0.4));
      }
      const buoy = buildSprite(BUOY);
      blit(g, buoy, 48, 120 + Math.round(Math.sin(t * 2) * 2), { scale: 2, anchor: 'c' });
      blit(g, buoy, 330, 118 + Math.round(Math.sin(t * 2 + 1) * 2), { scale: 2, anchor: 'c' });
      for (let y = 0; y < NET_H; y += 1) {
        for (let x = 0; x < NET_W; x += 1) {
          const knot = state.cells[y * NET_W + x];
          const px = OX + x * CW;
          const py = OY + y * CH + Math.round(Math.sin(t * 1.4 + x + y) * 1);
          rect(g, px, py + 8, CW - 4, 1, '#c4a888');
          rect(g, px + 16, py, 1, CH, '#c4a888');
          if (knot === 'torn') {
            disc(g, px + 18, py + 10, 8, '#ff5d73');
            disc(g, px + 18, py + 10, 5, '#061018');
          } else if (knot === 'wet') {
            disc(g, px + 18, py + 8, 5, '#7ec8ff');
            rect(g, px + 16, py + 12, 3, 6, '#7ec8ff');
            glow(g, px + 18, py + 10, 8, '#7ec8ff', 0.35);
          } else if (knot === 'gap') {
            rect(g, px + 8, py + 6, 16, 8, '#1a1008');
          } else {
            disc(g, px + 18, py + 10, 3, '#e8d5b5');
          }
          const focus = f.focus?.id === `tie:${x}:${y}` || f.focus?.id === `cut:${x}:${y}`;
          if (focus) glow(g, px + 18, py + 10, 10, '#ffc24a', 0.45);
        }
      }
      const hull = buildSprite({
        rows: ['..hhhhhhhh..', '.hddddddddh.', 'dddddddddddd', '.dddddddddd.'],
        pal: { h: '#c4a060', d: '#6a4a2a' },
      });
      blit(g, hull, 200, 168 + Math.round(Math.sin(t) * 1), { scale: 2, anchor: 'bc' });
      const fish = buildSprite(FISH);
      const shown = Math.min(6, state.basket);
      for (let i = 0; i < shown; i += 1) {
        const bob = Math.round(Math.sin(t * 3 + i) * 1);
        blit(g, fish, 300 + (i % 3) * 18, 70 + Math.floor(i / 3) * 14 + bob, {
          scale: 1,
          anchor: 'c',
        });
      }
      shadow(g, 40, 168, 16);
      pips(g, 16, 16, 8, Math.min(8, state.thread), '#e8d5b5', -1, t);
      const haul = say(f, '收网');
      if (haul && f.actions.some((action) => action.id === 'haul')) {
        const on = f.focus?.id === 'haul';
        rect(g, 300, 160, 70, 32, on ? '#3a2a18' : '#1a120c');
        rect(g, 300, 160, 70, 2, '#ffc24a');
        drawText(g, haul, 335, 168, { color: '#fff4d6', align: 'center' });
      }
      drawText(g, String(state.basket), 24, 36, { color: '#ffb08a', align: 'left', scale: 2 });
    },
    react(f, outcome) {
      const event = outcome.events[0];
      const type = String(event?.type ?? '');
      if (type === 'haul') {
        f.cue('coin');
        f.fx.burst(180, 100, {
          count: 16,
          colors: ['#ff6b4a', '#7ec8ff', '#fff6dc'],
          speed: 40,
          life: 0.55,
        });
        f.fx.float(200, 70, `+${event?.fish ?? ''}`, '#ffb08a');
      } else if (type === 'tie') {
        f.cue('good');
        f.fx.burst(180, 110, { count: 6, colors: ['#e8d5b5'], speed: 16, life: 0.3 });
      } else if (type === 'cut') {
        f.cue('bad');
        f.fx.flash('#7ec8ff', 0.2);
      } else f.cue('splash');
    },
  };
}

const module: GameModule<NetState> = { definition, createScene };
export default module;
