import { SHELL, WELL_H, WELL_W } from '@games/claw-melt/src/content';
import { definition } from '@games/claw-melt/src/definition';
import { columnHeight, type MeltState } from '@games/claw-melt/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, hash01, makeCanvas, rect, VH, VW, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, pips, shadow } from '../gfx/world';

const OX = 78;
const OY = 36;
const CW = 32;
const CH = 22;

const SHELLS: SpriteDef[] = [
  { rows: ['..'], pal: {} },
  {
    rows: ['..aa..', '.abba.', '.abba.', '..aa..'],
    pal: { a: '#e8d5b5', b: '#c4a888' },
  },
  {
    rows: ['...aa...', '.aabbaa.', 'aabbbbaa', '.aabbaa.', '...aa...'],
    pal: { a: '#ffb08a', b: '#e87858' },
  },
  {
    rows: ['..aaaa..', '.aabbaa.', 'aabbbbaa', 'aabbbbaa', '.aabbaa.', '..aaaa..'],
    pal: { a: '#ff6b4a', b: '#c23a2e' },
  },
  {
    rows: [
      '...aaaa...',
      '..aabbaa..',
      '.aabbbbaa.',
      'aabbbbbbaa',
      '.aabbbbaa.',
      '..aabbaa..',
      '...aaaa...',
    ],
    pal: { a: '#ff3d6e', b: '#8a2040' },
  },
  {
    rows: [
      '..aaaaaa..',
      '.aabbbbaa.',
      'aabbbbbbaa',
      'aabwwbbaa.',
      'aabbbbbbaa',
      '.aabbbbaa.',
      '..aaaaaa..',
    ],
    pal: { a: '#c49aff', b: '#6a4ab0', w: '#fff6dc' },
  },
  {
    rows: [
      '...aaaaaa...',
      '..aabbbbbaa.',
      '.aabbbbbbbaa',
      'aabwwwwbbaa.',
      'aabbbbbbbaa.',
      '..aabbbbbaa.',
      '...aaaaaa...',
    ],
    pal: { a: '#ffe08a', b: '#c4a060', w: '#fff6dc' },
  },
  {
    rows: [
      '....oooo....',
      '..ooowwwoo..',
      '.ooowwwwwwoo',
      'ooowwwwwwwwo',
      '.ooowwwwwwoo',
      '..ooowwwoo..',
      '....oooo....',
    ],
    pal: { o: '#7ec8ff', w: '#fff6dc' },
  },
];

let well: HTMLCanvasElement | null = null;

function mouth(): HTMLCanvasElement {
  if (well) return well;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#3a1828', '#1a0c18', '#0c0810'], 0, VH, 10);
  rect(g, OX - 16, OY - 10, WELL_W * CW + 28, WELL_H * CH + 28, '#2a1814');
  rect(g, OX - 8, OY - 4, WELL_W * CW + 12, WELL_H * CH + 16, '#140c10');
  for (let i = 0; i < 30; i += 1) {
    rect(g, OX + hash01(i, 2) * WELL_W * CW, OY + hash01(i, 3) * WELL_H * CH, 2, 1, '#3a2420');
  }
  rect(g, OX - 16, OY + WELL_H * CH + 6, WELL_W * CW + 28, 18, '#1a4060');
  for (let i = 0; i < 12; i += 1) {
    const x = OX - 14 + (i % 6) * 36;
    const y = OY - 8 + (i < 6 ? 0 : WELL_H * CH + 8);
    rect(g, x, y, 6, 4, '#6a5048');
    rect(g, x + 1, y, 2, 2, '#c4a888');
  }
  for (let y = OY; y < OY + WELL_H * CH; y += 18) {
    rect(g, OX - 14, y, 4, 8, '#4a3028');
    rect(g, OX + WELL_W * CW + 6, y + 6, 4, 8, '#4a3028');
  }
  well = c;
  return c;
}

function shell(size: number) {
  const def = SHELLS[Math.max(0, Math.min(SHELLS.length - 1, size))] ?? SHELLS[1]!;
  return buildSprite(def);
}

