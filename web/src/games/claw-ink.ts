import { SITES, type SiteId } from '@games/claw-ink/src/content';
import { definition } from '@games/claw-ink/src/definition';
import type { InkState } from '@games/claw-ink/src/engine';
import type { Grade } from '../gfx/art';
import { ridge, sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  type Ctx,
  ctx2d,
  disc,
  dither,
  easeInOut,
  hash01,
  makeCanvas,
  rect,
  VH,
  VW,
  withAlpha,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, HERO } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { tiny } from '../gfx/tiny';
import { blit, shadow } from '../gfx/world';

const POS: Record<SiteId, { x: number; y: number }> = {
  town: { x: 82, y: 150 },
  stele: { x: 170, y: 104 },
  ferry: { x: 118, y: 74 },
  pool: { x: 252, y: 140 },
  temple: { x: 300, y: 74 },
  post: { x: 330, y: 168 },
};
const ROADS: [SiteId, SiteId][] = [
  ['town', 'stele'],
  ['town', 'ferry'],
  ['stele', 'ferry'],
  ['stele', 'pool'],
  ['stele', 'temple'],
  ['pool', 'temple'],
  ['pool', 'post'],
  ['town', 'post'],
];
const HERO_PAL = { r: '#2a2a3a', c: '#d8d0b8', b: '#8a2a2a', l: '#3a3428' };

function drawSiteIcon(g: Ctx, id: SiteId, x: number, y: number, t: number): void {
  const ink = '#1a140c';
  switch (id) {
    case 'town':
      for (let i = 0; i < 3; i += 1) {
        rect(g, x - 14 + i * 10, y - 10, 8, 10, '#3a2e20');
        rect(g, x - 15 + i * 10, y - 13, 10, 3, ink);
      }
      break;
    case 'stele':
      rect(g, x - 4, y - 18, 8, 18, '#5a5244');
      rect(g, x - 4, y - 18, 8, 2, '#7a7264');
      rect(g, x + 4, y - 8, 6, 8, '#4a4234');
      break;
    case 'ferry':
      rect(g, x - 14, y - 2, 28, 3, '#3a2e20');
      rect(g, x - 1, y - 16, 2, 14, ink);
      for (let i = 0; i < 4; i += 1)
        rect(g, x - 20 + i * 12 + Math.round(Math.sin(t + i) * 2), y + 4, 8, 1, '#6a7a7a');
      break;
    case 'pool':
      disc(g, x, y - 2, 10, '#0c0c14');
      disc(g, x - 2, y - 4, 4, '#2a2a3a');
      glow(g, x, y - 2, 16, '#6a5aa8', 0.2 + 0.1 * Math.sin(t * 2));
      break;
    case 'temple':
      rect(g, x - 12, y - 10, 24, 10, '#4a2a1a');
      rect(g, x - 16, y - 14, 32, 4, ink);
      rect(g, x - 10, y - 18, 20, 4, ink);
      rect(g, x - 3, y - 8, 6, 8, '#120a06');
      break;
    case 'post':
      rect(g, x - 10, y - 12, 20, 12, '#5a3a1a');
      rect(g, x - 12, y - 15, 24, 3, '#8a2a2a');
      rect(g, x + 10, y - 22, 2, 22, ink);
      rect(g, x + 12, y - 22, 8, 5, '#c84a2a');
      break;
  }
}

let paper: HTMLCanvasElement | null = null;

/** Ink-wash landscape on rice paper, painted once: layered mountains fading into mist, a river. */
function paperMap(): HTMLCanvasElement {
  if (paper) return paper;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#f2e8cc', '#ebdfbe', '#dfd0a8'], 0, VH, 6);
  // Paper fibres.
  for (let i = 0; i < 900; i += 1)
    rect(
      g,
      hash01(i, 1) * VW,
      hash01(i, 2) * VH,
      1 + (i % 3),
      1,
      withAlpha('#b8a478', 0.12 + hash01(i, 3) * 0.1),
    );
  // Mountain layers: light far wash → dark near strokes, with mist bands between.
  const layers: [number, number, number, string, string][] = [
    [3, 64, 48, '#cbbd9a', 'hills'],
    [8, 92, 44, '#a89a7a', 'hills'],
    [13, 122, 30, '#7a6e56', 'hills'],
  ];
  for (const [seed, base, amp, color, kind] of layers) {
    ridge(g, { seed, base, amp, color, kind: kind as 'hills' }, 0);
    for (let y = base - 6; y < base + 14; y += 1) {
      g.fillStyle = withAlpha('#f2e8cc', Math.min(0.85, (y - base + 6) / 20));
      g.fillRect(0, y, VW, 1);
    }
  }
  // Pines on the near ridge (dry-brush dots).
  for (let i = 0; i < 18; i += 1) {
    const x = 10 + i * 21 + hash01(i, 5) * 8;
    const y = 128 + hash01(i, 6) * 18;
    for (let k = 0; k < 5; k += 1)
      rect(g, x - k, y + k * 2, k * 2 + 1, 1, withAlpha('#2a2418', 0.55));
    rect(g, x, y + 10, 1, 4, withAlpha('#2a2418', 0.6));
  }
  // River winding across the lower map.
  for (let x = 0; x < VW; x += 1) {
    const y = 186 + Math.sin(x * 0.03) * 8 + Math.sin(x * 0.011 + 1) * 6;
    rect(g, x, y, 1, 7, withAlpha('#5a6a72', 0.35));
    rect(g, x, y, 1, 1, withAlpha('#3a4a52', 0.5));
  }
  dither(g, 0, 150, VW, VH - 150, '#8a7a5a', 0.08);
  paper = c;
  return c;
}

