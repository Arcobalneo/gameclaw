import { MATERIALS } from '@games/shrimp-burger/src/content';
import { definition } from '@games/shrimp-burger/src/definition';
import type { BurgerState } from '@games/shrimp-burger/src/engine';
import { humanoid } from '../gfx/actors';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  bar,
  type Ctx,
  ctx2d,
  dither,
  easeOutBack,
  hash01,
  makeCanvas,
  mix,
  panel,
  rect,
  VH,
  VW,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { BUN_TOP, buildSprite, CAT, PIGEON, RACCOON, type SpriteDef } from '../gfx/sprites';
import { drawText, fitText } from '../gfx/text';
import { tiny } from '../gfx/tiny';
import { blit, plate, shadow } from '../gfx/world';

const MAT: Record<string, { color: string; h: number; wavy?: boolean }> = {
  bun: { color: '#f0a24a', h: 4 },
  patty: { color: '#6a3a22', h: 4 },
  cheese: { color: '#ffd23f', h: 2, wavy: true },
  lettuce: { color: '#5fd35f', h: 2, wavy: true },
  tomato: { color: '#ff4848', h: 2 },
  pickle: { color: '#8ab84a', h: 2 },
  sauce: { color: '#e83a2a', h: 1 },
  bacon: { color: '#d8604a', h: 2, wavy: true },
  egg: { color: '#fff4d0', h: 2 },
  seaweed: { color: '#1f5a3a', h: 2 },
  sock: { color: '#c49aff', h: 3 },
  battery: { color: '#4fd1ff', h: 3 },
  'cheese-bacon': { color: '#ffb347', h: 3, wavy: true },
  'garden-wrap': { color: '#7ee07a', h: 3, wavy: true },
  'pickle-egg': { color: '#d8f08a', h: 3 },
  'golden-bun': { color: '#ffe066', h: 4 },
  'sock-patty': { color: '#9a6ad0', h: 4 },
  'sauce-cheese': { color: '#ff8a3a', h: 3, wavy: true },
};
const COLS = [120, 190, 260];
const CATCH_Y = 150;
const PLATE_X = 52;
const PLATE_Y = 184;

const VERDICT: Record<string, [string, string]> = {
  tasty: ['美味!', 'TASTY!'],
  lucky: ['歪打正着!', 'LUCKY!'],
  bad: ['难吃…', 'BLEH...'],
  disaster: ['灾难!!', 'DISASTER!'],
};

let kitchen: HTMLCanvasElement | null = null;
/** Diner kitchen, painted once: tiled wall, shelf with jars, grill hood, steel counter. */
function kitchenBg(): HTMLCanvasElement {
  if (kitchen) return kitchen;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#3a1a0e', '#2a1208', '#1a0a04'], 0, VH, 8);
  for (let y = 0; y < 160; y += 10)
    for (let x = 0; x < VW; x += 10) {
      const k = hash01(x, y) * 0.15;
      rect(g, x, y, 9, 9, mix('#a89878', '#8a7a60', k));
      rect(g, x, y, 9, 1, '#c8b898');
      rect(g, x, y + 9, 10, 1, '#5a4a38');
      rect(g, x + 9, y, 1, 10, '#5a4a38');
    }
  // Warm grime toward the grill + darkening low.
  for (let y = 0; y < 160; y += 1) {
    g.fillStyle = `rgba(40,16,4,${(0.35 + (y / 160) * 0.35).toFixed(3)})`;
    g.fillRect(0, y, VW, 1);
  }
  // Checkered trim.
  for (let x = 0; x < VW; x += 6) rect(g, x, 100, 6, 6, (x / 6) % 2 ? '#c83a2a' : '#f0e8d8');
  // Shelf with jars.
  rect(g, 112, 18, 170, 4, '#6a3a1a');
  rect(g, 112, 18, 170, 1, '#a06a3a');
  const jars = ['#e83a2a', '#ffd23f', '#5fd35f', '#8ab84a', '#ff8a3a', '#c8c8d8'];
  for (let i = 0; i < 9; i += 1) {
    const x = 118 + i * 18;
    const col = jars[i % jars.length]!;
    rect(g, x, 6, 10, 12, mix(col, '#000000', 0.25));
    rect(g, x + 1, 8, 8, 9, col);
    rect(g, x + 2, 9, 2, 6, mix(col, '#ffffff', 0.5));
    rect(g, x - 1, 4, 12, 3, '#3a3a4a');
  }
  // Grill hood behind the heat gauge.
  rect(g, 318, 60, 56, 10, '#5a5a6a');
  rect(g, 318, 60, 56, 1, '#a8a8b8');
  for (let k = 0; k < 8; k += 1) rect(g, 322 + k, 70 + k, 48 - k * 2, 1, '#3a3a48');
  // Counter: brushed steel top, wood front.
  rect(g, 0, 158, VW, 6, '#9aa0b0');
  rect(g, 0, 158, VW, 1, '#e0e4f0');
  rect(g, 0, 164, VW, 2, '#4a4a58');
  rect(g, 0, 166, VW, VH - 166, '#5a3018');
  for (let x = 0; x < VW; x += 24) rect(g, x, 166, 1, VH - 166, '#3a1e0e');
  dither(g, 0, 176, VW, VH - 176, '#2a1408', 0.3);
  kitchen = c;
  return c;
}

