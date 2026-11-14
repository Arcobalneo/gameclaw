import { ITEM_LABEL, type Item } from '@games/claw-round/src/content';
import { definition } from '@games/claw-round/src/definition';
import type { RoundState } from '@games/claw-round/src/engine';
import type { Grade } from '../gfx/art';
import { sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  ctx2d,
  dither,
  ellipse,
  hash01,
  makeCanvas,
  mix,
  rect,
  VH,
  VW,
  withAlpha,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, kelp, pips, plate, shadow } from '../gfx/world';

const ITEM_COLOR: Record<Item, string> = {
  ticket: '#f3e2b0',
  lamp: '#ffc24a',
  coin: '#ffe08a',
  rope: '#d08948',
  bell: '#ff6d8a',
};

const ITEM_SPRITE: Record<Item, SpriteDef> = {
  ticket: {
    rows: ['cccccc', 'c....c', 'c.ss.c', 'c....c', 'cccccc'],
    pal: { c: '#f3e2b0', s: '#8a5a28' },
  },
  lamp: {
    rows: ['..yy..', '.yyyy.', 'yyyyyy', '.oooo.', '..oo..', '..dd..'],
    pal: { y: '#ffe08a', o: '#ff9a2a', d: '#6a3a18' },
  },
  coin: {
    rows: ['..gg..', '.gggg.', 'gg..gg', '.gggg.', '..gg..'],
    pal: { g: '#ffe08a' },
  },
  rope: {
    rows: ['rr..rr', '.rrrr.', 'rr..rr', '.rrrr.', 'rr..rr'],
    pal: { r: '#d08948' },
  },
  bell: {
    rows: ['..mm..', '.bbbb.', 'bbbbbb', '.bbbb.', '..yy..'],
    pal: { m: '#fff6dc', b: '#ff6d8a', y: '#ffe08a' },
  },
};

let pierCache: HTMLCanvasElement | null = null;

function pier(): HTMLCanvasElement {
  if (pierCache) return pierCache;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#16325c', '#0c2040', '#081628', '#061018'], 0, VH, 12);
  stars(g, 0.4, 3, 28, 90);
  for (let i = 0; i < 160; i += 1) {
    const x = hash01(i, 3) * VW;
    const y = 150 + hash01(i, 4) * 66;
    rect(g, x, y, 2, 1, mix('#0a3050', '#1a5070', hash01(i, 5)));
  }
  rect(g, 0, 176, VW, 40, '#0c3a58');
  dither(g, 0, 168, VW, 24, '#7ec8ff', 0.12);
  for (let i = 0; i < 5; i += 1) {
    const x = 36 + i * 70;
    rect(g, x, 148, 52, 12, '#6a4428');
    rect(g, x, 148, 52, 2, '#c48a52');
    rect(g, x + 6, 160, 4, 22, '#3a2414');
    rect(g, x + 42, 160, 4, 22, '#3a2414');
  }
  pierCache = c;
  return c;
}

function itemSprite(item: Item): HTMLCanvasElement {
  return buildSprite(ITEM_SPRITE[item], {}, { rim: '#fff6dc' });
}

