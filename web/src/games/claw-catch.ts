import { definition } from '@games/claw-catch/src/definition';
import { displayName, speciesOf, ZONE_BY_ID } from '@games/claw-catch/src/engine/species';
import type { Creature, TamerState } from '@games/claw-catch/src/engine/state';
import { anticipate, type Grade } from '../gfx/art';
import { fog, godRays, ridge, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  bar,
  type Ctx,
  ctx2d,
  easeOutBack,
  ellipse,
  hashString,
  makeCanvas,
  mix,
  panel,
  rect,
  VH,
  VW,
} from '../gfx/pixel';
import { type GameModule, type GameScene, say } from '../gfx/scene';
import { ANVIL, buildSprite, CRAB, SHRIMP } from '../gfx/sprites';
import { drawBlock } from '../gfx/text';
import { tiny } from '../gfx/tiny';
import { blit, kelp, plate, shadow } from '../gfx/world';

const TYPE_COLORS = [
  '#5ee08f',
  '#4fd1ff',
  '#ff7a59',
  '#ffd23f',
  '#c49aff',
  '#ff7ad9',
  '#9fe4ff',
  '#ffb347',
];

const looks = new Map<string, HTMLCanvasElement>();

/** Species look: a crustacean body in the type's hue-shifted ramp plus hashed crest/whiskers. */
function creatureLook(c: Creature, flip = false): HTMLCanvasElement {
  const key = `${c.speciesId}:${c.shiny}:${flip}`;
  const hit = looks.get(key);
  if (hit) return hit;
  let type = 'x';
  try {
    type = speciesOf(c.speciesId).type;
  } catch {
    /* unknown species */
  }
  const h = hashString(c.speciesId);
  const color = TYPE_COLORS[hashString(type) % TYPE_COLORS.length]!;
  const body = c.shiny ? mix(color, '#ffffff', 0.45) : color;
  const pal = {
    b: body,
    h: mix(body, '#ffffff', 0.5),
    d: mix(body, '#14081a', 0.45),
    t: mix(body, '#ff5d73', 0.3),
    c: mix(body, '#ffffff', 0.25),
  };
  const base = buildSprite(h % 5 === 0 ? CRAB : SHRIMP, pal, { rim: '#ffffff', flip });
  const out = makeCanvas(base.width + 8, base.height + 8);
  const g = ctx2d(out);
  g.drawImage(base, 4, 6);
  // Crest spikes along the back silhouette.
  const data = g.getImageData(0, 0, out.width, out.height).data;
  const spikes = 2 + (h % 4);
  const accent = mix(TYPE_COLORS[(h >> 3) % TYPE_COLORS.length]!, '#ffffff', 0.2);
  for (let i = 0; i < spikes; i += 1) {
    const x = Math.round(out.width * (0.3 + (i / spikes) * 0.4));
    let y = 0;
    while (y < out.height && data[(y * out.width + x) * 4 + 3]! < 10) y += 1;
    if (y >= out.height) continue;
    const len = 2 + ((h >> (i + 2)) % 3);
    for (let k = 1; k <= len; k += 1) {
      g.fillStyle = k === len ? '#ffffff' : accent;
      g.fillRect(x, y - k, 1, 1);
    }
    g.fillStyle = '#0b0618';
    g.fillRect(x - 1, y - len, 1, len);
  }
  if (c.shiny) {
    g.fillStyle = '#fff6c0';
    g.fillRect(out.width - 4, 2, 1, 3);
    g.fillRect(out.width - 5, 3, 3, 1);
  }
  looks.set(key, out);
  return out;
}

function nameOf(c: Creature): string {
  try {
    return displayName(c);
  } catch {
    return c.nickname ?? c.speciesId;
  }
}

function infoBox(g: Ctx, x: number, y: number, c: Creature, accent: string, name: string): void {
  panel(g, x, y, 128, 42, '#0d1a1a', mix(accent, '#000000', 0.3));
  if (name)
    drawBlock(g, name, x + 6, y + 2, 96, {
      color: '#fff4d6',
      outline: null,
      maxLines: 2,
    });
  tiny(g, `LV${c.level}`, x + 122, y + 4, { color: accent, align: 'right' });
  const ratio = c.hp / Math.max(1, c.stats.hp);
  bar(
    g,
    x + 6,
    y + 28,
    92,
    4,
    ratio,
    ratio > 0.5 ? '#5ee08f' : ratio > 0.2 ? '#ffd23f' : '#ff4d6d',
  );
  tiny(g, `${Math.max(0, Math.round(c.hp))}`, x + 122, y + 26, {
    color: '#c8f0e0',
    align: 'right',
  });
  if (c.shiny) tiny(g, '★', x + 104, y + 26, { color: '#ffe066' });
}

