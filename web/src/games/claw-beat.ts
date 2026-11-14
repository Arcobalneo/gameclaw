import { INTENT_LABEL, MOVE_LABEL } from '@games/claw-beat/src/content';
import { definition } from '@games/claw-beat/src/definition';
import type { BeatState } from '@games/claw-beat/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { disc, rect } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit } from '../gfx/world';

const BEAT_COLOR: Record<string, string> = {
  jab: '#ff5d73',
  guard: '#7ec8ff',
  slip: '#c49aff',
  rest: '#d8c090',
  strike: '#ff5d73',
  grab: '#ffb45a',
  feint: '#c49aff',
};

function createScene(): GameScene<BeatState> {
  return {
    grade(): Grade {
      return { top: '#301828', bottom: '#100810', bloom: 0.45, vignette: 0.85 };
    },
    anchor: () => ({ x: 192, y: 110 }),
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const regions: HitRegion[] = [];
      for (let i = 0; i < 4; i += 1) {
        const preferred = actions.find((action) => action.id.startsWith(`set:${i}:`));
        if (preferred) {
          regions.push({ x: 48 + i * 72, y: 132, w: 60, h: 44, actionId: preferred.id });
        }
      }
      if (actions.some((action) => action.id === 'commit')) {
        regions.push({ x: 150, y: 70, w: 84, h: 48, actionId: 'commit' });
      }
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      sky(g, ['#24101c', '#140810', '#0c080c'], 0, 216, 8);
      disc(g, 192, 118, 70, '#1a1014');
      disc(g, 192, 118, 54, '#2a1818');
      rect(g, 122, 116, 140, 4, '#3a2420');
      const mine = buildSprite(SHRIMP);
      const theirs = buildSprite(SHRIMP, {}, { flip: true });
      const bob = Math.round(Math.sin(t * 3) * 2);
      blit(g, mine, 150, 128 + bob, { scale: 2, anchor: 'bc' });
      blit(g, theirs, 234, 128 - bob, { scale: 2, anchor: 'bc' });
      state.tape.slice(0, 4).forEach((intent, i) => {
        const x = 78 + i * 58;
        const color = BEAT_COLOR[intent] ?? '#fff4d6';
        glow(g, x, 42, 12, color, 0.35);
        disc(g, x, 42, 8, color);
        const label = say(f, INTENT_LABEL[intent]);
        if (label) drawText(g, label, x, 52, { color: '#fff4d6', align: 'center' });
      });
      state.phrase.forEach((move, i) => {
        const x = 78 + i * 72;
        const on = f.focus?.id?.startsWith(`set:${i}:`) === true;
        rect(g, x - 22, 140, 52, 36, on ? '#3a2430' : '#1a1018');
        rect(g, x - 22, 140, 52, 2, BEAT_COLOR[move] ?? '#d8c090');
        const label = say(f, MOVE_LABEL[move]);
        if (label) drawText(g, label, x + 4, 150, { color: '#fff4d6', align: 'center' });
      });
      if (f.actions.some((action) => action.id === 'commit')) {
        const commit = say(f, '交锋');
        glow(g, 192, 108, f.focus?.id === 'commit' ? 28 : 16, '#ff5d73', 0.35);
        if (commit) drawText(g, commit, 192, 100, { color: '#fff4d6', align: 'center' });
      }
    },
    react(f, outcome) {
      if (!outcome.events.some((event) => event.type === 'commit')) return;
      const dmg = Number(outcome.events.find((event) => event.type === 'commit')?.dmgThem ?? 0);
      f.cue(dmg > 0 ? 'hit' : 'whoosh');
      f.fx.burst(214, 100, {
        count: 14,
        colors: ['#ff5d73', '#fff4d6'],
        speed: 70,
        life: 0.45,
      });
      if (dmg > 0) f.fx.kick(2, 0);
    },
  };
}

const module: GameModule<BeatState> = { definition, createScene };
export default module;
