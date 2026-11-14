import { definition } from '@games/claw-count/src/definition';
import type { CountState } from '@games/claw-count/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { rect } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit } from '../gfx/world';

function createScene(): GameScene<CountState> {
  return {
    grade(): Grade {
      return { top: '#243050', bottom: '#0c1018', bloom: 0.4, vignette: 0.8 };
    },
    anchor: () => ({ x: 180, y: 120 }),
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const regions: HitRegion[] = [];
      const step = actions.find((action) => action.id === 'step');
      if (step) regions.push({ x: 250, y: 150, w: 110, h: 48, actionId: 'step' });
      actions
        .filter((action) => action.id.startsWith('set:'))
        .forEach((action, index) => {
          regions.push({ x: 16 + index * 36, y: 24, w: 32, h: 32, actionId: action.id });
        });
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      sky(g, ['#1a2848', '#101828', '#0c1018'], 0, 216, 8);
      stars(g, t, 2, 20, 50);
      moon(g, 330, 28, 8, '#fff6dc', '#9eb4ff');
      rect(g, 0, 168, 384, 48, '#1a2430');
      state.tiles.forEach((tile, index) => {
        const x = 36 + index * 52;
        const on = tile.includes(state.count);
        const here = index === state.pos;
        rect(g, x, on ? 150 : 162, 40, on ? 18 : 6, on ? '#d8c090' : '#3a3028');
        if (here) glow(g, x + 20, 140, 12, '#7ee0a0', 0.4);
        const label = say(f, String(tile.join('/')));
        if (label)
          drawText(g, label, x + 20, 128, { color: on ? '#fff4d6' : '#6a6058', align: 'center' });
      });
      const shrimp = buildSprite(SHRIMP);
      const x = state.pos <= 0 ? 24 : 36 + (state.pos - 1) * 52 + 20;
      blit(g, shrimp, x, 148 + Math.round(Math.sin(t * 3)), { scale: 2, anchor: 'bc' });
      for (const count of [0, 1, 2, 3]) {
        const on = state.count === count;
        rect(g, 20 + count * 36, 28, 28, 28, on ? '#ffc24a' : '#241c14');
        drawText(g, String(count), 34 + count * 36, 34, { color: '#fff4d6', align: 'center' });
      }
      const step = say(f, '迈步');
      if (step && f.actions.some((action) => action.id === 'step')) {
        rect(g, 262, 164, 96, 32, '#2a2018');
        drawText(g, step, 310, 172, { color: '#fff4d6', align: 'center' });
      }
    },
    react(f, outcome) {
      if (outcome.events.some((event) => event.type === 'step')) f.cue('land');
      if (outcome.events.some((event) => event.type === 'magnet')) f.cue('coin');
      const fell = outcome.result.log.some((line) => line.includes('坠落'));
      if (fell) f.cue('bad');
    },
  };
}

const module: GameModule<CountState> = { definition, createScene };
export default module;