const layerCache = new Map<string, HTMLCanvasElement>();

/** Food-shaped ingredient layer (bun dome, wavy lettuce, cheese drips...). */
function layer(id: string, w = 22): HTMLCanvasElement {
  const key = `${id}|${w}`;
  const hit = layerCache.get(key);
  if (hit) return hit;
  const m = MAT[id] ?? { color: '#aaaaaa', h: 3 };
  const h = m.h + 2;
  const rows: string[] = [];
  for (let y = 0; y < h + 2; y += 1) {
    let row = '';
    for (let x = 0; x < w; x += 1) {
      const edge = Math.min(x, w - 1 - x);
      let ch = '.';
      if (y < h) {
        const dome = id.includes('bun') ? Math.max(0, 3 - y) : 0;
        if (edge >= dome && !(y === 0 && edge === 0) && !(y === h - 1 && edge === 0))
          ch = y === 0 ? 'h' : y === h - 1 ? 'd' : 'b';
        if (id === 'patty' && ch === 'b' && (x + y * 3) % 5 === 0) ch = 'd';
        if (id.includes('bun') && y === 1 && x % 5 === 2 && edge > 3) ch = 's';
        if (id === 'tomato' && ch === 'b' && x % 4 === 1) ch = 's';
      } else if (m.wavy && y === h && x % 4 === 1 && edge > 1) ch = 'b';
      else if (m.wavy && y === h + 1 && x % 8 === 1 && edge > 2) ch = 'd';
      row += ch;
    }
    rows.push(row);
  }
  const sprite = buildSprite(
    {
      rows,
      pal: {
        b: m.color,
        h: mix(m.color, '#ffffff', 0.4),
        d: mix(m.color, '#000000', 0.35),
        s: '#fff4d0',
      },
    },
    {},
    { rim: '#ffffff' },
  );
  layerCache.set(key, sprite);
  return sprite;
}

const PEST_SPRITES: Record<string, SpriteDef> = {
  raccoon: RACCOON,
  pigeon: PIGEON,
  seagull: PIGEON,
  cat: CAT,
  mouse: RACCOON,
};

function drawHeatGauge(
  g: Ctx,
  x: number,
  y: number,
  h: number,
  heat: number,
  min: number,
  max: number,
  t: number,
): void {
  panel(g, x - 7, y - 4, 14, h + 8, '#140a06', '#4a2a14');
  const toY = (v: number) => y + h - (Math.max(0, Math.min(100, v)) / 100) * h;
  rect(g, x - 3, toY(max), 6, toY(min) - toY(max), '#2a5a2a');
  const hy = toY(heat);
  for (let yy = hy; yy < y + h; yy += 1) {
    const k = (y + h - yy) / h;
    rect(g, x - 3, yy, 6, 1, mix('#ffb347', '#ff2a2a', k));
  }
  glow(g, x, hy, 12, '#ff7a2a', 0.4 + 0.15 * Math.sin(t * 8));
  rect(g, x - 5, hy, 10, 1, '#ffffff');
}

