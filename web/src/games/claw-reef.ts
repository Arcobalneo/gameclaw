import { definition } from '@games/claw-reef/src/definition';
import { coming, HEIGHT, onUrchin, type ReefState, WIDTH } from '@games/claw-reef/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  ctx2d,
  disc,
  dither,
  easeOutCubic,
  ellipse,
  hash01,
  line,
  makeCanvas,
  rect,
  withAlpha,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP, SHRIMP_WALK, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { tiny } from '../gfx/tiny';
import { blit, kelp, pips, plate, shadow } from '../gfx/world';

const CW = 40;
const CH = 30;
const OX = 32;
const OY = 36;

const BUOY: SpriteDef = {
  rows: ['YY.....', 'YYY....', 'YYYY...', '..w....', '..w....', '.bbb...'],
  pal: { Y: '#ffe08a', w: '#efe4cf', b: '#8a5a32' },
};
const BUOY_GOT: SpriteDef = {
  rows: ['..www..', '.wsssw.', '.wsbsw.', '..wsw..', '...w...'],
  pal: { w: '#c8b898', s: '#efe4cf', b: '#8a7050' },
};
const URCHIN: SpriteDef = {
  rows: ['s.s.s.s', '.sbbbs.', 'sbbppbs', '.sbbbs.', 's.s.s.s'],
  pal: { s: '#e4b0ff', b: '#7a3c98', p: '#2a1438' },
};
const HOOK: SpriteDef = {
  rows: ['....mm', '...m.m', '..m..m', '.m...m', 'mm...m', '.m...m', '..mmm.'],
  pal: { m: '#d5deea' },
};

interface ReefArt {
  buoy: HTMLCanvasElement;
  buoyGot: HTMLCanvasElement;
  urchin: HTMLCanvasElement;
  hook: HTMLCanvasElement;
  swimmer: HTMLCanvasElement;
  swimmerL: HTMLCanvasElement;
  stride: HTMLCanvasElement;
  strideL: HTMLCanvasElement;
}

let artCache: ReefArt | null = null;

function art(): ReefArt {
  if (artCache) return artCache;
  const pal = { b: '#ff7a55', c: '#ffd0a8' };
  artCache = {
    buoy: buildSprite(BUOY),
    buoyGot: buildSprite(BUOY_GOT),
    urchin: buildSprite(URCHIN),
    hook: buildSprite(HOOK),
    swimmer: buildSprite(SHRIMP, pal),
    swimmerL: buildSprite(SHRIMP, pal, { flip: true }),
    stride: buildSprite(SHRIMP_WALK, pal),
    strideL: buildSprite(SHRIMP_WALK, pal, { flip: true }),
  };
  return artCache;
}

let rocks: HTMLCanvasElement | null = null;

function cellX(x: number): number {
  return OX + x * CW;
}
function cellY(y: number): number {
  return OY + y * CH;
}

function rockLayer(): HTMLCanvasElement {
  if (rocks) return rocks;
  const c = makeCanvas(384, 216);
  const g = ctx2d(c);
  sky(g, ['#071820', '#0a2834', '#062028', '#041018'], 0, 216, 12);
  for (let i = 0; i < 70; i += 1) {
    const x = 20 + hash01(i, 3) * 340;
    const y = 150 + hash01(i, 4) * 50;
    ellipse(g, x, y, 8 + hash01(i, 5) * 18, 3, hash01(i, 6) > 0.5 ? '#0a3040' : '#041820');
  }
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const edge = x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1;
      const px = cellX(x);
      const py = cellY(y);
      if (!edge) {
        rect(g, px + 1, py + 1, CW - 3, CH - 3, '#1c4a52');
        rect(g, px + 1, py + 1, CW - 3, 2, '#3a7a78');
        rect(g, px + 1, py + CH - 4, CW - 3, 2, '#0c3038');
        if ((x + y) % 2 === 0) dither(g, px + 4, py + 6, CW - 10, CH - 10, '#246068', 0.35);
        continue;
      }
      rect(g, px, py, CW - 1, CH - 1, '#123038');
      rect(g, px, py, CW - 1, 2, '#2a5860');
      rect(g, px, py + CH - 3, CW - 1, 2, '#081820');
      const nubs = 2 + ((x * 3 + y) % 3);
      for (let k = 0; k < nubs; k += 1) {
        const nx = px + 4 + ((k * 11 + x * 5) % (CW - 10));
        const nh = 3 + ((k + y) % 4);
        rect(g, nx, py + 4, 3, nh, (x + k) % 2 ? '#c45a62' : '#d8a05a');
        rect(g, nx, py + 4, 3, 1, '#ffd0c0');
      }
    }
  }
  rocks = c;
  return c;
}

function tideVector(dir: string): [number, number] {
  if (dir === 'n') return [0, -1];
  if (dir === 's') return [0, 1];
  if (dir === 'w') return [-1, 0];
  return [1, 0];
}