function createScene(): GameScene<TamerState> {
  let atkT = -10;
  let hurtT = -10;
  let enemyHurtT = -10;
  let catchT = -10;
  let foeAtkT = -10;
  let beam: { from: [number, number]; to: [number, number]; t: number; color: string } | null =
    null;

  return {
    anchor: () => ({ x: 110, y: 130 }),
    draw(f) {
      const { g, t, state } = f;
      const battle = state.battle;
      const abyss = state.abyssActive || state.phase === 'abyss' || state.phase === 'abyss-gate';
      if (abyss) {
        sky(g, ['#1a0a30', '#10061e', '#08030f', '#020105'], 0, VH, 10);
        stars(g, t, 31, 40, VH, '#c49aff');
        fog(g, t, 120, 40, '#4a1a6a', 0.3, 5);
      } else {
        sky(g, ['#4ad0c0', '#1a8a90', '#0c4a5a', '#06242e'], 0, VH, 12);
        godRays(g, t, '#d8fff0', 4, 0.08);
        ridge(g, { seed: 12, base: 120, amp: 40, color: '#0f5a5a', kind: 'reef' }, t * 2);
        ridge(
          g,
          { seed: 15, base: 150, amp: 34, color: '#0a3e44', kind: 'reef', edge: '#2a8a80' },
          t * 5,
        );
      }
      rect(g, 0, 160, VW, VH - 160, abyss ? '#120820' : '#0c3434');
      rect(g, 0, 160, VW, 2, abyss ? '#3a1a5a' : '#2a8070');
      for (let i = 0; i < 26; i += 1) {
        const x = (i * 53) % VW;
        const y = 166 + ((i * 17) % 46);
        rect(g, x, y, 3 + (i % 3), 1, abyss ? '#2a1440' : '#1a5a52');
        if (i % 6 === 0) rect(g, x + 6, y - 1, 2, 2, abyss ? '#6a3a9a' : '#e8c8a8');
      }

      if (battle && state.phase === 'battle') {
        const me = state.party[battle.playerIndex] ?? state.party.find((c) => c && !c.dead) ?? null;
        const foe = battle.enemy;
        // Platforms.
        ellipse(g, 270, 96, 46, 9, abyss ? '#2a1440' : '#1a6a5a');
        ellipse(g, 270, 94, 44, 7, abyss ? '#3a1e5a' : '#2a8a70');
        ellipse(g, 110, 168, 54, 10, abyss ? '#2a1440' : '#1a6a5a');
        ellipse(g, 110, 166, 52, 8, abyss ? '#3a1e5a' : '#2a8a70');
        const eb = Math.round(Math.sin(t * 3) * 2);
        const shake = t - enemyHurtT < 0.3 ? Math.sin((t - enemyHurtT) * 60) * 3 : 0;
        glow(g, 270, 70, 34, abyss ? '#c49aff' : '#ffe066', 0.25);
        if (state.phase === 'battle' || battle.result === 'ongoing')
          blit(
            g,
            creatureLook(foe, true),
            270 + shake - anticipate(t - foeAtkT, 0.45) * 22,
            94 + eb + anticipate(t - foeAtkT, 0.45) * 8,
            {
              anchor: 'bc',
              scale: 3,
              tint: '#ffffff',
              tintAlpha: t - enemyHurtT < 0.15 ? 0.85 : 0,
              alpha: t - catchT < 0.6 ? 1 - (t - catchT) / 0.6 : 1,
            },
          );
        if (me) {
          const lunge = anticipate(t - atkT, 0.45) * 28;
          const hb = t - hurtT < 0.3 ? Math.sin((t - hurtT) * 60) * 3 : 0;
          blit(
            g,
            creatureLook(me),
            110 + lunge + hb,
            166 - lunge * 0.4 + Math.round(Math.sin(t * 3 + 1) * 2),
            {
              anchor: 'bc',
              scale: 3,
              tint: '#ff2040',
              tintAlpha: t - hurtT < 0.15 ? 0.6 : 0,
            },
          );
          infoBox(g, 226, 128, me, '#5ee08f', say(f, nameOf(me)));
        }
        infoBox(g, 30, 30, foe, abyss ? '#c49aff' : '#ff9a6a', say(f, nameOf(foe)));
        // Attack beam: a travelling bolt with a short trail.
        if (beam && t - beam.t < 0.35 && t > beam.t) {
          const k = (t - beam.t) / 0.25;
          for (let i = 0; i < 6; i += 1) {
            const kk = Math.min(1, Math.max(0, k - i * 0.05));
            const bx = beam.from[0] + (beam.to[0] - beam.from[0]) * kk;
            const by =
              beam.from[1] + (beam.to[1] - beam.from[1]) * kk - Math.sin(kk * Math.PI) * 18;
            rect(
              g,
              Math.round(bx) - 2 + (i >> 1),
              Math.round(by) - 2 + (i >> 1),
              5 - (i >> 1),
              5 - (i >> 1),
              i ? beam.color : '#ffffff',
            );
          }
          glow(
            g,
            beam.from[0] + (beam.to[0] - beam.from[0]) * Math.min(1, k),
            beam.from[1] + (beam.to[1] - beam.from[1]) * Math.min(1, k),
            16,
            beam.color,
            0.6,
          );
        }
        return;
      }

      // Overworld: camp / explore with party roaming.
      for (let i = 0; i < 10; i += 1)
        kelp(g, 20 + i * 38, 162, 14 + (i % 3) * 8, t, abyss ? '#5a2a8a' : '#2aa070');
      const zone = ZONE_BY_ID.get(state.currentZone);
      const party = state.party.filter((c): c is Creature => Boolean(c && !c.dead));
      party.forEach((c, i) => {
        const x = 90 + i * 48 + Math.sin(t * 0.8 + i * 2) * 16;
        const hop = Math.abs(Math.sin(t * 3 + i)) * 4;
        shadow(g, x, 162, 20);
        blit(g, creatureLook(c), x, 160 - hop, { anchor: 'bc', scale: 2 });
      });
      if (state.wild && (state.phase === 'encounter' || state.phase === 'catch')) {
        const pop = easeOutBack(Math.min(1, f.since / 0.5));
        glow(g, 300, 120, 40, '#ffe066', 0.35);
        blit(g, creatureLook(state.wild, true), 300, 160, { anchor: 'bc', scale: 3 * pop });
        const wn = say(f, nameOf(state.wild));
        if (wn) plate(g, wn, 300, 88, '#ffe066', 150);
      }
      if (state.phase === 'workshop' || state.phase === 'workshop-slot') {
        blit(g, buildSprite(ANVIL, {}, { rim: '#ffffff' }), 300, 160, { anchor: 'bc', scale: 2 });
        glow(g, 300, 140, 26, '#ff7a2a', 0.3 + 0.2 * Math.sin(t * 9));
      }
      const where = abyss ? `B${state.abyssFloor}` : say(f, zone?.name ?? '营地');
      if (where) plate(g, where, VW / 2, 30, abyss ? '#e0c8ff' : '#d8fff0', 200);
      if (state.explore) {
        const k = state.explore.steps / Math.max(1, state.explore.target);
        bar(g, VW / 2 - 60, 48, 120, 3, k, '#5ee08f');
      }
    },
    grade: (s): Grade =>
      s.abyssActive || s.phase === 'abyss' || s.phase === 'abyss-gate'
        ? { top: '#d0a0ff', bottom: '#05010c', strength: 0.3, bloom: 0.7 }
        : { top: '#d8fff0', bottom: '#04161c', strength: 0.24, bloom: 0.5 },
    react(f, o) {
      const prev = o.previous as TamerState;
      const next = o.state;
      if (
        o.action.id.includes('skill') ||
        o.action.id.startsWith('battle:') ||
        o.action.id.startsWith('move')
      )
        atkT = f.t;
      const pb = prev.battle;
      const nb = next.battle;
      if (pb && nb) {
        if (nb.enemy.hp < pb.enemy.hp) {
          atkT = f.t;
          enemyHurtT = f.t + 0.36;
          beam = { from: [130, 140], to: [270, 74], t: f.t + 0.12, color: '#ffe066' };
          setTimeout(() => {
            f.fx.hit(
              270,
              74,
              pb.enemy.hp - nb.enemy.hp > nb.enemy.stats.hp * 0.3 ? 'heavy' : 'medium',
              -0.5,
              ['#ffffff', '#ffe066'],
            );
            f.cue('hit');
          }, 360);
          f.fx.float(270, 50, `-${Math.round(pb.enemy.hp - nb.enemy.hp)}`, '#ffe066');
        }
        const pm = pb.playerIndex;
        const before = prev.party[pm]?.hp ?? 0;
        const after = next.party[pm]?.hp ?? 0;
        if (after < before) {
          hurtT = f.t + 0.8;
          foeAtkT = f.t + 0.45;
          setTimeout(() => {
            f.fx.hit(110, 140, 'medium', Math.PI * 0.8, ['#ff8a8a', '#ffffff']);
            f.cue('hit');
          }, 800);
          f.fx.float(110, 120, `-${Math.round(before - after)}`, '#ff8a8a');
        }
      }
      if (next.dexCaught.length > prev.dexCaught.length) {
        catchT = f.t;
        f.fx.burst(270, 80, { count: 50, colors: ['#ffe066', '#ffffff', '#5ee08f'], speed: 130 });
        f.fx.float(270, 60, '★', '#ffe066', 1.2, true);
        f.cue('good');
        f.fx.flash('#ffffff', 0.4);
      }
      if (next.phase === 'encounter' && prev.phase !== 'encounter') f.fx.flash('#ffffff', 0.5);
    },
  };
}

const module: GameModule<TamerState> = { definition, createScene };
export default module;
