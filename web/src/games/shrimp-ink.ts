import { SITES, type SiteId } from '@games/shrimp-ink/src/content';
import { definition } from '@games/shrimp-ink/src/definition';
import type { InkState } from '@games/shrimp-ink/src/engine';
import { fog, ridge, sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { bar, type Ctx, disc, easeInOut, mix, rect, VH, VW, withAlpha } from '../gfx/pixel';
import type { GameModule, GameScene, HitRegion } from '../gfx/scene';
import { buildSprite, HERO, SCROLL } from '../gfx/sprites';
import { drawText } from '../gfx/text';
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
      sky(g, ['#efe4c8', '#e2d4b0', '#cdbb92'], 0, VH, 8);
      ridge(g, { seed: 3, base: 70, amp: 46, color: '#b8a888', kind: 'hills' }, t * 0.8);
      fog(g, t, 54, 24, '#f4ecd6', 0.4, 2);
      ridge(g, { seed: 8, base: 104, amp: 40, color: '#8a7c62', kind: 'hills' }, t * 1.4);
      fog(g, t, 92, 22, '#efe4c8', 0.35, 3);
      ridge(g, { seed: 13, base: 150, amp: 30, color: '#5e5440', kind: 'trees', scale: 10 }, t * 2);
      rect(g, 0, 150, VW, VH - 150, '#4a4232');
      // Paper grain + red seal.
      rect(g, VW - 40, 22, 22, 22, '#b02a1e');
      drawText(g, '墨', VW - 29, 26, { color: '#f4e0c0', outline: null, align: 'center' });
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
        drawText(g, SITES[id].name, p.x, p.y + 4, {
          color: focus ? '#8a2a1a' : visited ? '#2a2014' : '#6a5a44',
          outline: '#efe4c8',
          align: 'center',
        });
        if (state.lead?.site === id) {
          const bob = Math.round(Math.sin(t * 4) * 2);
          drawText(g, '?', p.x + 14, p.y - 28 + bob, { color: '#b02a1e', outline: '#efe4c8' });
        }
      }
      // Scholar travelling.
      const to = POS[state.location];
      const src = from ? POS[from] : to;
      const k = easeInOut(Math.min(1, (t - travelT) / 0.8));
      const hx = src.x + (to.x - src.x) * k;
      const hy = src.y + (to.y - src.y) * k - 10;
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
        { anchor: 'bc' },
      );
      // Ink drops drifting.
      if (Math.random() < 0.08)
        f.fx.mote(Math.random() * VW, -2, 0, 10 + Math.random() * 6, '#2a2014', 8, 1, false);
    },
    hud(f) {
      const { g, state } = f;
      blit(g, buildSprite(SCROLL), 8, 22, { scale: 2 });
      drawText(g, `书稿 ${state.manuscript}`, 32, 24, { color: '#2a2014', outline: '#efe4c8' });
      drawText(g, `第 ${state.turn + 1}/${state.maxTurns} 幕`, VW / 2, 20, {
        color: '#2a2014',
        outline: '#efe4c8',
        align: 'center',
      });
      const stats: [string, number, number, string][] = [
        ['信', state.belief, 100, '#8a2a1a'],
        ['命', state.life, 6, '#b02a1e'],
        ['粮', state.food, 8, '#6a5a2a'],
      ];
      stats.forEach(([label, v, max, color], i) => {
        drawText(g, label, 8, 44 + i * 12, { color, outline: '#efe4c8' });
        bar(g, 22, 49 + i * 12, 50, 3, v / max, color, mix('#cdbb92', '#000000', 0.2));
      });
    },
    react(f, o) {
      const prev = o.previous as InkState;
      if (prev.location !== o.state.location) {
        from = prev.location;
        travelT = f.t;
      }
      if (o.action.id === 'dig' || o.action.id === 'investigate') {
        digT = f.t;
        const p = POS[o.state.location];
        f.fx.burst(p.x, p.y, { count: 18, colors: ['#2a2014', '#5e5440'], speed: 60, glow: false });
      }
      if (o.state.manuscript > prev.manuscript) {
        f.fx.burst(40, 40, { count: 30, colors: ['#b02a1e', '#2a2014'], speed: 80, glow: false });
        f.fx.float(60, 60, '落笔!', '#b02a1e');
      }
      if (o.state.proof > prev.proof)
        f.fx.float(POS[o.state.location].x, POS[o.state.location].y - 30, '证 +', '#8a2a1a');
    },
  };
}

const module: GameModule<InkState> = { definition, createScene };
export default module;
