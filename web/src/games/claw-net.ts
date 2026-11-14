import { NET_H, NET_W } from '@games/claw-net/src/content';
import { definition } from '@games/claw-net/src/definition';
import type { NetState } from '@games/claw-net/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { disc, rect, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit } from '../gfx/world';

const OX = 78;
const OY = 36;
const CW = 42;
const CH = 32;

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
      if (haul) regions.push({ x: 300, y: 150, w: 70, h: 48, actionId: 'haul' });
      for (let y = 0; y < NET_H; y += 1) {
        for (let x = 0; x < NET_W; x += 1) {
          const tie = actions.find((action) => action.id === `tie:${x}:${y}`);
          if (!tie) continue;
          regions.push({ x: OX + x * CW, y: OY + y * CH, w: CW - 4, h: CH - 4, actionId: tie.id });
        }
      }
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      sky(g, ['#0c2040', '#081828', '#061018'], 0, 216, 8);
      stars(g, t, 2, 20, 40);
      moon(g, 40, 28, 8, '#fff6dc', '#9ec8ff');
      rect(g, 0, 150, 384, 66, '#082030');
      for (let i = 0; i < 8; i += 1) {
        const x = (i * 48 + Math.round(t * 12)) % 400;
        rect(g, x, 168 + (i % 3) * 8, 16, 1, withAlpha('#7ec8ff', 0.3));
      }
      for (let y = 0; y < NET_H; y += 1) {
        rect(g, OX, OY + y * CH + 12, NET_W * CW - 8, 1, '#8a6840');
        for (let x = 0; x < NET_W; x += 1) {
          rect(g, OX + x * CW + 16, OY, 1, NET_H * CH - 6, '#8a6840');
          const cell = state.cells[y * NET_W + x];
          const px = OX + x * CW + 16;
          const py = OY + y * CH + 12;
          if (cell === 'tied') disc(g, px, py, 4, '#d8c090');
          else if (cell === 'wet') {
            disc(g, px, py, 4, '#6ec8e0');
            rect(g, px - 1, py + 4, 2, 4, '#6ec8e0');
          } else if (cell === 'torn') {
            glow(g, px, py, 10, '#ff5d73', 0.4);
            disc(g, px, py, 5, '#1a0c14');
            rect(g, px - 4, py, 8, 1, '#ff5d73');
          } else {
            rect(g, px - 5, py, 4, 1, '#3a3028');
            rect(g, px + 2, py, 4, 1, '#3a3028');
          }
        }
      }
      const shrimp = buildSprite(SHRIMP);
      const bob = Math.round(Math.sin(t * 2) * 2);
      blit(g, shrimp, 332, 176 + bob, { scale: 2, anchor: 'bc' });
      rect(g, 300, 176, 64, 8, '#6a4a2a');
      const haul = say(f, '收网');
      if (haul && f.actions.some((action) => action.id === 'haul')) {
        drawText(g, haul, 332, 186, { color: '#fff4d6', align: 'center' });
      }
    },
    react(f, outcome) {
      if (outcome.events.some((event) => event.type === 'haul')) {
        f.cue('coin');
        f.fx.burst(180, 100, { count: 18, colors: ['#7ec8ff', '#fff6dc'], speed: 40, life: 0.6 });
      } else if (outcome.events.some((event) => event.type === 'tie')) f.cue('good');
      else if (outcome.events.some((event) => event.type === 'cut')) f.cue('bad');
    },
  };
}

const module: GameModule<NetState> = { definition, createScene };
export default module;
