import { definition } from '@games/claw-raft/src/definition';
import { aboard, type RaftState, sideLabel } from '@games/claw-raft/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { disc, rect, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, CHEST, SHRIMP } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit } from '../gfx/world';

const HOLDS = [
  ['port', 78],
  ['mid', 168],
  ['starboard', 258],
] as const;

function createScene(): GameScene<RaftState> {
  return {
    grade(): Grade {
      return { top: '#ff8a5c', bottom: '#1a1030', bloom: 0.4, vignette: 0.7 };
    },
    anchor: (state) => ({ x: 190 + (state.holds.port - state.holds.starboard) * 2, y: 120 }),
    hits(_state, actions): HitRegion[] {
      const regions: HitRegion[] = [];
      for (const hold of HOLDS) {
        if (!actions.some((action) => action.id === hold[0])) continue;
        regions.push({ x: hold[1] - 28, y: 96, w: 64, h: 48, actionId: hold[0] });
      }
      if (actions.some((action) => action.id === 'shift')) {
        regions.push({ x: 150, y: 168, w: 84, h: 36, actionId: 'shift' });
      }
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      sky(g, ['#ffb07a', '#c45a48', '#3a2048', '#14243a'], 0, 216, 12);
      rect(g, 0, 150, 384, 66, '#12344a');
      for (let i = 0; i < 10; i += 1) {
        const y = 156 + Math.round(Math.sin(t * 2 + i) * 3);
        rect(g, i * 40, y, 22, 2, withAlpha('#7ec8ff', 0.45));
      }
      const tilt = state.holds.port - state.holds.starboard + state.gust;
      const raftX = 168 + tilt * 4;
      const bob = Math.round(Math.sin(t * 2.2) * 2);
      rect(g, raftX - 90, 118 + bob, 180, 16, '#8a5a32');
      rect(g, raftX - 96, 128 + bob, 192, 8, '#6a4020');
      HOLDS.forEach((hold) => {
        const weight = state.holds[hold[0]];
        const x = raftX + (hold[1] - 168);
        rect(g, x - 22, 100 + bob, 44, 20, '#c48a52');
        rect(g, x - 20, 102 + bob, 40, 16, '#3a2414');
        for (let i = 0; i < Math.min(weight, 6); i += 1) {
          rect(g, x - 16 + (i % 3) * 10, 106 + bob - Math.floor(i / 3) * 6, 8, 5, '#e8c878');
        }
        const name = say(f, sideLabel(hold[0]));
        if (name)
          drawText(g, name, x, 86 + bob, { color: '#fff4d6', align: 'center', outline: '#1a1008' });
      });
      const crate = state.crates[state.index];
      if (crate && state.outcome === 'ongoing') {
        blit(g, buildSprite(CHEST), 168, 64 + Math.round(Math.sin(t * 3)), {
          scale: 2,
          anchor: 'bc',
        });
        drawText(g, String(crate.w), 168, 40, {
          color: '#fff6dc',
          align: 'center',
          outline: '#1a1008',
        });
      }
      blit(g, buildSprite(SHRIMP), 40, 176 + bob, { scale: 2, anchor: 'bc' });
      const gust = state.gust < 0 ? '←' : state.gust > 0 ? '→' : '·';
      drawText(g, gust, 340, 48, { color: '#fff6dc', align: 'center' });
      disc(g, 24, 28, 8, '#ffe0a0');
      const shift = say(f, '挪一成');
      if (shift && f.actions.some((action) => action.id === 'shift')) {
        rect(g, 150, 168, 84, 32, f.focus?.id === 'shift' ? '#4a3018' : '#2a1c10');
        drawText(g, shift, 192, 176, { color: '#fff4d6', align: 'center' });
      }
      drawText(g, String(aboard(state.holds)), 340, 176, { color: '#fff4d6', align: 'center' });
    },
    react(f, outcome) {
      const stash = outcome.events.find((event) => event.type === 'stash');
      if (!stash) {
        if (outcome.events.some((event) => event.type === 'shift')) f.cue('whoosh');
        return;
      }
      if (stash.kind === 'dump' || stash.kind === 'capsize') {
        f.cue('splash');
        f.fx.burst(190, 130, { count: 16, colors: ['#7ec8ff', '#ffffff'], speed: 40, life: 0.6 });
      } else f.cue('land');
    },
  };
}

const module: GameModule<RaftState> = { definition, createScene };
export default module;