function createScene(): GameScene<RoundState> {
  return {
    grade(): Grade {
      return { top: '#9ec8ff', bottom: '#020810', bloom: 0.5, vignette: 0.82 };
    },
    anchor: (state) => ({ x: 62 + state.pos * 70, y: 140 }),
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      return state.spots.map((_, index) => ({
        x: 28 + index * 70,
        y: 96,
        w: 64,
        h: 68,
        actionId:
          index === state.pos
            ? (actions.find((action) => action.id === 'grab' || action.id === 'pocket')?.id ??
              'step:e')
            : index > state.pos
              ? 'step:e'
              : 'step:w',
      }));
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(pier(), 0, 0);
      glow(g, 330, 34, 22, '#fff6dc', 0.35 + 0.08 * Math.sin(t));
      ellipse(g, 330, 34, 11, 11, '#fff3d4');
      ellipse(g, 326, 30, 3, 3, '#ffffff');
      for (let i = 0; i < 5; i += 1) {
        const x = 62 + i * 70;
        const sway = Math.round(Math.sin(t * 1.4 + i) * 2);
        rect(g, x - 2, 70, 2, 78, '#2a2014');
        glow(g, x + sway, 74, 8, '#ffb45a', 0.35);
        rect(g, x - 4 + sway, 70, 8, 6, '#ffd27a');
        kelp(g, x, 214, 20 + (i % 3) * 6, t, '#1d7050');
      }
      rect(g, 40, 146, 320, 2, '#8a5a30');
      const rise = (state.beat / Math.max(1, state.beats)) * 24;
      rect(g, 0, 178 - rise, VW, 38 + rise, withAlpha('#0e4a72', 0.5));
      for (let i = 0; i < 8; i += 1) {
        const x = (i * 54 + Math.round(t * 24)) % 430;
        rect(g, x, 184 - rise + (i % 3) * 5, 18, 2, withAlpha('#c8f0ff', 0.6));
      }
      state.need.forEach((item, index) => {
        const kept = state.pocket.includes(item);
        blit(g, itemSprite(item), 24 + index * 40, 30, {
          scale: 2,
          anchor: 'c',
          alpha: kept ? 0.35 : 1,
        });
        if (kept) glow(g, 24 + index * 40, 30, 10, '#7ee0a0', 0.45);
      });
      state.spots.forEach((item, index) => {
        const x = 62 + index * 70;
        const bob = Math.round(Math.sin(t * 2.4 + index) * 2);
        if (index === state.pos) glow(g, x, 130, 18, '#ffc24a', 0.32 + 0.12 * Math.sin(t * 5));
        if (!item) return;
        shadow(g, x, 148, 18);
        blit(g, itemSprite(item), x, 128 + bob, { scale: 2, anchor: 'c' });
        const label = say(f, ITEM_LABEL[item]);
        if (label) plate(g, label, x, 92, ITEM_COLOR[item], 72);
      });
      for (let i = 0; i < 3; i += 1) {
        const x = Math.round((40 + i * 120 + t * 18) % 400);
        const y = 48 + (i % 2) * 10 + Math.round(Math.sin(t * 2 + i) * 3);
        rect(g, x, y, 8, 2, '#d8e8ff');
        rect(g, x + 8, y, 4, 1, '#ffffff');
      }
      const bob = Math.round(Math.sin(t * 4) * 1);
      shadow(g, 62 + state.pos * 70, 152, 20);
      blit(g, buildSprite(SHRIMP), 62 + state.pos * 70, 150 + bob, { scale: 2, anchor: 'bc' });
      if (state.held) {
        blit(g, itemSprite(state.held), 84 + state.pos * 70, 112, { scale: 2, anchor: 'c' });
      }
      const focus = f.focus ? say(f, f.focus.label) : '';
      if (focus) plate(g, focus, 62 + state.pos * 70, 166, '#fff4d6', 84);
    },
    hud(f) {
      const { g, t, state } = f;
      const beat = say(f, '拍');
      const wrong = say(f, '错袋');
      const tide = say(f, '潮');
      if (beat) drawText(g, beat, 150, 8, { color: '#9fd8ff' });
      pips(g, beat ? 178 : 150, 10, state.beats, state.beat, '#7ec8ff', state.beat, t);
      const wrongLabel = f.lang === 'en' ? 'Miss' : wrong;
      if (wrongLabel) drawText(g, wrongLabel, 8, 46, { color: '#ff8aa0' });
      pips(g, wrongLabel ? 48 : 8, 48, Math.max(state.wrong, 1), state.wrong, '#ff6d8a', -1, t);
      if (tide) drawText(g, `${tide} ${state.loop}/${state.loops}`, 300, 8, { color: '#fff4d6' });
    },
    react(f, outcome) {
      const tide = outcome.result.log.some((line) => line.includes('潮'));
      const pocket = outcome.events.some((event) => event.type === 'pocket');
      if (tide) {
        f.fx.splash(190, 170, '#9fd8ff', 24);
        f.fx.flash('#7ec8ff', 0.3);
        f.cue('splash');
      } else if (pocket) {
        f.fx.burst(70, 28, { count: 16, colors: ['#7ee0a0', '#fff6dc'], speed: 42, life: 0.55 });
        f.cue('coin');
      } else f.cue('land');
    },
  };
}

const module: GameModule<RoundState> = { definition, createScene };
export default module;
