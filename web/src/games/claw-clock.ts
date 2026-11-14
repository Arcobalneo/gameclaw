import { definition } from '@games/claw-clock/src/definition';
import type { ClockState, Token } from '@games/claw-clock/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { bar, ctx2d, disc, hash01, makeCanvas, rect, VH, VW } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit } from '../gfx/world';

const GEM: SpriteDef = {
  rows: ['...gg...', '..gwwg..', '.gwwwwg.', 'ggwwwwgg', '.gwwwwg.', '..gwwg..', '...gg...'],
  pal: { g: '#7ee0a0', w: '#fff6dc' },
};

const FOE: SpriteDef = {
  rows: ['r..r..r', '.rrrrr.', 'rwreerw', '.rrrrr.', 'r.....r', '.r...r.'],
  pal: { r: '#ff5d73', w: '#fff6dc', e: '#14081a' },
};

const GEAR: SpriteDef = {
  rows: ['..g.g..', '.ggggg.', 'ggggggg', '.ggggg.', 'ggggggg', '.ggggg.', '..g.g..'],
  pal: { g: '#c4a060' },
};

let chamber: HTMLCanvasElement | null = null;

function tower(): HTMLCanvasElement {
  if (chamber) return chamber;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#3a1824', '#1a0c14', '#0c0808'], 0, VH, 8);
  disc(g, 192, 100, 96, '#4a3020');
  disc(g, 192, 100, 84, '#2a1810');
  disc(g, 192, 100, 70, '#140c0c');
  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2;
    const x = 192 + Math.round(Math.cos(angle) * 90);
    const y = 100 + Math.round(Math.sin(angle) * 90);
    rect(g, x, y, i % 2 === 0 ? 3 : 2, 2, '#e8d0a0');
  }
  for (let i = 0; i < 16; i += 1) {
    rect(g, hash01(i, 2) * 70, 20 + hash01(i, 3) * 160, 3, 3, '#3a2418');
    rect(g, 300 + hash01(i, 4) * 70, 20 + hash01(i, 5) * 160, 3, 3, '#3a2418');
  }
  chamber = c;
  return c;
}

function tokenSprite(token: Token) {
  if (token === 'gem') return buildSprite(GEM);
  if (token === 'foe') return buildSprite(FOE);
  if (token === 'you') return buildSprite(SHRIMP);
  return null;
}

function createScene(): GameScene<ClockState> {
  return {
    grade(): Grade {
      return { top: '#301820', bottom: '#10080c', bloom: 0.55, vignette: 0.86 };
    },
    anchor: () => ({ x: 192, y: 100 }),
    hits(_state, actions): HitRegion[] {
      return actions.map((action, index) => ({
        x: 28 + index * 120,
        y: 170,
        w: 108,
        h: 36,
        actionId: action.id,
      }));
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(tower(), 0, 0);
      const gear = buildSprite(GEAR);
      const spin = Math.floor(t * 2) % 2;
      blit(g, gear, 48, 48 + spin, { scale: 2, anchor: 'c' });
      blit(g, gear, 336, 160 - spin, { scale: 2, anchor: 'c' });
      state.ring.forEach((token, index) => {
        const angle = (index / 8) * Math.PI * 2 - Math.PI / 2;
        const x = 192 + Math.round(Math.cos(angle) * 52);
        const y = 100 + Math.round(Math.sin(angle) * 52);
        const bob = Math.round(Math.sin(t * 3 + index) * 1);
        disc(g, x, y, 14, index === state.hand ? '#3a2418' : '#1a1014');
        if (index === state.hand) glow(g, x, y, 18, '#ffc24a', 0.55);
        const sprite = tokenSprite(token);
        if (sprite) blit(g, sprite, x, y + bob, { scale: token === 'you' ? 1 : 2, anchor: 'c' });
        else disc(g, x, y, 4, '#2a2430');
      });
      const hand = (state.hand / 8) * Math.PI * 2 - Math.PI / 2;
      for (let r = 8; r <= 40; r += 4) {
        const x = 192 + Math.round(Math.cos(hand) * r);
        const y = 100 + Math.round(Math.sin(hand) * r);
        rect(g, x, y, 3, 3, r > 28 ? '#fff6dc' : '#ffc24a');
      }
      bar(g, 16, 16, 64, 6, 1 - state.steps / Math.max(1, state.stepCap), '#ffc24a');
      bar(g, 304, 16, 64, 6, state.wounds / Math.max(1, state.woundLimit), '#ff5d73');
      f.actions.forEach((action, index) => {
        const label = say(f, action.label);
        const x = 28 + index * 120;
        const on = f.focus?.id === action.id;
        rect(g, x, 172, 108, 32, on ? '#3a1820' : '#1a0c10');
        rect(g, x, 172, 108, 3, on ? '#ffc24a' : '#6a4030');
        if (label) drawText(g, label, x + 54, 180, { color: '#fff4d6', align: 'center' });
      });
    },
    react(f, outcome) {
      const tick = outcome.events.find((event) => event.type === 'tick');
      if (!tick) return;
      const wounded = outcome.result.log.some((line) => line.includes('击中了你'));
      const gem = outcome.result.log.some((line) => line.includes('珠'));
      f.cue(wounded ? 'bad' : gem ? 'coin' : 'hit');
      const angle = (f.state.hand / 8) * Math.PI * 2 - Math.PI / 2;
      const x = 192 + Math.round(Math.cos(angle) * 52);
      const y = 100 + Math.round(Math.sin(angle) * 52);
      f.fx.burst(x, y, {
        count: wounded ? 16 : 10,
        colors: wounded
          ? ['#ff5d73', '#fff6dc']
          : gem
            ? ['#7ee0a0', '#fff6dc']
            : ['#ffc24a', '#fff6dc'],
        speed: 36,
        life: 0.45,
        shape: gem ? 'spark' : 'sq',
      });
      if (wounded) {
        f.fx.addTrauma(0.5);
        f.fx.flash('#ff5d73', 0.3);
      } else f.fx.kick(2, 0);
      f.fx.impact(2);
    },
  };
}

const module: GameModule<ClockState> = { definition, createScene };
export default module;
