import { MATERIALS } from '@games/shrimp-burger/src/content';
import { definition } from '@games/shrimp-burger/src/definition';
import type { BurgerState } from '@games/shrimp-burger/src/engine';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { bar, type Ctx, dither, easeOutBack, hash01, mix, panel, rect, VH, VW } from '../gfx/pixel';
import type { GameModule, GameScene, HitRegion } from '../gfx/scene';
import { BUN_TOP, buildSprite, CAT, PIGEON, RACCOON, type SpriteDef } from '../gfx/sprites';
import { drawText, fitText } from '../gfx/text';
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
      sky(g, ['#3a1a0e', '#2a1208', '#1a0a04'], 0, VH, 8);
      // Back wall tiles + neon sign.
      for (let y = 0; y < 150; y += 12)
        for (let x = (y / 12) % 2 ? -8 : 0; x < VW; x += 16) {
          rect(g, x, y, 15, 11, '#2e160a');
          rect(g, x, y, 15, 1, '#3e2010');
        }
      glow(g, 190, 12, 70, '#ff7a2a', 0.15);
      // Counter.
      rect(g, 0, 160, VW, VH - 160, '#4a2a16');
      rect(g, 0, 160, VW, 3, '#8a5a32');
      dither(g, 0, 170, VW, VH - 170, '#2a1408', 0.35);
      // Drop columns.
      COLS.forEach((cx, slot) => {
        const item = state.falling.find((it) => it.slot === slot);
        const focus = f.focus?.id === `catch:${slot}`;
        g.fillStyle = focus ? 'rgba(255,224,102,0.10)' : 'rgba(255,255,255,0.03)';
        g.fillRect(cx - 24, 18, 48, CATCH_Y - 18);
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
          drawText(g, fitText(item.name, 50), cx, y + 9, {
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
        drawText(g, String(pest.stealsIn), px, 166, {
          color: danger ? '#ff4d6d' : '#ffe066',
          align: 'center',
        });
        if (danger) glow(g, px, 178, 12, '#ff2a4a', 0.3 + 0.3 * Math.sin(t * 12));
      });
      // Heat gauge.
      drawHeatGauge(g, 346, 92, 80, state.heat, state.recipe.heatMin, state.recipe.heatMax, t);
      drawText(g, '火候', 346, 178, { color: '#ffb347', align: 'center' });
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
      rect(g, gx - 26, gy - 14, 16, 16, face);
      rect(g, gx - 23, gy - 9, 2, 3, '#14081a');
      rect(g, gx - 16, gy - 9, 2, 3, '#14081a');
      rect(g, gx - 23, mood > 60 ? gy - 3 : gy - 2, 10, 1, '#14081a');
      if (mood > 60) {
        rect(g, gx - 24, gy - 4, 1, 1, '#14081a');
        rect(g, gx - 13, gy - 4, 1, 1, '#14081a');
      }
      drawText(g, fitText(state.guest.name, 44), gx - 6, gy - 16, {
        color: '#fff4d6',
        outline: null,
      });
      bar(g, gx - 6, gy + 2, 42, 3, mood / 100, face);
      drawText(g, `第 ${state.order} 单`, gx - 6, gy + 6, { color: '#c8a070', outline: null });
      // Recipe ticket.
      panel(
        g,
        8,
        22,
        92,
        22 + state.recipe.required.length * 12 + 12,
        '#fff4d6',
        '#c8a070',
        '#3a2214',
      );
      drawText(g, fitText(state.recipe.name, 84), 12, 25, { color: '#3a2214', outline: null });
      state.recipe.required.forEach((id, i) => {
        const have = state.stack.some((s) => s.id === id);
        rect(g, 13, 41 + i * 12, 8, 6, MAT[id]?.color ?? '#999');
        drawText(g, fitText(MATERIALS[id]?.name ?? String(id), 60), 24, 38 + i * 12, {
          color: have ? '#2a8a2a' : '#5a3a24',
          outline: null,
        });
      });
      drawText(
        g,
        `${state.recipe.heatMin}-${state.recipe.heatMax}°`,
        96,
        24 + state.recipe.required.length * 12 + 6,
        { color: '#c8402a', outline: null, align: 'right' },
      );
      if (lastVerdict && f.since < 2) plate(g, lastVerdict, PLATE_X, 104, '#ffe066', 100);
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
    hud(f) {
      const { g, state } = f;
      drawText(g, `出餐 ${state.served}/${state.goal}`, VW / 2, 20, {
        color: '#ffe066',
        align: 'center',
      });
      drawText(g, `剩 ${state.turnsRemaining} 拍`, VW / 2, 33, {
        color: state.turnsRemaining < 10 ? '#ff6b6b' : '#ffd0a0',
        align: 'center',
      });
    },
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
          f.fx.shake(1.5, 0.12);
        } else if (e.type === 'shoo') {
          f.fx.burst(100, 176, {
            count: 18,
            colors: ['#ffffff', '#c8c8ff'],
            speed: 110,
            shape: 'spark',
          });
          f.fx.float(100, 156, '走开!', '#9fe4ff');
        } else if (e.type === 'pest-theft') {
          f.fx.shake(3, 0.3);
          f.fx.float(PLATE_X, 120, '被偷吃!', '#ff8a8a');
        } else if (e.type === 'serve') {
          serveT = 0;
          const v = String(e.verdict ?? '');
          lastVerdict =
            { tasty: '美味!', lucky: '歪打正着!', bad: '难吃…', disaster: '灾难!!' }[v] ?? '出餐';
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
          f.fx.shake(4, 0.4);
          f.fx.float(330, 70, '客人走了!', '#ff8a8a');
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
