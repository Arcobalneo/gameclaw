import { KIND_LABEL, type Kind } from '@games/claw-stamp/src/content';
import { definition } from '@games/claw-stamp/src/definition';
import type { StampState } from '@games/claw-stamp/src/engine';
import { humanoid } from '../gfx/actors';
import type { Grade } from '../gfx/art';
import { moon, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, hash01, makeCanvas, rect, VH, VW, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, pips, plate, shadow } from '../gfx/world';

const KIND_SHIRT: Record<Kind, string> = {
  clear: '#7ee0a0',
  edge: '#ffc24a',
  banned: '#ff5d73',
};
const KIND_HAIR: Record<Kind, string> = {
  clear: '#3a2418',
  edge: '#6a3a18',
  banned: '#1a1020',
};

const LANTERN: SpriteDef = {
  rows: ['..gg..', '.gwwg.', 'gwwwwg', '.gyyg.', '..gg..', '...s..', '...s..'],
  pal: { g: '#c47a3a', w: '#fff6dc', y: '#ffc24a', s: '#3a2414' },
};

const STAMP: SpriteDef = {
  rows: ['hhhhhhhh', 'hddddddh', 'hddddddh', 'ssssssss', '..wwww..', '.wwwwww.', 'wwwwwwww'],
  pal: { h: '#8a3a28', d: '#5a2418', s: '#c4a060', w: '#fff6dc' },
};

const BOAT: SpriteDef = {
  rows: [
    '......mmmm......',
    '.....mwwwwm.....',
    '....mwwwwwwm....',
    '...mwwwwwwwwm...',
    'hhhhhhhhhhhhhhhh',
    'hddddddddddddddh',
    '.dddddddddddddd.',
  ],
  pal: { m: '#e8e0d0', w: '#fff6dc', h: '#6a4a2a', d: '#3a2814' },
};

let dock: HTMLCanvasElement | null = null;

function pier(): HTMLCanvasElement {
  if (dock) return dock;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#2a1848', '#14102c', '#0c1830', '#081018'], 0, VH, 12);
  for (let i = 0; i < 40; i += 1) {
    const x = hash01(i, 3) * VW;
    const y = 150 + hash01(i, 4) * 60;
    rect(g, x, y, 2 + (i % 3), 1, withAlpha('#7ec8ff', 0.25));
  }
  rect(g, 0, 150, VW, VH - 150, '#2a1c12');
  rect(g, 0, 150, VW, 3, '#c4a060');
  for (let x = 8; x < VW; x += 16) {
    rect(g, x, 154, 2, 62, '#1a1008');
    rect(g, x, 200, 6, 3, '#3a2414');
  }
  rect(g, 250, 96, 110, 54, '#1a1428');
  rect(g, 250, 96, 110, 3, '#6a4a8a');
  rect(g, 258, 78, 78, 18, '#12101c');
  rect(g, 292, 58, 3, 22, '#3a3048');
  rect(g, 286, 60, 16, 8, '#ff5d73');
  for (let i = 0; i < 3; i += 1) rect(g, 262 + i * 22, 108, 8, 6, '#ffc24a');
  for (let i = 0; i < 8; i += 1) {
    const x = 24 + i * 28;
    rect(g, x, 62, 1, 10, '#3a2414');
    rect(g, x, 58, 6, 4, i % 2 ? '#ff5d73' : '#ffc24a');
  }
  for (let i = 0; i < 18; i += 1) {
    rect(g, 12 + hash01(i, 8) * 200, 168 + hash01(i, 9) * 30, 4, 1, '#3a2818');
  }
  rect(g, 188, 124, 28, 18, '#3a2418');
  rect(g, 192, 128, 20, 10, '#fff6dc');
  rect(g, 196, 130, 8, 2, '#c23a2e');
  dock = c;
  return c;
}

function travelerOf(kind: Kind, step: 0 | 1, blink: boolean) {
  return buildSprite(
    humanoid({
      hair: KIND_HAIR[kind],
      style: kind === 'banned' ? 'cap' : kind === 'edge' ? 'bun' : 'bob',
      shirt: KIND_SHIRT[kind],
      pants: '#241808',
      step,
      blink,
      bust: false,
    }),
  );
}

