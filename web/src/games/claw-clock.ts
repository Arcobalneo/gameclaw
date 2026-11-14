import { definition } from '@games/claw-clock/src/definition';
import type { ClockState, Token } from '@games/claw-clock/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, disc, makeCanvas, rect, VH, VW } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit } from '../gfx/world';

const COLOR: Record<Token, string> = {
  empty: '#2a2430',
  you: '#ff8a5c',
  foe: '#ff5d73',
  gem: '#7ee0a0',
};

const GEM: SpriteDef = {
  rows: ['..gg..', '.gwwg.', 'gwwwwg', '.gwwg.', '..gg..'],
  pal: { g: '#7ee0a0', w: '#fff6dc' },
};

const FOE: SpriteDef = {
  rows: ['r.r.r', '.rrr.', 'rwewr', '.rrr.', 'r...r'],
  pal: { r: '#ff5d73', w: '#fff6dc', e: '#14081a' },
};

let chamber: HTMLCanvasElement | null = null;

function tower(): HTMLCanvasElement {
  if (chamber) return chamber;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#2a1420', '#14080c', '#0c0808'], 0, VH, 8);
  disc(g, 192, 96, 90, '#3a2418');
  disc(g, 192, 96, 74, '#1a1014');
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const x = 192 + Math.round(Math.cos(angle) * 84);
    const y = 96 + Math.round(Math.sin(angle) * 84);
    rect(g, x, y, i % 3 === 0 ? 4 : 2, i % 3 === 0 ? 4 : 2, '#c4a060');
  }
  chamber = c;
  return c;
}

function createScene(): GameScene<ClockState> {
  return {
    grade(): Grade {
      return { top: '#301820', bottom: '#10080c', bloom: 0.55, vignette: 0.86 };
    },
    anchor: () => ({ x: 192, y: 96 }),
    hits(_state, actions): HitRegion[] {
      return actions.map((action, index) => ({
        x: 40 + index * 110,
        y: 168,
        w: 96,
        h: 36,
        actionId: action.id,
      }));
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(tower(), 0, 0);
      const shrimp = buildSprite(SHRIMP);
      const gem = buildSprite(GEM);
      const foe = buildSprite(FOE);
      state.ring.forEach((token, index) => {
        const angle = (index / 8) * Math.PI * 2 - Math.PI / 2 + Math.sin(t * 0.6) * 0.02;
        const x = 192 + Math.round(Math.cos(angle) * 58);
        const y = 96 + Math.round(Math.sin(angle) * 58);
        const bob = Math.round(Math.sin(t * 3 + index) * 1);
        if (index === state.hand) glow(g, x, y, 16, '#ffc24a', 0.55);
        disc(g, x, y, 12, COLOR[token]);
        if (token === 'you') blit(g, shrimp, x, y + 6 + bob, { scale: 1, anchor: 'bc' });
        if (token === 'gem') blit(g, gem, x, y + bob, { scale: 2, anchor: 'c' });
        if (token === 'foe') blit(g, foe, x, y + bob, { scale: 2, anchor: 'c' });
      });
      const handAngle = (state.hand / 8) * Math.PI * 2 - Math.PI / 2;
      const hx = 192 + Math.round(Math.cos(handAngle) * 36);
      const hy = 96 + Math.round(Math.sin(handAngle) * 36);
      rect(g, 190, 94, hx - 190 || 2, 3, '#ffc24a');
      disc(g, hx, hy, 4, '#fff6dc');
      f.actions.forEach((action, index) => {
        const label = say(f, action.label);
        const x = 40 + index * 110;
        const on = f.focus?.id === action.id;
        rect(g, x, 170, 96, 32, on ? '#3a1820' : '#1a1014');
        rect(g, x, 170, 96, 2, on ? '#ffc24a' : '#6a4030');
        if (label) drawText(g, label, x + 48, 178, { color: '#fff4d6', align: 'center' });
      });
    },
    react(f, outcome) {
      const tick = outcome.events.find((event) => event.type === 'tick');
      if (!tick) return;
      const wounded = outcome.result.log.some((line) => line.includes('击中了你'));
      const shattered = outcome.result.log.some((line) => line.includes('珠'));
      f.cue(wounded ? 'bad' : shattered ? 'coin' : 'hit');
      const angle = (f.state.hand / 8) * Math.PI * 2 - Math.PI / 2;
      const x = 192 + Math.round(Math.cos(angle) * 58);
      const y = 96 + Math.round(Math.sin(angle) * 58);
      f.fx.burst(x, y, {
        count: 12,
        colors: wounded ? ['#ff5d73', '#fff6dc'] : ['#ffc24a', '#7ee0a0'],
        speed: 32,
        life: 0.4,
      });
      if (wounded) f.fx.addTrauma(0.4);
      f.fx.impact(2);
    },
  };
}

const module: GameModule<ClockState> = { definition, createScene };
export default module;
