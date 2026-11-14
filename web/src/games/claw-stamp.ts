import { definition } from '@games/claw-stamp/src/definition';
import type { StampState } from '@games/claw-stamp/src/engine';
import { humanoid } from '../gfx/actors';
import type { Grade } from '../gfx/art';
import { moon, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { disc, rect, VH, VW, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, pips } from '../gfx/world';

const KIND_COLOR: Record<string, string> = {
  clear: '#7ee0a0',
  edge: '#ffc24a',
  banned: '#ff5d73',
};

function createScene(): GameScene<StampState> {
  return {
    grade(): Grade {
      return { top: '#3a2060', bottom: '#0a0614', bloom: 0.45, vignette: 0.85 };
    },
    anchor: () => ({ x: 168, y: 120 }),
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const ids = ['stamp', 'refuse', 'pardon', 'listen'];
      return ids
        .map((id, i) => ({ id, i }))
        .filter((item) => actions.some((action) => action.id === item.id))
        .map((item, n, arr) => ({
          x: 28 + n * (320 / arr.length),
          y: 168,
          w: 320 / arr.length - 8,
          h: 40,
          actionId: item.id,
        }));
    },
    draw(f) {
      const { g, t, state } = f;
      sky(g, ['#241044', '#14102c', '#0c1428', '#081018'], 0, VH, 14);
      stars(g, t, 4, 40, 90);
      moon(g, 320, 36, 10, '#fff3d0', '#c8b4ff');
      rect(g, 0, 128, VW, VH - 128, '#0c2438');
      for (let x = 0; x < VW; x += 8) {
        const y = 132 + Math.round(Math.sin(t * 1.4 + x * 0.08) * 2);
        rect(g, x, y, 5, 1, withAlpha('#7ec8ff', 0.35));
      }
      rect(g, 250, 96, 92, 28, '#1a2438');
      rect(g, 258, 86, 70, 12, '#121826');
      rect(g, 292, 62, 2, 26, '#2a3348');
      rect(g, 286, 64, 14, 8, '#ff5d73');
      for (let i = 0; i < 3; i += 1) rect(g, 262 + i * 18, 102, 6, 5, '#ffc24a');
      rect(g, 0, 156, VW, VH - 156, '#2a1c12');
      rect(g, 0, 156, VW, 3, '#6a4a2a');
      const traveler = state.traveler;
      const color = KIND_COLOR[traveler?.kind ?? 'clear'] ?? '#7ee0a0';
      glow(g, 118, 78, 28, '#ffb45a', 0.45);
      rect(g, 112, 70, 8, 16, '#3a2418');
      disc(g, 116, 68, 6, '#ffb45a');
      const bob = Math.round(Math.sin(t * 2) * 1);
      const person = buildSprite(
        humanoid({
          hair: '#3a2418',
          style: 'bun',
          shirt: color,
          pants: '#241808',
          bust: true,
        }),
      );
      blit(g, person, 168, 148 + bob, { scale: 2, anchor: 'bc' });
      if (traveler && !f.quiet) {
        drawText(g, say(f, traveler.name), 188, 108, {
          color: '#fff4d6',
          align: 'left',
          outline: '#140c08',
        });
      }
      disc(g, 250, 118, 10, color);
      rect(g, 246, 114, 8, 3, '#fff6dc');
      pips(g, 24, 24, state.quota, state.approvals, '#7ee0a0');
      pips(g, 24, 36, state.strikeLimit, state.strikes, '#ff5d73');
      const buttons = [
        ['stamp', '盖章'],
        ['refuse', '拒签'],
        ['pardon', '特赦'],
        ['listen', '细看'],
      ] as const;
      const shown = buttons.filter((item) => f.actions.some((action) => action.id === item[0]));
      shown.forEach((item, n) => {
        const x = 28 + n * (320 / shown.length);
        const w = 320 / shown.length - 8;
        const on = f.focus?.id === item[0];
        rect(g, x, 172, w, 32, on ? '#3a2a18' : '#1a120c');
        rect(g, x, 172, w, 2, on ? '#ffc24a' : '#6a4a2a');
        const label = say(f, item[1]);
        if (label) {
          drawText(g, label, x + w / 2, 180, { color: '#fff4d6', align: 'center' });
        }
      });
    },
    react(f, outcome) {
      const kind = outcome.events.find(
        (event) => event.type === 'stamp' || event.type === 'refuse',
      );
      if (!kind) return;
      const bad = kind.type === 'stamp' && kind.kind !== 'clear';
      f.cue(bad ? 'bad' : 'good');
      f.fx.burst(250, 118, {
        count: 16,
        colors: bad ? ['#ff5d73', '#ffffff'] : ['#7ee0a0', '#fff4d6'],
        speed: 50,
        life: 0.6,
      });
    },
  };
}

const module: GameModule<StampState> = { definition, createScene };
export default module;
