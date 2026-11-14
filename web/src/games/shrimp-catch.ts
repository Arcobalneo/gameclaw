import { definition } from '@games/shrimp-catch/src/definition';
import { displayName, speciesOf, ZONE_BY_ID } from '@games/shrimp-catch/src/engine/species';
import type { Creature, TamerState } from '@games/shrimp-catch/src/engine/state';
import { fog, godRays, ridge, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  bar,
  type Ctx,
  easeOutBack,
  ellipse,
  hashString,
  mix,
  panel,
  rect,
  VH,
  VW,
} from '../gfx/pixel';
import type { GameModule, GameScene } from '../gfx/scene';
import { ANVIL, buildSprite, creatureSprite } from '../gfx/sprites';
import { drawText, fitText } from '../gfx/text';
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

function creatureLook(c: Creature): HTMLCanvasElement {
  let type = 'x';
  try {
    type = speciesOf(c.speciesId).type;
  } catch {
    /* unknown species */
  }
  const color = TYPE_COLORS[hashString(type) % TYPE_COLORS.length]!;
  const body = c.shiny ? mix(color, '#ffffff', 0.45) : color;
  return creatureSprite(hashString(c.speciesId), body, mix(color, '#14081a', 0.4), 14);
}

function nameOf(c: Creature): string {
  try {
    return displayName(c);
  } catch {
    return c.nickname ?? c.speciesId;
  }
}

function infoBox(g: Ctx, x: number, y: number, c: Creature, accent: string): void {
  panel(g, x, y, 128, 30, '#0d1a1a', mix(accent, '#000000', 0.3));
  drawText(g, fitText(nameOf(c), 80), x + 6, y + 3, { color: '#fff4d6', outline: null });
  drawText(g, `Lv${c.level}`, x + 122, y + 3, { color: accent, outline: null, align: 'right' });
  const ratio = c.hp / Math.max(1, c.stats.hp);
  bar(
    g,
    x + 6,
    y + 19,
    92,
    4,
    ratio,
    ratio > 0.5 ? '#5ee08f' : ratio > 0.2 ? '#ffd23f' : '#ff4d6d',
  );
  drawText(g, `${Math.max(0, Math.round(c.hp))}`, x + 122, y + 15, {
    color: '#c8f0e0',
    outline: null,
    align: 'right',
  });
  if (c.shiny) drawText(g, '★', x + 104, y + 15, { color: '#ffe066', outline: null });
}

function createScene(): GameScene<TamerState> {
  let atkT = -10;
  let hurtT = -10;
  let enemyHurtT = -10;
  let catchT = -10;

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
          blit(g, creatureLook(foe), 270 + shake, 94 + eb, {
            anchor: 'bc',
            scale: 3,
            tint: '#ffffff',
            tintAlpha: t - enemyHurtT < 0.15 ? 0.85 : 0,
            alpha: t - catchT < 0.6 ? 1 - (t - catchT) / 0.6 : 1,
          });
        if (me) {
          const lunge = t - atkT < 0.3 ? Math.sin(((t - atkT) / 0.3) * Math.PI) * 24 : 0;
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
          infoBox(g, 226, 128, me, '#5ee08f');
        }
        infoBox(g, 30, 30, foe, abyss ? '#c49aff' : '#ff9a6a');
        drawText(g, `第 ${battle.round} 回合`, VW / 2, 20, { color: '#d8fff0', align: 'center' });
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
        blit(g, creatureLook(state.wild), 300, 160, { anchor: 'bc', scale: 3 * pop });
        plate(g, `野生 ${nameOf(state.wild)} Lv${state.wild.level}`, 300, 88, '#ffe066', 150);
      }
      if (state.phase === 'workshop' || state.phase === 'workshop-slot') {
        blit(g, buildSprite(ANVIL, {}, { rim: '#ffffff' }), 300, 160, { anchor: 'bc', scale: 2 });
        glow(g, 300, 140, 26, '#ff7a2a', 0.3 + 0.2 * Math.sin(t * 9));
      }
      const where = abyss ? `深渊 第 ${state.abyssFloor} 层` : (zone?.name ?? '营地');
      plate(g, where, VW / 2, 40, abyss ? '#e0c8ff' : '#d8fff0', 200);
      if (state.explore) {
        const k = state.explore.steps / Math.max(1, state.explore.target);
        drawText(g, '探索', 120, 58, { color: '#d8fff0' });
        bar(g, 150, 62, 120, 4, k, '#5ee08f');
      }
    },
    hud(f) {
      const { g, state } = f;
      drawText(g, `图鉴 ${state.dexCaught.length}  深渊最深 ${state.deepestFloor}`, VW - 8, 20, {
        color: '#d8fff0',
        align: 'right',
      });
    },
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
          enemyHurtT = f.t + 0.15;
          f.fx.burst(270, 70, {
            count: 18,
            colors: ['#ffffff', '#ffe066'],
            speed: 100,
            shape: 'spark',
          });
          f.fx.float(270, 50, `-${Math.round(pb.enemy.hp - nb.enemy.hp)}`, '#ffe066');
        }
        const pm = pb.playerIndex;
        const before = prev.party[pm]?.hp ?? 0;
        const after = next.party[pm]?.hp ?? 0;
        if (after < before) {
          hurtT = f.t + 0.3;
          f.fx.shake(3, 0.25);
          f.fx.float(110, 120, `-${Math.round(before - after)}`, '#ff8a8a');
        }
      }
      if (next.dexCaught.length > prev.dexCaught.length) {
        catchT = f.t;
        f.fx.burst(270, 80, { count: 50, colors: ['#ffe066', '#ffffff', '#5ee08f'], speed: 130 });
        f.fx.float(270, 60, '捕获成功!', '#ffe066');
        f.fx.flash('#ffffff', 0.4);
      }
      if (next.phase === 'encounter' && prev.phase !== 'encounter') f.fx.flash('#ffffff', 0.5);
    },
  };
}

const module: GameModule<TamerState> = { definition, createScene };
export default module;
