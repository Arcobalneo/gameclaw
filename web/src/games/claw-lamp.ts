import { definition } from '@games/claw-lamp/src/definition';
import type { LampState } from '@games/claw-lamp/src/engine';
import type { Grade } from '../gfx/art';
import { sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { disc, line, rect, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit } from '../gfx/world';

const OX = 36;
const OY = 28;
const CW = 52;
const CH = 28;

const POOLS: Array<[number, number]> = [
  [2, 0],
  [4, 1],
  [1, 3],
  [5, 2],
  [3, 4],
  [0, 2],
];

function cell(x: number, y: number): { x: number; y: number } {
  return { x: OX + x * CW + 18, y: OY + y * CH + 10 };
}

function createScene(): GameScene<LampState> {
  return {
    grade(): Grade {
      return { top: '#1a1848', bottom: '#07060f', bloom: 0.55, vignette: 0.82 };
    },
    anchor: () => ({ x: 190, y: 110 }),
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const regions: HitRegion[] = [];
      state.posts.forEach((post, index) => {
        const place = actions.find((action) => action.id === `place:${index}`);
        const lift = actions.find((action) => action.id === `lift:${index}`);
        const id = place?.id ?? lift?.id;
        if (!id) return;
        const at = cell(post.x, post.y);
        regions.push({ x: at.x - 16, y: at.y - 16, w: 32, h: 32, actionId: id });
      });
      if (actions.some((action) => action.id === 'seal')) {
        regions.push({ x: 300, y: 168, w: 72, h: 36, actionId: 'seal' });
      }
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      sky(g, ['#14102c', '#0c1428', '#081018'], 0, 150, 10);
      stars(g, t, 3, 30, 70);
      rect(g, 28, 118, 300, 28, '#1a2430');
      rect(g, 40, 112, 260, 10, '#243044');
      rect(g, 0, 150, 384, 66, '#0a2430');
      for (let i = 0; i < 12; i += 1) {
        const x = (i * 36 + Math.round(t * 10)) % 420;
        rect(g, x, 162 + (i % 3) * 6, 14, 1, withAlpha('#7ec8ff', 0.28));
      }
      for (let i = 0; i < state.pools; i += 1) {
        const spot = POOLS[i] ?? [3, 2];
        const at = cell(spot[0], spot[1]);
        const lit = state.posts.some(
          (post, index) => state.placed[index] && post.covers.includes(i),
        );
        disc(g, at.x, at.y + 6, lit ? 5 : 4, lit ? '#7ee0c8' : '#14343c');
        if (lit) glow(g, at.x, at.y + 6, 10, '#7ee0c8', 0.35);
      }
      state.posts.forEach((post, index) => {
        const at = cell(post.x, post.y);
        rect(g, at.x - 1, at.y - 8, 3, 16, '#6a5030');
        if (!state.placed[index]) {
          disc(g, at.x, at.y - 10, 2, '#3a3028');
          return;
        }
        const flicker = 0.45 + Math.sin(t * 6 + index) * 0.15;
        glow(g, at.x, at.y - 12, 16, '#ffb45a', flicker);
        disc(g, at.x, at.y - 12, 4, '#ffd27a');
        for (const pool of post.covers) {
          const spot = POOLS[pool] ?? [3, 2];
          const to = cell(spot[0], spot[1]);
          line(g, at.x, at.y - 8, to.x, to.y, withAlpha('#ffc24a', 0.35));
        }
      });
      const shrimp = buildSprite(SHRIMP);
      blit(g, shrimp, 28, 176 + Math.round(Math.sin(t * 2)), { scale: 2, anchor: 'bc' });
      const seal = say(f, '封滩');
      if (seal && f.actions.some((action) => action.id === 'seal')) {
        const on = f.focus?.id === 'seal';
        rect(g, 300, 168, 72, 32, on ? '#3a2a14' : '#1a140c');
        rect(g, 300, 168, 72, 2, '#ffc24a');
        drawText(g, seal, 336, 176, { color: '#fff4d6', align: 'center' });
      }
    },
    react(f, outcome) {
      if (outcome.events.some((event) => event.type === 'place')) {
        f.cue('good');
        f.fx.burst(190, 90, { count: 14, colors: ['#ffd27a', '#fff6dc'], speed: 36, life: 0.5 });
      } else if (outcome.events.some((event) => String(event.type).startsWith('lift'))) {
        f.cue('bad');
      } else if (outcome.events.some((event) => event.type === 'seal')) {
        f.cue('coin');
        f.fx.burst(200, 80, { count: 20, colors: ['#7ee0c8', '#fff6dc'], speed: 48, life: 0.7 });
      }
    },
  };
}

const module: GameModule<LampState> = { definition, createScene };
export default module;
