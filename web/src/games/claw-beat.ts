import { INTENT_LABEL, MOVE_LABEL, type Move } from '@games/claw-beat/src/content';
import { definition } from '@games/claw-beat/src/definition';
import type { BeatState } from '@games/claw-beat/src/engine';
import { humanoid } from '../gfx/actors';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { bar, ctx2d, disc, makeCanvas, rect, VH, VW } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, CRAB, type SpriteDef } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, shadow } from '../gfx/world';

const BEAT_COLOR: Record<string, string> = {
  jab: '#ff5d73',
  guard: '#7ec8ff',
  slip: '#c49aff',
  rest: '#d8c090',
  strike: '#ff5d73',
  grab: '#ffb45a',
  feint: '#c49aff',
};

const POSE: Record<Move, 'down' | 'up' | 'eat'> = {
  jab: 'up',
  guard: 'eat',
  slip: 'down',
  rest: 'down',
};

const ICON: Record<string, SpriteDef> = {
  strike: {
    rows: ['..r..', '.rrr.', 'rrrrr', '.rrr.', '..r..'],
    pal: { r: '#ff5d73' },
  },
  grab: {
    rows: ['r.r.r', '.rrr.', 'rrrrr', '.rrr.', 'r...r'],
    pal: { r: '#ffb45a' },
  },
  feint: {
    rows: ['r...r', '.r.r.', '..r..', '.r.r.', 'r...r'],
    pal: { r: '#c49aff' },
  },
  rest: {
    rows: ['.....', '.rrr.', '.r.r.', '.rrr.', '.....'],
    pal: { r: '#d8c090' },
  },
};

let ring: HTMLCanvasElement | null = null;

function dojo(): HTMLCanvasElement {
  if (ring) return ring;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#301820', '#180c14', '#0c080c'], 0, VH, 8);
  disc(g, 192, 128, 86, '#3a2418');
  disc(g, 192, 128, 70, '#6a4030');
  disc(g, 192, 128, 58, '#c4a070');
  disc(g, 192, 130, 50, '#8a6248');
  rect(g, 40, 20, 8, 70, '#3a2414');
  rect(g, 336, 20, 8, 70, '#3a2414');
  rect(g, 36, 16, 20, 6, '#ff5d73');
  rect(g, 332, 16, 20, 6, '#7ec8ff');
  for (let i = 0; i < 5; i += 1) {
    rect(g, 70 + i * 48, 40, 28, 16, i % 2 ? '#3a1820' : '#1a2030');
    rect(g, 70 + i * 48, 40, 28, 2, i % 2 ? '#ff5d73' : '#7ec8ff');
  }
  rect(g, 150, 188, 84, 8, '#3a2418');
  rect(g, 154, 190, 76, 3, '#c4a070');
  ring = c;
  return c;
}

function fighter(move: Move, step: 0 | 1, blink: boolean) {
  return buildSprite(
    humanoid({
      hair: '#1a1020',
      style: 'spiky',
      shirt: BEAT_COLOR[move] ?? '#ff8a5c',
      pants: '#241808',
      arms: POSE[move],
      step,
      blink,
    }),
  );
}

function createScene(): GameScene<BeatState> {
  let hitT = -10;
  return {
    grade(): Grade {
      return { top: '#301828', bottom: '#100810', bloom: 0.5, vignette: 0.84 };
    },
    anchor: () => ({ x: 150, y: 110 }),
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const regions: HitRegion[] = [];
      for (let i = 0; i < 4; i += 1) {
        const preferred = actions.find((action) => action.id.startsWith(`set:${i}:`));
        if (preferred)
          regions.push({ x: 36 + i * 78, y: 168, w: 70, h: 40, actionId: preferred.id });
      }
      if (actions.some((action) => action.id === 'commit')) {
        regions.push({ x: 150, y: 78, w: 84, h: 40, actionId: 'commit' });
      }
      return regions;
    },
    reset() {
      hitT = -10;
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(dojo(), 0, 0);
      const step = (Math.floor(t * 4) % 2) as 0 | 1;
      const blink = Math.floor(t * 2) % 8 === 0;
      const lead = state.phrase[0] ?? 'rest';
      const you = fighter(lead, step, blink);
      const foe = buildSprite(CRAB);
      const lunge = f.since < 0.25 && hitT > 0 ? 10 : 0;
      shadow(g, 130, 150, 16);
      shadow(g, 250, 150, 18);
      blit(g, you, 120 + lunge, 148 + Math.round(Math.sin(t * 3) * 1), { scale: 2, anchor: 'bc' });
      blit(g, foe, 268 - lunge, 146 + Math.round(Math.sin(t * 3 + 1) * 1), {
        scale: 2,
        anchor: 'bc',
      });
      state.tape.slice(0, 4).forEach((intent, i) => {
        const x = 70 + i * 56;
        const color = BEAT_COLOR[intent] ?? '#fff4d6';
        const icon = buildSprite(ICON[intent] ?? ICON.rest!);
        glow(g, x, 36, 12, color, 0.4);
        blit(g, icon, x, 36 + Math.round(Math.sin(t * 3 + i) * 1), { scale: 2, anchor: 'c' });
        const label = say(f, INTENT_LABEL[intent]);
        if (label) drawText(g, label, x, 48, { color: '#fff4d6', align: 'center' });
      });
      state.phrase.forEach((move, i) => {
        const x = 48 + i * 78;
        const on = f.focus?.id?.startsWith(`set:${i}:`) === true;
        rect(g, x, 168, 68, 36, on ? '#3a2430' : '#1a1018');
        rect(g, x, 168, 68, 3, BEAT_COLOR[move] ?? '#d8c090');
        const label = say(f, MOVE_LABEL[move]);
        if (label) drawText(g, label, x + 34, 178, { color: '#fff4d6', align: 'center' });
      });
      bar(g, 24, 16, 70, 6, state.breath / Math.max(1, state.breathCap), '#7ee0a0');
      const foeCap = state.difficulty === 'hard' ? 14 : state.difficulty === 'easy' ? 10 : 12;
      bar(g, 290, 16, 70, 6, state.enemy / foeCap, '#ff5d73');
      if (f.actions.some((action) => action.id === 'commit')) {
        const commit = say(f, '交锋');
        const on = f.focus?.id === 'commit';
        glow(g, 192, 96, on ? 26 : 14, '#ff5d73', 0.4);
        if (commit) drawText(g, commit, 192, 88, { color: '#fff4d6', align: 'center' });
      }
    },
    react(f, outcome) {
      const commit = outcome.events.find((event) => event.type === 'commit');
      if (!commit) {
        if (outcome.events.some((event) => event.type === 'set')) f.cue('whoosh');
        return;
      }
      hitT = f.t;
      const dmg = Number(commit.dmgThem);
      const hurt = Number(commit.dmgYou);
      f.cue(hurt > 0 ? 'bad' : dmg > 0 ? 'hit' : 'whoosh');
      f.fx.burst(220, 110, {
        count: 12 + dmg,
        colors: hurt > 0 ? ['#ff5d73', '#fff6dc'] : ['#ffc24a', '#fff6dc'],
        speed: 40,
        life: 0.4,
      });
      if (hurt > 0) f.fx.addTrauma(0.45);
      else if (dmg > 0) f.fx.kick(3, 0);
      f.fx.impact(2);
    },
  };
}

const module: GameModule<BeatState> = { definition, createScene };
export default module;