function createScene(): GameScene<StampState> {
  return {
    grade(): Grade {
      return { top: '#3a2060', bottom: '#0a0614', bloom: 0.5, vignette: 0.82 };
    },
    anchor: () => ({ x: 150, y: 130 }),
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const ids = ['stamp', 'refuse', 'pardon', 'listen'];
      return ids
        .map((id) => id)
        .filter((id) => actions.some((action) => action.id === id))
        .map((id, n, arr) => ({
          x: 16 + n * (352 / arr.length),
          y: 176,
          w: 352 / arr.length - 6,
          h: 34,
          actionId: id,
        }));
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(pier(), 0, 0);
      for (let i = 0; i < 8; i += 1) {
        const x = 24 + i * 28;
        const wave = Math.round(Math.sin(t * 3 + i) * 2);
        rect(g, x + wave, 58, 6, 4, i % 2 ? '#ff5d73' : '#ffc24a');
      }
      stars(g, t, 3, 8, 70);
      moon(g, 48, 28, 9, '#fff3d0', '#c8b4ff');
      for (let x = 0; x < VW; x += 10) {
        const y = 146 + Math.round(Math.sin(t * 1.3 + x * 0.08) * 2);
        rect(g, x, y, 6, 2, withAlpha('#7ec8ff', 0.45));
      }
      const boat = buildSprite(BOAT);
      blit(g, boat, 70, 148 + Math.round(Math.sin(t * 1.1) * 1), { scale: 2, anchor: 'bc' });
      const lamp = buildSprite(LANTERN);
      blit(g, lamp, 220, 70 + Math.round(Math.sin(t * 2) * 1), { scale: 2, anchor: 'c' });
      glow(g, 220, 72, 18, '#ffc24a', 0.35 + 0.08 * Math.sin(t * 4));
      const clerk = buildSprite(
        humanoid({
          hair: '#1a1020',
          style: 'cap',
          shirt: '#6a4a8a',
          pants: '#1a1028',
          bust: true,
          blink: Math.floor(t * 2) % 7 === 0,
        }),
      );
      blit(g, clerk, 300, 148, { scale: 2, anchor: 'bc' });
      const traveler = state.traveler;
      if (traveler) {
        const step = (Math.floor(t * 3) % 2) as 0 | 1;
        const blink = Math.floor(t * 2) % 9 === 0;
        const person = travelerOf(traveler.kind, step, blink);
        const arrive = Math.min(1, f.since * 2.4);
        const x = 40 + arrive * 110;
        shadow(g, x, 152, 18);
        blit(g, person, x, 150, { scale: 2, anchor: 'bc' });
        const name = say(f, traveler.name);
        if (name) plate(g, name, x, 96, KIND_SHIRT[traveler.kind]);
        const kind = say(f, KIND_LABEL[traveler.kind]);
        if (kind)
          drawText(g, kind, x, 118, { color: '#fff4d6', align: 'center', outline: '#140c08' });
        drawText(g, String(traveler.fare), x + 28, 132, {
          color: '#ffc24a',
          align: 'left',
          scale: 2,
        });
      }
      const upcoming = state.next;
      if (upcoming) {
        const waiting = travelerOf(upcoming.kind, 0, false);
        blit(g, waiting, 28, 154, { scale: 1, anchor: 'bc' });
        const nextKind = say(f, KIND_LABEL[upcoming.kind]);
        if (nextKind) {
          drawText(g, nextKind, 48, 128, {
            color: KIND_SHIRT[upcoming.kind],
            align: 'left',
            outline: '#140c08',
          });
        }
        drawText(g, String(upcoming.fare), 48, 140, { color: '#ffc24a', align: 'left' });
      }
      const pressing = f.focus?.id === 'stamp';
      const stamp = buildSprite(STAMP);
      blit(g, stamp, 248, (pressing ? 118 : 108) + Math.round(Math.sin(t * 2)), {
        scale: 2,
        anchor: 'c',
      });
      pips(g, 16, 16, state.quota, state.approvals, '#7ee0a0', -1, t);
      pips(g, 16, 28, state.strikeLimit, state.strikes, '#ff5d73', -1, t);
      const buttons = [
        ['stamp', '盖章'],
        ['refuse', '拒签'],
        ['pardon', '特赦'],
        ['listen', '细看'],
      ] as const;
      const shown = buttons.filter((item) => f.actions.some((action) => action.id === item[0]));
      shown.forEach((item, n) => {
        const w = 352 / shown.length - 6;
        const x = 16 + n * (352 / shown.length);
        const on = f.focus?.id === item[0];
        rect(g, x, 178, w, 30, on ? '#3a2a48' : '#1a1224');
        rect(g, x, 178, w, 2, on ? '#ffc24a' : '#6a4a8a');
        const label = say(f, item[1]);
        if (label) drawText(g, label, x + w / 2, 186, { color: '#fff4d6', align: 'center' });
      });
    },
    react(f, outcome) {
      const type = String(outcome.events[0]?.type ?? '');
      const x = 150;
      if (type === 'stamp' || type === 'approve') {
        f.cue('good');
        f.fx.burst(248, 120, { count: 14, colors: ['#ffc24a', '#fff6dc'], speed: 36, life: 0.45 });
        f.fx.float(x, 90, '+', '#7ee0a0');
      } else if (type === 'refuse' || type === 'ban') {
        f.cue('bad');
        f.fx.flash('#ff5d73', 0.28);
        f.fx.kick(-3, 0);
      } else if (type === 'pardon') {
        f.cue('coin');
        f.fx.burst(x, 110, {
          count: 12,
          colors: ['#c49aff', '#fff6dc'],
          speed: 28,
          life: 0.5,
          shape: 'spark',
        });
      } else if (type === 'listen') {
        f.cue('whoosh');
        f.fx.burst(x, 100, { count: 8, colors: ['#7ec8ff'], speed: 18, life: 0.35, shape: 'ring' });
      }
    },
  };
}

const module: GameModule<StampState> = { definition, createScene };
export default module;