function createScene(): GameScene<BurgerState> {
  let catchFx: { slot: number; t: number } | null = null;
  let serveT = -10;
  let lastVerdict = '';

  return {
    anchor: () => ({ x: PLATE_X, y: 120 }),
    hits(state, actions): HitRegion[] {
      const out: HitRegion[] = [];
      for (const a of actions) {
        const m = /^catch:(\d)$/.exec(a.id);
        if (m)
          out.push({
            x: COLS[Number(m[1])]! - 26,
            y: 20,
            w: 52,
            h: CATCH_Y + 10 - 20,
            actionId: a.id,
          });
        if (a.id === 'serve') out.push({ x: PLATE_X - 30, y: 110, w: 60, h: 84, actionId: a.id });
        if (a.id === 'soothe') out.push({ x: 300, y: 18, w: 80, h: 64, actionId: a.id });
        const p = /^shoo:(.+)$/.exec(a.id);
        if (p) {
          const i = state.pests.findIndex((x) => x.id === p[1]);
          if (i >= 0) out.push({ x: 84 + i * 26 - 10, y: 168, w: 22, h: 22, actionId: a.id });
        }
      }
      return out;
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(kitchenBg(), 0, 0);
      // Drop columns.
      COLS.forEach((cx, slot) => {
        const item = state.falling.find((it) => it.slot === slot);
        const focus = f.focus?.id === `catch:${slot}`;
        g.fillStyle = focus ? 'rgba(255,224,102,0.12)' : 'rgba(255,240,220,0.05)';
        g.fillRect(cx - 24, 26, 48, CATCH_Y - 26);
        rect(g, cx - 24, CATCH_Y + 4, 48, 2, focus ? '#ffe066' : '#6a4224');
        drawText(g, String(slot + 1), cx, CATCH_Y + 7, {
          color: focus ? '#ffe066' : '#a0784a',
          align: 'center',
        });
        if (!item) return;
        const fall = 40 + ((t * 18 + slot * 23) % 70);
        const y = Math.round(fall);
        if (item.kind === 'heat') {
          const c =
            item.heatGrade === 'rare'
              ? '#ff8a8a'
              : item.heatGrade === 'medium'
                ? '#ffb347'
                : '#ff3a1a';
          glow(g, cx, y, 18, c, 0.5);
          for (let r = 6; r > 0; r -= 2)
            rect(g, cx - r, y - r, r * 2, r * 2, mix(c, '#ffffff', (6 - r) / 10));
          drawText(g, `${item.heatValue}°`, cx, y + 10, { color: '#ffe0c0', align: 'center' });
        } else {
          const id = item.materialId ?? 'bun';
          const unstable = item.kind === 'fusion';
          if (unstable) glow(g, cx, y, 22, '#ff7ad9', 0.4 + 0.2 * Math.sin(t * 10));
          const onRecipe =
            state.recipe.required.includes(id as never) ||
            state.recipe.optional.includes(id as never);
          if (!onRecipe && !unstable) glow(g, cx, y, 14, '#ff3a5a', 0.25);
          blit(g, layer(id, 20), cx, y, { anchor: 'c', scale: 2 });
          const nm = say(f, item.name);
          if (nm)
            drawText(g, fitText(nm, 50), cx, y + 9, {
              color: unstable ? '#ff9ae0' : onRecipe ? '#fff4d6' : '#ff9a9a',
              align: 'center',
            });
        }
      });
      if (catchFx && t - catchFx.t < 0.3) {
        const cx = COLS[catchFx.slot]!;
        glow(g, cx, CATCH_Y, 30, '#ffe066', 0.6 * (1 - (t - catchFx.t) / 0.3));
      }
      // Plate + stack.
      shadow(g, PLATE_X, PLATE_Y + 2, 56);
      rect(g, PLATE_X - 28, PLATE_Y - 2, 56, 4, '#e8e4f8');
      rect(g, PLATE_X - 24, PLATE_Y + 2, 48, 2, '#a8b4e0');
      const pop = serveT >= 0 && f.since < 0.6 ? easeOutBack(f.since / 0.6) : 0;
      let y = PLATE_Y - 2;
      state.stack.forEach((entry, i) => {
        const s = layer(entry.id, 22);
        y -= (s.height - 3) * 2;
        const wob = Math.round(Math.sin(t * 3 + i) * (state.stack.length > 6 ? 1 : 0));
        blit(g, s, PLATE_X - s.width + wob, y - pop * 20, { scale: 2 });
        if (!entry.onLegend) glow(g, PLATE_X + 24, y + 4, 6, '#ff3a5a', 0.6);
      });
      if (!state.stack.length)
        blit(g, buildSprite(BUN_TOP), PLATE_X, PLATE_Y - 4, { anchor: 'bc', alpha: 0.2 });
      // Pests.
      state.pests.forEach((pest, i) => {
        const px = 84 + i * 26 + Math.round(Math.sin(t * 6 + i) * 2);
        const s = buildSprite(
          PEST_SPRITES[pest.kind] ?? RACCOON,
          {},
          { rim: '#ffffff', flip: true },
        );
        shadow(g, px, 186, 14);
        blit(g, s, px, 186, { anchor: 'bc', scale: 1 });
        const danger = pest.stealsIn <= 1;
        tiny(g, String(pest.stealsIn), px, 166, {
          color: danger ? '#ff4d6d' : '#ffe066',
          align: 'center',
        });
        if (danger) glow(g, px, 178, 12, '#ff2a4a', 0.3 + 0.3 * Math.sin(t * 12));
      });
      // Heat gauge.
      drawHeatGauge(g, 346, 92, 80, state.heat, state.recipe.heatMin, state.recipe.heatMax, t);
      for (let k = 0; k < 5; k += 1) {
        const fh = 4 + Math.round(Math.abs(Math.sin(t * 9 + k * 1.7)) * 5);
        rect(g, 338 + k * 4, 186 - fh, 3, fh, k % 2 ? '#ffb347' : '#ff6a2a');
        rect(g, 338 + k * 4, 186 - fh, 3, 1, '#ffe066');
      }
      // Guest.
      const mood = state.guest.mood;
      const gx = 330;
      const gy = 40;
      panel(
        g,
        gx - 34,
        gy - 22,
        76,
        46,
        '#1e1008',
        mood > 60 ? '#5a8a3a' : mood > 30 ? '#8a7a2a' : '#8a2a2a',
      );
      const face = mood > 60 ? '#ffe066' : mood > 30 ? '#ffb347' : '#ff6b6b';
      const bust = buildSprite(
        humanoid({
          skin: '#f0c090',
          hair: '#4a2a1a',
          style: 'bob',
          shirt: '#3a7ac0',
          accent: '#ffe066',
          bust: true,
          angry: mood <= 30,
          talk: mood > 60 && Math.sin(t * 3) > 0.6,
          blink: Math.sin(t * 1.3) > 0.97,
        }),
      );
      blit(g, bust, gx - 18, gy + 20 + (mood > 60 ? Math.round(Math.sin(t * 4)) : 0), {
        anchor: 'bc',
        scale: 2,
      });
      const gn = say(f, state.guest.name);
      if (gn) drawText(g, fitText(gn, 40), gx + 2, gy - 16, { color: '#fff4d6', outline: null });
      bar(g, gx + 2, gy + 2, 34, 3, mood / 100, face);
      if (mood <= 30)
        tiny(g, '!', gx - 4, gy - 18 + Math.round(Math.sin(t * 12)), {
          color: '#ff4d6d',
          scale: 2,
        });
      // Recipe ticket.
      panel(
        g,
        8,
        22,
        92,
        22 + state.recipe.required.length * 12 + 14,
        '#d8c8a0',
        '#c8a070',
        '#3a2214',
      );
      const rn = say(f, state.recipe.name);
      if (rn) drawText(g, fitText(rn, 84), 12, 25, { color: '#3a2214', outline: null });
      state.recipe.required.forEach((id, i) => {
        const have = state.stack.some((s) => s.id === id);
        blit(g, layer(id, 14), 12, 40 + i * 12);
        const mn =
          say(f, MATERIALS[id]?.name ?? String(id)) || (f.quiet ? '' : String(id).toUpperCase());
        drawText(g, fitText(mn, 56), 30, 38 + i * 12, {
          color: have ? '#2a8a2a' : '#5a3a24',
          outline: null,
        });
        if (have) {
          rect(g, 90, 43 + i * 12, 2, 2, '#2a8a2a');
          rect(g, 92, 44 + i * 12, 2, 2, '#2a8a2a');
          rect(g, 94, 40 + i * 12, 2, 4, '#2a8a2a');
        }
      });
      drawText(
        g,
        `${state.recipe.heatMin}-${state.recipe.heatMax}°`,
        96,
        26 + state.recipe.required.length * 12 + 8,
        { color: '#c8402a', outline: null, align: 'right' },
      );
      if (lastVerdict && f.since < 2) {
        const [zh, en] = VERDICT[lastVerdict] ?? ['出餐', 'SERVED'];
        const k = easeOutBack(Math.min(1, f.since / 0.3));
        if (f.lang === 'zh') plate(g, zh, PLATE_X + 4, Math.round(110 - k * 8), '#ffe066', 100);
        else
          tiny(g, en, PLATE_X + 4, Math.round(110 - k * 8), {
            color: '#ffe066',
            align: 'center',
            scale: 2,
          });
      }
      // Ambient steam.
      if (hash01(Math.floor(t * 20), 3) > 0.6)
        f.fx.mote(
          PLATE_X + (Math.random() - 0.5) * 20,
          PLATE_Y - 20,
          0,
          -10,
          '#ffffff',
          1.2,
          1,
          false,
        );
    },
    grade: (): Grade => ({ top: '#ffd8a0', bottom: '#1a0804', strength: 0.22, bloom: 0.3 }),
    react(f, o) {
      for (const e of o.events) {
        if (e.type === 'catch-ingredient' || e.type === 'catch-heat' || e.type === 'fusion-catch') {
          const slot = Number(e.slot);
          catchFx = { slot, t: f.t };
          f.fx.burst(COLS[slot] ?? 190, CATCH_Y, {
            count: 16,
            colors: e.type === 'catch-heat' ? ['#ff7a2a', '#ffe066'] : ['#ffffff', '#ffe066'],
            speed: 70,
          });
          f.fx.hit(COLS[slot] ?? 190, CATCH_Y, 'light', -Math.PI / 2, ['#ffffff', '#ffe066']);
          f.cue(e.type === 'catch-heat' ? 'hit' : 'land');
        } else if (e.type === 'shoo') {
          f.fx.burst(100, 176, {
            count: 18,
            colors: ['#ffffff', '#c8c8ff'],
            speed: 110,
            shape: 'spark',
          });
          f.fx.float(100, 156, '!', '#9fe4ff', 1, true);
          f.cue('whoosh');
        } else if (e.type === 'pest-theft') {
          f.fx.hit(PLATE_X, 150, 'medium', Math.PI, ['#ff8a8a', '#ffffff']);
          f.fx.float(PLATE_X, 120, '-1', '#ff8a8a');
          f.cue('bad');
        } else if (e.type === 'serve') {
          serveT = 0;
          const v = String(e.verdict ?? '');
          lastVerdict = v || 'served';
          f.fx.steam(PLATE_X, 140, '#ffffff', 8);
          f.cue(v === 'tasty' || v === 'lucky' ? 'good' : 'bad');
          f.fx.burst(PLATE_X, 150, {
            count: 40,
            colors:
              v === 'tasty' || v === 'lucky'
                ? ['#ffe066', '#7cf0a0', '#ffffff']
                : ['#ff8a8a', '#a0a0c0'],
            speed: 120,
          });
          if (v === 'tasty') f.fx.flash('#fff6c0', 0.3);
        } else if (e.type === 'walkout') {
          f.fx.addTrauma(0.4);
          f.fx.float(330, 70, '...', '#ff8a8a');
          f.cue('bad');
        } else if (e.type === 'soothe') {
          f.fx.burst(310, 40, {
            count: 16,
            colors: ['#ff9ae0', '#ffffff'],
            speed: 50,
            gravity: -30,
          });
        } else if (e.type === 'fusion-ready' || e.type === 'fusion-start') {
          f.fx.burst(190, 70, { count: 24, colors: ['#ff7ad9', '#ffffff'], speed: 90 });
        }
      }
    },
  };
}

const module: GameModule<BurgerState> = { definition, createScene };
export default module;
