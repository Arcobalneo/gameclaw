import { SHELL, WELL_H, WELL_W } from '@games/claw-melt/src/content';
import { definition } from '@games/claw-melt/src/definition';
import { columnHeight, type MeltState } from '@games/claw-melt/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { disc, rect } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { drawText } from '../gfx/text';
import { tiny } from '../gfx/tiny';

const COLORS = ['', '#e8d5b5', '#ffb08a', '#ff6b4a', '#ff3d6e', '#c49aff', '#ffe08a', '#fff6dc'];
const OX = 96;
const OY = 28;
const CW = 28;
const CH = 22;

function createScene(): GameScene<MeltState> {
  return {
    grade(): Grade {
      return { top: '#402018', bottom: '#10080c', bloom: 0.4, vignette: 0.8 };
    },
    anchor: () => ({ x: OX + 80, y: 80 }),
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
      sky(g, ['#2a1020', '#140814', '#0c0810'], 0, 216, 10);
      rect(g, OX - 10, OY - 8, WELL_W * CW + 16, WELL_H * CH + 18, '#1a100c');
      rect(g, OX - 6, OY - 4, WELL_W * CW + 8, WELL_H * CH + 10, '#2a1a14');
      for (let y = 0; y < WELL_H; y += 1) {
        for (let x = 0; x < WELL_W; x += 1) {
          const size = state.cells[y * WELL_W + x] ?? 0;
          const px = OX + x * CW;
          const py = OY + y * CH;
          rect(g, px, py, CW - 4, CH - 3, '#120c10');
          if (size > 0) {
            const color = COLORS[size] ?? '#fff6dc';
            glow(g, px + 10, py + 8, 10, color, 0.25);
            disc(g, px + 10, py + 8, 6 + Math.min(3, size), color);
            disc(g, px + 8, py + 6, 2, '#fff6dc');
          }
        }
      }
      const hover = state.piece;
      const color = COLORS[hover] ?? '#fff6dc';
      const bob = Math.round(Math.sin(t * 3) * 2);
      glow(g, 48, 70 + bob, 18, color, 0.5);
      disc(g, 48, 70 + bob, 8, color);
      const name = say(f, SHELL[hover] ?? '壳');
      if (name) drawText(g, name, 48, 92, { color: '#fff4d6', align: 'center' });
      const dir = state.tiltDir < 0 ? -1 : 1;
      const ax = dir < 0 ? 40 : 330;
      rect(g, ax, 150, 18, 4, '#7ec8ff');
      rect(g, dir < 0 ? ax - 6 : ax + 16, 146, 6, 12, '#7ec8ff');
      const tide = say(f, state.tiltDir < 0 ? '潮向左' : '潮向右');
      if (tide) drawText(g, tide, dir < 0 ? 36 : 348, 162, { color: '#c8e8ff', align: 'center' });
      for (let x = 0; x < WELL_W; x += 1) {
        const h = columnHeight(state.cells, x);
        if (h >= WELL_H - 1) rect(g, OX + x * CW, OY - 6, CW - 6, 2, '#ff5d73');
      }
      if (state.last && f.since < 0.45 && state.last.chain > 0) {
        tiny(g, String(state.last.chain), OX + state.last.col * CW + 8, OY - 8, {
          color: '#ffe08a',
          align: 'left',
        });
      }
    },
    react(f, outcome) {
      const drop = outcome.events.find((event) => event.type === 'drop');
      if (!drop) return;
      const col = Number(drop.col);
      f.cue(Number(drop.chain) > 0 ? 'good' : 'land');
      f.fx.burst(OX + col * CW + 10, OY + 80, {
        count: 12 + Number(drop.chain) * 6,
        colors: ['#ffb08a', '#ffe08a', '#fff6dc'],
        speed: 60,
        life: 0.5,
      });
      if (Number(drop.spill) > 0) f.fx.addTrauma(0.25);
    },
  };
}

const module: GameModule<MeltState> = { definition, createScene };
export default module;
