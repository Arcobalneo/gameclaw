import { definition } from '@games/claw-lamp/src/definition';
import { type LampState, POOL_CELLS } from '@games/claw-lamp/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  ctx2d,
  disc,
  dither,
  easeOutBack,
  ellipse,
  hash01,
  line,
  makeCanvas,
  rect,
  withAlpha,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, kelp, pips, plate, shadow } from '../gfx/world';

const OX = 34;
const OY = 58;
const CW = 52;
const CH = 24;

const LANTERN: SpriteDef = {
  rows: ['..www..', '.wYYYw.', '.wYyYw.', '.wYYYw.', '..www..', '...p...', '...p...'],
  pal: { w: '#6a4428', Y: '#ffe7a8', y: '#ffb45a', p: '#3a2818' },
};
const POST: SpriteDef = {
  rows: ['..w..', '.wdw.', '..w..', '..w..', '..w..', '.bbb.'],
  pal: { w: '#a87848', d: '#6a4428', b: '#3a2818' },
};
const BOWL: SpriteDef = {
  rows: ['..aaaa..', '.a....a.', 'a......a', '.aaaaaa.'],
  pal: { a: '#1a4a52' },
};

const MOTH: SpriteDef = {
  rows: ['y.y', '.b.', 'y.y'],
  pal: { y: '#ffe7a8', b: '#6a4428' },
};
const CRATE: SpriteDef = {
  rows: ['wwwww', 'wdddw', 'wYYYw', 'wdddw', 'wwwww'],
  pal: { w: '#8a5a32', d: '#5a3818', Y: '#ffd27a' },
};

interface LampArt {
  lantern: HTMLCanvasElement;
  post: HTMLCanvasElement;
  bowl: HTMLCanvasElement;
  keeper: HTMLCanvasElement;
  keeperStep: HTMLCanvasElement;
  moth: HTMLCanvasElement;
  crate: HTMLCanvasElement;
}

let artCache: LampArt | null = null;

function art(): LampArt {
  if (artCache) return artCache;
  const pal = { b: '#ffb45a', h: '#ffe7a8', c: '#fff1c8' };
  artCache = {
    lantern: buildSprite(LANTERN),
    post: buildSprite(POST),
    bowl: buildSprite(BOWL),
    keeper: buildSprite(SHRIMP, pal),
    keeperStep: buildSprite(SHRIMP, pal, { flip: true }),
    moth: buildSprite(MOTH, {}, { shade: false }),
    crate: buildSprite(CRATE),
  };
  return artCache;
}

let shoal: HTMLCanvasElement | null = null;

function at(x: number, y: number): { x: number; y: number } {
  return { x: OX + x * CW + CW / 2, y: OY + y * CH + CH / 2 };
}

function shoalLayer(): HTMLCanvasElement {
  if (shoal) return shoal;
  const c = makeCanvas(384, 216);
  const g = ctx2d(c);
  sky(g, ['#140e28', '#10182e', '#0c1424', '#081018'], 0, 56, 8);
  for (let i = 0; i < 6; i += 1) {
    const x = 12 + i * 64;
    const h = 8 + (i % 3) * 5;
    rect(g, x, 40 - h, 18, h, '#1a1428');
    rect(g, x + 3, 36 - h, 4, 4, i % 2 ? '#ffb45a' : '#3a3058');
  }
  rect(g, 0, 46, 384, 132, '#101c28');
  ellipse(g, 192, 112, 180, 64, '#1c3344');
  ellipse(g, 192, 108, 154, 48, '#274050');
  dither(g, 20, 64, 340, 100, '#3a5870', 0.14);
  for (let i = 0; i < 50; i += 1) {
    const x = 20 + hash01(i, 2) * 340;
    const y = 64 + hash01(i, 3) * 100;
    rect(g, x, y, 2 + (i % 3), 1, hash01(i, 4) > 0.55 ? '#6a5040' : '#1a2834');
  }
  for (let i = 0; i < 9; i += 1) {
    const x = 40 + hash01(i, 11) * 300;
    const y = 70 + hash01(i, 12) * 90;
    ellipse(g, x, y, 7 + (i % 3) * 2, 4, '#3a4450');
    ellipse(g, x - 1, y - 1, 4, 2, '#6a7888');
  }
  rect(g, 300, 168, 28, 6, '#6a4428');
  rect(g, 304, 164, 18, 4, '#8a5a32');
  rect(g, 312, 158, 2, 8, '#c48a52');
  rect(g, 0, 176, 384, 40, '#081820');
  shoal = c;
  return c;
}

