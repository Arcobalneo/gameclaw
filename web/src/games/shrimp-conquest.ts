import { definition } from '@games/shrimp-conquest/src/definition';
import type { TinyState } from '@games/shrimp-conquest/src/engine';
import { fog, ridge, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { bar, type Ctx, rect, VH, VW, withAlpha } from '../gfx/pixel';
import type { GameModule, GameScene } from '../gfx/scene';
import { ANVIL, buildSprite, FLAG, HERO } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, pips, plate, shadow } from '../gfx/world';

const GROUND = 176;
const KINGDOM: Record<string, { wall: string; trim: string; sky: string[]; name: string }> = {
  bastion: {
    wall: '#4a4a5a',
    trim: '#8a8aa0',
    sky: ['#3a2a4a', '#2a1a34', '#140a1a'],
    name: '铁壁国',
  },
  harvest: {
    wall: '#6a4a2a',
    trim: '#c8a050',
    sky: ['#5a3a1a', '#3a2412', '#1a1008'],
    name: '丰仓国',
  },
  mirror: {
    wall: '#3a5a6a',
    trim: '#9fe4ff',
    sky: ['#1a3a4a', '#10242e', '#081218'],
    name: '镜湖国',
  },
};

function castle(
  g: Ctx,
  x: number,
  w: number,
  h: number,
  wall: string,
  trim: string,
  t: number,
): void {
  rect(g, x, GROUND - h, w, h, wall);
  for (let i = 0; i < w; i += 14) rect(g, x + i, GROUND - h - 8, 8, 8, wall);
  rect(g, x, GROUND - h, w, 2, trim);
  for (let i = 1; i < 4; i += 1) {
    const wx = x + (w * i) / 4 - 3;
    const lit = Math.sin(t * 2 + i) > -0.3;
    rect(g, wx, GROUND - h + 20, 6, 10, lit ? '#ffcf6a' : '#1a1020');
    if (lit) glow(g, wx + 3, GROUND - h + 25, 10, '#ffb347', 0.3);
  }
  rect(g, x + w / 2 - 12, GROUND - 36, 24, 36, '#120810');
}