function seal(g: Ctx, x: number, y: number, zh: boolean): void {
  rect(g, x, y, 22, 22, '#b02a1e');
  rect(g, x + 1, y + 1, 20, 1, '#d04a3a');
  dither(g, x, y, 22, 22, '#e8d8b0', 0.12);
  if (zh) return;
  // Abstract carved glyph for EN.
  rect(g, x + 5, y + 5, 12, 2, '#f4e0c0');
  rect(g, x + 10, y + 5, 2, 12, '#f4e0c0');
  rect(g, x + 5, y + 15, 12, 2, '#f4e0c0');
}

function createScene(): GameScene<InkState> {
  let from: SiteId | null = null;
  let travelT = -10;
  let digT = -10;

  return {
    anchor: (s) => POS[s.location],
    hits(state, actions): HitRegion[] {
      return (Object.keys(POS) as SiteId[]).flatMap((id) => {
        const p = POS[id];
        const a =
          id === state.location
            ? actions.find((x) => x.id === 'dig' || x.id === 'investigate' || x.id === 'write')
            : actions.find((x) => x.id === `travel:${id}`);
        return a ? [{ x: p.x - 20, y: p.y - 26, w: 40, h: 34, actionId: a.id }] : [];
      });
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(paperMap(), 0, 0);
      seal(g, VW - 40, 12, f.lang === 'zh');
      if (f.lang === 'zh')
        drawText(g, f.lang === 'zh' ? '墨' : 'INK', VW - 29, 16, {
          color: '#f4e0c0',
          outline: null,
          align: 'center',
        });
      // Roads.
      g.strokeStyle = withAlpha('#2a2014', 0.6);
      g.setLineDash([3, 3]);
      g.lineWidth = 1;
      for (const [a, b] of ROADS) {
        g.beginPath();
        g.moveTo(POS[a].x + 0.5, POS[a].y + 0.5);
        g.lineTo(POS[b].x + 0.5, POS[b].y + 0.5);
        g.stroke();
      }
      g.setLineDash([]);
      for (const id of Object.keys(POS) as SiteId[]) {
        const p = POS[id];
        const focus = f.focus?.id === `travel:${id}`;
        const visited = state.visited.includes(id);
        if (focus) glow(g, p.x, p.y - 8, 26, '#ffe9a0', 0.5);
        drawSiteIcon(g, id, p.x, p.y, t);
        const nm = say(f, SITES[id].name);
        if (nm)
          drawText(g, nm, p.x, p.y + 4, {
            color: focus ? '#8a2a1a' : visited ? '#2a2014' : '#6a5a44',
            outline: '#efe4c8',
            align: 'center',
          });
        if (state.lead?.site === id) {
          const bob = Math.round(Math.sin(t * 4) * 2);
          tiny(g, '?', p.x + 14, p.y - 28 + bob, {
            color: '#b02a1e',
            outline: '#efe4c8',
            scale: 2,
          });
        }
      }
      // Scholar travelling.
      const to = POS[state.location];
      const src = from ? POS[from] : to;
      const k = easeInOut(Math.min(1, (t - travelT) / 0.8));
      const hx = src.x + (to.x - src.x) * k;
      const hy = src.y + (to.y - src.y) * k - 10;
      if (k < 1 && Math.floor(t * 10) % 2 === 0) f.fx.ink(hx, hy + 10, '#2a2014', 1);
      shadow(g, hx, hy + 10, 12);
      const digging = t - digT < 0.8;
      blit(
        g,
        buildSprite(HERO, HERO_PAL, { rim: '#fff4d6' }),
        hx,
        hy +
          10 -
          (k < 1 ? Math.abs(Math.sin(t * 14)) * 2 : 0) -
          (digging ? Math.abs(Math.sin(t * 20)) * 2 : 0),
        { anchor: 'bc', scale: 2 },
      );
      // Ink drops drifting.
      if (Math.random() < 0.08)
        f.fx.mote(Math.random() * VW, -2, 0, 10 + Math.random() * 6, '#2a2014', 8, 1, false);
    },
    grade: (): Grade => ({
      top: '#fff4d8',
      bottom: '#5a4a30',
      strength: 0.14,
      bloom: 0.2,
      vignette: 0.35,
    }),
    react(f, o) {
      const prev = o.previous as InkState;
      if (prev.location !== o.state.location) {
        from = prev.location;
        travelT = f.t;
        f.cue('whoosh');
      }
      if (o.action.id === 'dig' || o.action.id === 'investigate') {
        digT = f.t;
        const p = POS[o.state.location];
        f.fx.ink(p.x, p.y, '#2a2014', 16);
        f.fx.dust(p.x, p.y, '#8a7a5a', 8);
        f.cue('land');
      }
      if (o.state.manuscript > prev.manuscript) {
        f.fx.ink(VW - 29, 34, '#b02a1e', 24);
        f.fx.impact(1);
        f.fx.float(VW - 29, 52, '+1', '#b02a1e', 1.1, true);
        f.cue('heavy');
      }
      if (o.state.proof > prev.proof)
        f.fx.float(POS[o.state.location].x, POS[o.state.location].y - 30, '+', '#8a2a1a', 1, true);
    },
  };
}

const module: GameModule<InkState> = { definition, createScene };
export default module;