function createScene(): GameScene<LampState> {
  let dropped = -1;

  return {
    grade(): Grade {
      return { top: '#ffb45a', bottom: '#07060f', bloom: 0.5, vignette: 0.8, strength: 0.28 };
    },
    anchor: () => ({ x: 190, y: 110 }),
    reset() {
      dropped = -1;
    },
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const regions: HitRegion[] = [];
      state.posts.forEach((post, index) => {
        const place = actions.find((action) => action.id === `place:${index}`);
        const lift = actions.find((action) => action.id === `lift:${index}`);
        const id = place?.id ?? lift?.id;
        if (!id) return;
        const pos = at(post.x, post.y);
        regions.push({ x: pos.x - 18, y: pos.y - 22, w: 36, h: 40, actionId: id });
      });
      if (actions.some((action) => action.id === 'seal')) {
        regions.push({ x: 292, y: 178, w: 80, h: 28, actionId: 'seal' });
      }
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(shoalLayer(), 0, 0);
      stars(g, t, 11, 36, 78, '#ffe7c0');
      moon(g, 46, 28, 9, '#fff6dc', '#ffb45a');
      for (let i = 0; i < 14; i += 1) {
        const x = (i * 28 + Math.round(t * 12)) % 400;
        const y = 176 + (i % 4) * 8 + Math.sin(t * 1.6 + i) * 2;
        rect(g, x, y, 12, 1, withAlpha('#7ec8c8', 0.28));
      }
      const focus = f.focus?.id ?? '';
      for (let i = 0; i < state.pools; i += 1) {
        const spot = POOL_CELLS[i] ?? [3, 2];
        const pos = at(spot[0], spot[1]);
        const lit = state.posts.some(
          (post, index) => state.placed[index] && post.covers.includes(i),
        );
        blit(g, art().bowl, pos.x, pos.y + 8, { scale: 2, anchor: 'c' });
        const ripple = (t * 10 + i * 4) % 8;
        ellipse(
          g,
          pos.x,
          pos.y + 6,
          6 + ripple * 0.3,
          2,
          withAlpha(lit ? '#b8fff0' : '#14343c', 0.45),
        );
        disc(g, pos.x, pos.y + 6, lit ? 4 : 3, lit ? '#7ee0c8' : '#102830');
        if (lit) {
          glow(g, pos.x, pos.y + 4, 14, '#7ee0c8', 0.32 + Math.sin(t * 3 + i) * 0.08);
          rect(g, pos.x - 1, pos.y + 4, 2, 1, '#ffffff');
        }
      }
      state.posts.forEach((post, index) => {
        const pos = at(post.x, post.y);
        const on = state.placed[index] === true;
        const focused = focus === `place:${index}` || focus === `lift:${index}`;
        if (focused) {
          for (const pool of post.covers) {
            const spot = POOL_CELLS[pool] ?? [3, 2];
            const to = at(spot[0], spot[1]);
            line(g, pos.x, pos.y - 8, to.x, to.y + 4, withAlpha('#ffd27a', 0.55));
          }
          for (const other of post.sees) {
            const seen = state.posts[other];
            if (!seen) continue;
            const to = at(seen.x, seen.y);
            line(g, pos.x, pos.y - 6, to.x, to.y - 6, withAlpha('#ff6a7a', 0.7));
          }
        }
        shadow(g, pos.x, pos.y + 10, 10);
        blit(g, art().post, pos.x, pos.y + 8, { scale: 2, anchor: 'bc' });
        if (!on) {
          disc(g, pos.x, pos.y - 12, 2, '#2a2018');
          return;
        }
        const fresh = dropped === index ? easeOutBack(Math.min(1, f.since / 0.35)) : 1;
        const flicker = 0.42 + Math.sin(t * 7 + index * 1.7) * 0.12;
        glow(g, pos.x, pos.y - 16, 18 * fresh, '#ffb45a', flicker);
        glow(g, pos.x, pos.y - 16, 8, '#fff1c8', 0.4);
        blit(g, art().lantern, pos.x, pos.y - 4 + (1 - fresh) * 8, {
          scale: 2,
          anchor: 'bc',
          alpha: fresh,
        });
      });
      const bob = Math.round(Math.sin(t * 2) * 1);
      const step = Math.floor(t * 2) % 2;
      const walk = 28 + ((t * 14) % 70);
      blit(g, step ? art().keeperStep : art().keeper, walk, 204 + bob, { scale: 2, anchor: 'bc' });
      blit(g, art().crate, 78, 198, { scale: 2, anchor: 'bc' });
      for (let i = 0; i < state.stock; i += 1) {
        blit(g, art().lantern, 70 + i * 8, 186, { scale: 1, anchor: 'bc' });
      }
      state.posts.forEach((post, index) => {
        if (!state.placed[index]) return;
        const pos = at(post.x, post.y);
        const mx = pos.x + Math.sin(t * 3 + index) * 10;
        const my = pos.y - 22 + Math.cos(t * 4 + index) * 4;
        blit(g, art().moth, mx, my, { scale: 1, anchor: 'c' });
        const waterY = 186 + Math.sin(t + index) * 2;
        glow(g, pos.x, waterY, 8, '#ffb45a', 0.18);
        ellipse(g, pos.x, waterY, 7, 2, withAlpha('#ffd27a', 0.25));
      });
      kelp(g, 8, 212, 22, t, '#143c38');
      kelp(g, 372, 214, 26, t + 2, '#0e3030');
      const seal = say(f, '封滩');
      if (seal && f.actions.some((action) => action.id === 'seal')) {
        const hot = f.focus?.id === 'seal';
        rect(g, 292, 178, 80, 28, hot ? '#4a3014' : '#1c140c');
        rect(g, 292, 178, 80, 2, '#ffd27a');
        rect(g, 292, 204, 80, 2, '#6a4428');
        drawText(g, seal, 332, 184, { color: '#fff4d6', align: 'center' });
      }
    },
    hud(f) {
      const { g, state } = f;
      rect(g, 8, 6, 168, 20, withAlpha('#100c18', 0.72));
      pips(g, 14, 12, state.stages, state.cleared, '#ffd27a', state.stage - 1, f.t);
      const tide = Math.max(1, state.tide);
      for (let i = 0; i < Math.min(tide, 8); i += 1) {
        rect(g, 250 + i * 8, 10, 6, 8, i < state.tide ? '#7ec8ff' : '#1a2838');
      }
      for (let i = 0; i < state.stock; i += 1) {
        disc(g, 250 + i * 10, 28, 3, '#ffd27a');
      }
      const hint = say(f, '灯不能对视。宽柱会挡住封滩。');
      if (hint && state.notes.length === 0 && state.outcome === 'ongoing') {
        plate(g, hint, 160, 192, '#ffe7a8', 240);
      }
    },
    react(f, outcome) {
      const kind = String(outcome.events[0]?.type ?? '');
      if (kind.startsWith('place:')) {
        dropped = Number(kind.slice(6));
        f.cue('good');
        const post = f.state.posts[dropped];
        const pos = post ? at(post.x, post.y) : { x: 190, y: 90 };
        f.fx.burst(pos.x, pos.y - 10, {
          count: 16,
          colors: ['#ffd27a', '#fff6dc', '#7ee0c8'],
          speed: 40,
          life: 0.55,
          glow: true,
        });
        f.fx.float(pos.x, pos.y - 22, '+', '#ffe7a8');
      } else if (kind.startsWith('lift:')) {
        dropped = -1;
        f.cue('bad');
        f.fx.shake(2);
        f.fx.float(190, 80, '-', '#ff8aa0', 0.8);
      } else if (kind === 'seal') {
        dropped = -1;
        f.cue('coin');
        f.fx.burst(200, 90, {
          count: 24,
          colors: ['#7ee0c8', '#fff6dc', '#ffd27a'],
          speed: 52,
          life: 0.7,
          glow: true,
        });
      }
    },
  };
}

const module: GameModule<LampState> = { definition, createScene };
export default module;