function createScene(): GameScene<ReefState> {
  let shownX = 1;
  let shownY = 1;
  let hurt = false;
  let anchored = false;

  return {
    grade(): Grade {
      return { top: '#9ec8c0', bottom: '#04141c', bloom: 0.42, vignette: 0.78, strength: 0.35 };
    },
    anchor: (state) => ({ x: cellX(state.x) + CW / 2, y: cellY(state.y) + 8 }),
    reset(f) {
      shownX = f.state.x;
      shownY = f.state.y;
      hurt = false;
      anchored = false;
    },
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const regions: HitRegion[] = [];
      const spots: Array<[string, number, number]> = [
        ['step:n', state.x, state.y - 1],
        ['step:s', state.x, state.y + 1],
        ['step:w', state.x - 1, state.y],
        ['step:e', state.x + 1, state.y],
      ];
      for (const [id, x, y] of spots) {
        if (!actions.some((action) => action.id === id)) continue;
        regions.push({ x: cellX(x), y: cellY(y), w: CW - 2, h: CH - 2, actionId: id });
      }
      if (actions.some((action) => action.id === 'anchor')) {
        regions.push({
          x: cellX(state.x),
          y: cellY(state.y),
          w: CW - 2,
          h: CH - 2,
          actionId: 'anchor',
        });
      }
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(rockLayer(), 0, 0);
      stars(g, t, 4, 28, 70, '#d8fff4');
      moon(g, 336, 18, 8, '#fff6dc', '#7ec8c0');
      const dir = coming(state);
      const [tx, ty] = tideVector(dir);
      const drift = (t * 18) % CW;
      for (let y = 1; y < HEIGHT - 1; y += 1) {
        for (let x = 1; x < WIDTH - 1; x += 1) {
          const px = cellX(x) + 4;
          const py = cellY(y) + 8;
          const shift = Math.round(drift * 0.25);
          rect(g, px + ((x * 7 + shift) % (CW - 12)), py, 6, 1, withAlpha('#d8fff6', 0.28));
          rect(
            g,
            px + ((x * 5 + y * 3 + Math.round(t * 10)) % (CW - 14)),
            py + 10,
            4,
            1,
            withAlpha('#9ee0d8', 0.22),
          );
        }
      }
      for (let i = 0; i < 5; i += 1) {
        const base = 18 + i * 28;
        const fx = 8 + tx * ((t * 22 + i * 16) % 28);
        const fy = 8 + ty * ((t * 22 + i * 16) % 20);
        rect(g, base + fx, 22 + fy, 8, 2, withAlpha('#e8fff8', 0.55));
        rect(g, base + fx + tx * 6, 22 + fy + ty * 4, 3, 2, withAlpha('#ffffff', 0.7));
      }
      const focus = f.focus?.id ?? '';
      const marks = new Set(state.got);
      for (const goal of state.goals) {
        const x = goal[0] ?? 0;
        const y = goal[1] ?? 0;
        const got = marks.has(`${x},${y}`);
        const cx = cellX(x) + CW / 2;
        const cy = cellY(y) + CH / 2 + 2;
        if (!got) glow(g, cx, cy - 4, 10, '#ffd56a', 0.28 + Math.sin(t * 3 + x) * 0.08);
        blit(g, got ? art().buoyGot : art().buoy, cx, cy + 6, { scale: 2, anchor: 'bc' });
      }
      for (const cell of state.urchins) {
        const x = cell[0] ?? 0;
        const y = cell[1] ?? 0;
        const cx = cellX(x) + CW / 2;
        const cy = cellY(y) + CH / 2 + 4;
        const pulse = 1 + Math.sin(t * 4 + x) * 0.06;
        blit(g, art().urchin, cx, cy, { scale: 2 * pulse, anchor: 'c' });
      }
      if (focus.startsWith('step:') || focus === 'anchor') {
        const spot =
          focus === 'anchor'
            ? [state.x, state.y]
            : focus.endsWith('n')
              ? [state.x, state.y - 1]
              : focus.endsWith('s')
                ? [state.x, state.y + 1]
                : focus.endsWith('w')
                  ? [state.x - 1, state.y]
                  : [state.x + 1, state.y];
        rect(g, cellX(spot[0]!) + 1, cellY(spot[1]!) + 1, CW - 4, 1, '#ffe08a');
        rect(g, cellX(spot[0]!) + 1, cellY(spot[1]!) + 1, 1, CH - 4, '#ffe08a');
      }
      const k = Math.min(1, f.since / 0.32);
      const sx = shownX + (state.x - shownX) * easeOutCubic(k);
      const sy = shownY + (state.y - shownY) * easeOutCubic(k);
      if (k >= 1) {
        shownX = state.x;
        shownY = state.y;
      }
      const hop = anchored ? 0 : Math.sin(Math.min(1, f.since) * Math.PI) * (hurt ? 2 : 6);
      const bob = Math.sin(t * 2.2) * 1;
      const px = cellX(sx) + CW / 2;
      const py = cellY(sy) + CH - 4 + bob - hop;
      if (k < 1 && (shownX !== state.x || shownY !== state.y)) {
        line(
          g,
          cellX(shownX) + CW / 2,
          cellY(shownY) + CH / 2,
          px,
          py - 6,
          withAlpha('#e8fff8', 0.45 * (1 - k)),
        );
      }
      shadow(g, px, cellY(sy) + CH - 3, 12);
      const left = state.x < shownX || (state.x === shownX && coming(state) === 'w');
      const sheet = art();
      const frame =
        Math.floor(t * 4) % 2 === 0
          ? left
            ? sheet.swimmerL
            : sheet.swimmer
          : left
            ? sheet.strideL
            : sheet.stride;
      blit(g, frame, px, py, { scale: 2, anchor: 'bc' });
      if (anchored && f.since < 0.8) {
        const drop = easeOutCubic(Math.min(1, f.since / 0.25));
        blit(g, art().hook, px + 8, py - 16 + drop * 10, { scale: 2, anchor: 'bc' });
        if (onUrchin(state)) {
          disc(g, px, py - 2, 7, withAlpha('#d5deea', 0.35 * (1 - f.since)));
        }
      } else if (
        state.anchors < (state.difficulty === 'easy' ? 5 : state.difficulty === 'hard' ? 3 : 4)
      ) {
        blit(g, art().hook, px + 10, py - 2, { scale: 1, anchor: 'bc', alpha: 0.9 });
      }
      kelp(g, 18, 208, 28, t, '#1f6a58');
      kelp(g, 360, 210, 34, t + 1, '#174e48');
      for (let i = 0; i < 6; i += 1) {
        const bx = (hash01(i, 9) * 360 + t * 8) % 384;
        const by = 190 + hash01(i, 10) * 18 + Math.sin(t * 2 + i) * 2;
        disc(g, bx, by, 1, withAlpha('#e8fff8', 0.45));
      }
    },
    hud(f) {
      const { g, state } = f;
      const dir = say(f, { n: '北', e: '东', s: '南', w: '西' }[coming(state)]);
      rect(g, 8, 6, 150, 22, withAlpha('#041018', 0.72));
      if (dir) drawText(g, dir, 16, 10, { color: '#e8fff8', outline: '#041018' });
      tiny(g, `${state.tide + 1}/${state.tideCap}`, 52, 12, { color: '#9ee0d8' });
      pips(g, 250, 10, state.goals.length, state.got.length, '#ffd56a', -1, f.t);
      pips(g, 250, 20, Math.max(state.anchors, 1), state.anchors, '#d5deea', -1, f.t);
      const hint = say(f, '先走，潮再推。下锚压住海胆。');
      if (hint && state.notes.length === 0 && state.outcome === 'ongoing') {
        plate(g, hint, 192, 200, '#e8fff8', 340);
      }
    },
    react(f, outcome) {
      const event = outcome.events.find((item) => item.type === 'reef');
      const action = String(event?.action ?? '');
      const stung = outcome.result.log.some(
        (line) => line.includes('海胆') || line.includes('墙上'),
      );
      hurt = stung;
      anchored = action === 'anchor';
      const x = cellX(f.state.x) + CW / 2;
      const y = cellY(f.state.y) + 8;
      if (stung) {
        f.cue('bad');
        f.fx.shake(3.2);
        f.fx.burst(x, y, {
          count: 16,
          colors: ['#e4b0ff', '#ff6b6a', '#ffffff'],
          speed: 46,
          life: 0.55,
          shape: 'spark',
        });
        f.fx.float(x, y - 12, '!', '#ff8aa0', 0.9);
      } else if (action === 'anchor') {
        f.cue('splash');
        f.fx.burst(x, y, {
          count: 12,
          colors: ['#d5deea', '#e8fff8'],
          speed: 28,
          life: 0.45,
          shape: 'drop',
        });
      } else {
        f.cue('whoosh');
        f.fx.burst(x, y + 6, {
          count: 10,
          colors: ['#9ee0d8', '#ffffff'],
          speed: 24,
          life: 0.4,
          shape: 'drop',
        });
      }
      if (outcome.result.log.some((line) => line.includes('踩到'))) {
        f.cue('coin');
        f.fx.burst(x, y - 8, {
          count: 14,
          colors: ['#ffd56a', '#fff6dc'],
          speed: 36,
          life: 0.6,
        });
        f.fx.float(x, y - 18, '+', '#ffd56a', 0.9);
      }
    },
  };
}

const module: GameModule<ReefState> = { definition, createScene };
export default module;