function createScene(): GameScene<TinyState> {
  let hitT = -10;
  let hurtT = -10;
  let forgeT = -10;

  return {
    anchor: () => ({ x: 90, y: GROUND - 30 }),
    draw(f) {
      const { g, t, state } = f;
      const k = KINGDOM[state.target ?? 'bastion'] ?? KINGDOM.bastion!;
      sky(g, [...k.sky, '#05030a'], 0, VH, 10);
      stars(g, t, 17, 40, 70);
      ridge(g, { seed: 21, base: 140, amp: 40, color: '#1a1020', kind: 'hills' }, t * 1.2);
      fog(g, t, 120, 22, '#5a3a6a', 0.25, 3);
      // Giant kingdom in the distance.
      castle(g, 200, 160, 120, k.wall, k.trim, t);
      blit(g, buildSprite(FLAG), 274, GROUND - 150, { scale: 2 });
      rect(g, 0, GROUND, VW, VH - GROUND, '#1a120e');
      rect(g, 0, GROUND, VW, 2, '#3a2a1e');
      // Giant blades of grass (we are tiny).
      for (let i = 0; i < 18; i += 1) {
        const x = i * 22 + 4;
        const sway = Math.round(Math.sin(t * 1.5 + i) * 2);
        rect(g, x + sway, GROUND - 24 - (i % 3) * 8, 3, 24 + (i % 3) * 8, '#2a4a2a');
      }
      const heroX = state.phase === 'escape' ? 70 + ((t * 60) % 40) : 90;
      const bob =
        state.phase === 'escape' ? Math.abs(Math.sin(t * 16)) * 3 : Math.round(Math.sin(t * 3));
      const lunge = t - hitT < 0.3 ? Math.sin(((t - hitT) / 0.3) * Math.PI) * 30 : 0;
      const hb = t - hurtT < 0.3 ? Math.sin((t - hurtT) * 50) * 3 : 0;

      if (state.phase === 'briefing') {
        drawText(g, '国王只给一年 · 选一个大人国', VW / 2, 36, {
          color: '#ffe0e8',
          align: 'center',
          scale: 2,
        });
      }
      if (state.phase === 'workshop') {
        blit(g, buildSprite(ANVIL, {}, { rim: '#ffffff' }), 150, GROUND, {
          anchor: 'bc',
          scale: 2,
        });
        glow(g, 150, GROUND - 20, 30, '#ff7a2a', 0.3 + 0.2 * Math.sin(t * 10));
        if (t - forgeT < 0.5)
          glow(g, 150, GROUND - 24, 40, '#ffe066', 0.6 * (1 - (t - forgeT) * 2));
      }
      if (state.phase === 'discovery') {
        // A giant eye peers down.
        const open = 0.5 + 0.5 * Math.sin(t * 2);
        rect(g, 150, 40, 90, Math.round(30 * open), '#f0e8e0');
        rect(g, 185, 40 + 15 * open - 8, 20, Math.round(16 * open), '#2a1a3a');
        glow(g, 195, 55, 60, '#ff2a4a', 0.2);
      }
      if (state.phase === 'combat' && state.combat) {
        // Giant boot stomping.
        const stomp = Math.abs(Math.sin(t * 2)) * 30;
        rect(g, 170, GROUND - 60 - stomp, 60, 50, '#3a2a2a');
        rect(g, 160, GROUND - 14 - stomp, 80, 14, '#2a1a1a');
        shadow(g, 200, GROUND, 80 - stomp);
        pips(
          g,
          160,
          40,
          state.combat.maxRounds,
          state.combat.round,
          '#ff5d73',
          state.combat.round,
          t,
        );
        drawText(g, `连击 ${state.combat.combo}`, 160, 50, { color: '#ffe066' });
      }
      if (state.phase === 'captured') {
        for (let i = 0; i < 6; i += 1) rect(g, 70 + i * 8, GROUND - 40, 2, 40, '#8a8aa0');
        rect(g, 66, GROUND - 42, 48, 3, '#8a8aa0');
      }
      if (state.phase === 'escape' && state.escape) {
        drawText(g, '逃跑!', VW / 2, 36, { color: '#ff6b6b', align: 'center', scale: 2 });
        bar(g, 110, 70, 160, 5, state.escape.progress / Math.max(1, state.escape.need), '#7cf0a0');
        drawText(g, `剩 ${state.escape.beatsLeft} 拍`, VW / 2, 78, {
          color: '#ffd0d0',
          align: 'center',
        });
        for (let i = 0; i < state.escape.hazard; i += 1)
          glow(g, 30 + i * 18, GROUND - 10, 10, '#ff2a4a', 0.4);
      }
      shadow(g, heroX + lunge, GROUND + 1, 16);
      blit(g, buildSprite(HERO, {}, { rim: '#ffffff' }), heroX + lunge + hb, GROUND + 1 - bob, {
        anchor: 'bc',
        scale: 2,
        tint: '#ff2040',
        tintAlpha: t - hurtT < 0.15 ? 0.6 : 0,
      });
      if (state.weapon) glow(g, heroX + 14, GROUND - 14, 10, '#9fe4ff', 0.5);
      if (state.target) plate(g, k.name, 280, GROUND - 100, '#ffe0e8', 100);
    },
    hud(f) {
      const { g, state } = f;
      drawText(g, `第 ${state.week}/52 周`, 8, 40, { color: '#ffe0e8' });
      const rows: [string, number, number, string][] = [
        ['控制', state.control, 10, '#ff5d73'],
        ['影响', state.influence, 10, '#9fe4ff'],
        ['体力', state.health, 5, '#7cf0a0'],
        ['暴露', state.suspicion, 10, '#ffb347'],
      ];
      rows.forEach(([label, v, max, color], i) => {
        drawText(g, label, 8, 54 + i * 12, { color });
        bar(g, 36, 59 + i * 12, 56, 3, v / max, color);
      });
      if (state.phase === 'field' && f.since < 3) {
        const note = state.timeline.at(-1)?.split('→')[1]?.trim();
        if (note) plate(g, note, VW / 2, 190, '#ffe0e8', 330);
      }
      if (state.suspicion >= 7) {
        g.fillStyle = withAlpha('#ff1030', 0.05);
        g.fillRect(0, 0, VW, VH);
      }
    },
    react(f, o) {
      const prev = o.previous as TinyState;
      const s = o.state;
      if (s.health < prev.health) {
        hurtT = f.t;
        f.fx.shake(4, 0.3);
      }
      if (
        o.action.id.startsWith('strike') ||
        o.action.id.startsWith('attack') ||
        (s.combat && prev.combat && s.combat.enemy < prev.combat.enemy)
      ) {
        hitT = f.t;
        f.fx.burst(200, GROUND - 40, {
          count: 22,
          colors: ['#ffffff', '#ffe066'],
          speed: 120,
          shape: 'spark',
        });
        f.fx.freeze(0.05);
      }
      if (
        s.forged > prev.forged ||
        o.action.id.startsWith('forge') ||
        o.action.id.startsWith('craft')
      ) {
        forgeT = f.t;
        f.fx.burst(150, GROUND - 24, { count: 30, colors: ['#ffe066', '#ff7a2a'], speed: 100 });
      }
      if (s.phase === 'discovery' && prev.phase !== 'discovery') {
        f.fx.flash('#ff2040', 0.4);
        f.fx.shake(3, 0.4);
      }
      if (s.control > prev.control || s.influence > prev.influence)
        f.fx.burst(280, GROUND - 120, { count: 26, colors: ['#ff5d73', '#ffe066'], speed: 90 });
      if (s.phase === 'escape')
        f.fx.burst(80, GROUND, { count: 6, colors: ['#8a7a6a'], speed: 30, glow: false });
    },
  };
}

const module: GameModule<TinyState> = { definition, createScene };
export default module;