function createScene(): GameScene<MeltState> {
  return {
    grade(): Grade {
      return { top: '#402018', bottom: '#10080c', bloom: 0.45, vignette: 0.82 };
    },
    anchor: () => ({ x: OX + 90, y: 70 }),
    hits(_state, actions): HitRegion[] {
      return actions
        .filter((action) => action.id.startsWith('drop:'))
        .map((action) => {
          const col = Number(action.id.slice(5));
          return { x: OX + col * CW, y: OY, w: CW - 2, h: WELL_H * CH, actionId: action.id };
        });
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(mouth(), 0, 0);
      moon(g, 330, 22, 8, '#fff6dc', '#ffb08a');
      for (let x = OX; x < OX + WELL_W * CW; x += 8) {
        const y = OY + WELL_H * CH + 8 + Math.round(Math.sin(t * 2 + x * 0.1) * 1);
        rect(g, x, y, 5, 2, withAlpha('#7ec8ff', 0.5));
      }
      for (let y = 0; y < WELL_H; y += 1) {
        for (let x = 0; x < WELL_W; x += 1) {
          const size = state.cells[y * WELL_W + x] ?? 0;
          const px = OX + x * CW;
          const py = OY + y * CH;
          if (!size) {
            rect(g, px + 2, py + 2, CW - 6, CH - 4, '#1a1014');
            continue;
          }
          shadow(g, px + CW / 2, py + CH - 2, 12);
          blit(g, shell(size), px + CW / 2, py + CH - 2, { scale: 2, anchor: 'bc' });
        }
      }
      const bob = Math.round(Math.sin(t * 4) * 2);
      for (let x = 0; x < WELL_W; x += 1) {
        const hover = f.focus?.id === `drop:${x}`;
        if (!hover && columnHeight(state.cells, x) >= WELL_H) continue;
        if (hover) {
          glow(g, OX + x * CW + CW / 2, OY - 8, 14, '#ffb08a', 0.4);
          blit(g, shell(state.piece), OX + x * CW + CW / 2, OY - 6 + bob, {
            scale: 2,
            anchor: 'bc',
          });
        }
      }
      rect(g, 300, 36, 64, 70, '#1a1014');
      rect(g, 300, 36, 64, 2, '#ffb08a');
      blit(g, shell(state.next), 332, 78, { scale: 2, anchor: 'c' });
      const next = say(f, '下一');
      if (next) drawText(g, next, 332, 40, { color: '#fff4d6', align: 'center' });
      const name = say(f, SHELL[state.piece] ?? '');
      if (name) drawText(g, name, 20, 48, { color: '#fff4d6', align: 'left', outline: '#140c08' });
      blit(g, shell(state.piece), 40, 86, { scale: 3, anchor: 'c' });
      glow(g, 40, 86, 16, '#ffb08a', 0.35);
      for (let x = 0; x < WELL_W; x += 1) {
        drawText(g, String(x + 1), OX + x * CW + CW / 2, OY - 16, {
          color: f.focus?.id === `drop:${x}` ? '#fff6dc' : '#ffb08a',
          align: 'center',
        });
      }
      pips(g, 16, 16, state.winSize, state.maxSize, '#ffb08a', -1, t);
      drawText(g, String(state.points), 300, 120, { color: '#ffc24a', align: 'left', scale: 2 });
    },
    react(f, outcome) {
      const drop = outcome.events.find((event) => event.type === 'drop');
      if (!drop) return;
      const col = Number(drop.col);
      const x = OX + col * CW + CW / 2;
      const chain = Number(drop.chain);
      const spill = Number(drop.spill);
      f.cue(chain > 0 ? 'good' : spill > 0 ? 'bad' : 'land');
      f.fx.burst(x, OY + 40, {
        count: 8 + chain * 4,
        colors: spill > 0 ? ['#7ec8ff', '#fff6dc'] : ['#ffb08a', '#ff6b4a', '#fff6dc'],
        speed: 30 + chain * 6,
        life: 0.45,
        shape: spill > 0 ? 'drop' : 'spark',
      });
      if (spill > 0) f.fx.addTrauma(0.4);
      if (chain > 1) f.fx.float(x, OY, `x${chain}`, '#ffe08a', 0.8, true);
    },
  };
}

const module: GameModule<MeltState> = { definition, createScene };
export default module;
