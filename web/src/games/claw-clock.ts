import { definition } from '@games/claw-clock/src/definition';
import type { ClockState, Token } from '@games/claw-clock/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { disc } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit } from '../gfx/world';

const COLOR: Record<Token, string> = {
  empty: '#2a2430',
  you: '#ff8a5c',
  foe: '#ff5d73',
  gem: '#7ee0a0',
};

function createScene(): GameScene<ClockState> {
  return {
    grade(): Grade {
      return { top: '#301820', bottom: '#10080c', bloom: 0.5, vignette: 0.85 };
    },
    anchor: () => ({ x: 192, y: 108 }),
    hits(_state, actions): HitRegion[] {
      return actions.map((action, index) => ({
        x: 48 + index * 100,
        y: 168,
        w: 88,
        h: 36,
        actionId: action.id,
      }));
    },
    draw(f) {
      const { g, t, state } = f;
      sky(g, ['#201018', '#14080c', '#0c0808'], 0, 216, 6);
      disc(g, 192, 100, 78, '#1a1014');
      disc(g, 192, 100, 62, '#2a1820');
      const shrimp = buildSprite(SHRIMP);
      state.ring.forEach((token, index) => {
        const angle = (index / 8) * Math.PI * 2 - Math.PI / 2;
        const x = 192 + Math.round(Math.cos(angle) * 70);
        const y = 100 + Math.round(Math.sin(angle) * 70);
        const color = COLOR[token];
        if (index === state.hand) glow(g, x, y, 16, '#ffc24a', 0.55);
        disc(g, x, y, 10, color);
        if (token === 'you')
          blit(g, shrimp, x, y + 4 + Math.round(Math.sin(t * 3)), { scale: 1, anchor: 'bc' });
      });
      const handAngle = (state.hand / 8) * Math.PI * 2 - Math.PI / 2;
      const hx = 192 + Math.round(Math.cos(handAngle) * 40);
      const hy = 100 + Math.round(Math.sin(handAngle) * 40);
      disc(g, hx, hy, 4, '#ffc24a');
      f.actions.forEach((action, index) => {
        const label = say(f, action.label);
        if (!label) return;
        drawText(g, label, 92 + index * 100, 176, { color: '#fff4d6', align: 'center' });
      });
    },
    react(f, outcome) {
      const tick = outcome.events.find((event) => event.type === 'tick');
      if (!tick) return;
      f.cue(Number(tick.wounds) > 0 ? 'bad' : 'hit');
    },
  };
}

const module: GameModule<ClockState> = { definition, createScene };
export default module;
