import { ENEMIES, STAGE, UNITS } from '@games/shrimp-guard/src/content';
import { definition } from '@games/shrimp-guard/src/definition';
import type { TowerDefenseState } from '@games/shrimp-guard/src/engine';
import { godRays, sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { bar, type Ctx, dither, rect, VH, VW } from '../gfx/pixel';
import type { GameModule, GameScene, HitRegion } from '../gfx/scene';
import {
  buildSprite,
  CRAB,
  creatureSprite,
  EEL,
  OCTOPUS,
  type Palette,
  SHRIMP,
  type SpriteDef,
} from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, pips, plate, shadow } from '../gfx/world';

type P = { x: number; y: number };
const NODES: Record<string, P> = {
  L0: { x: 34, y: 62 },
  L1: { x: 140, y: 62 },
  M0: { x: 34, y: 118 },
  M1: { x: 140, y: 118 },
  R0: { x: 34, y: 174 },
  R1: { x: 140, y: 174 },
  C: { x: 254, y: 118 },
  LP: { x: 196, y: 82 },
  RP: { x: 196, y: 154 },
  SEA: { x: 352, y: 118 },
};
const UNIT_PAL: Record<string, Palette> = {
  'reef-guard': { b: '#ff6b4a', h: '#ffb08a', d: '#c23a2e', t: '#e8503a', c: '#ff8a5c' },
  'ring-cutter': { b: '#ffd23f', h: '#fff4b0', d: '#c9871b', t: '#e8b030', c: '#ffe066' },
  'whisker-scout': { b: '#5ad1ff', h: '#c0f0ff', d: '#2a7ab0', t: '#3ab0e0', c: '#8fe4ff' },
  'salt-spray': { b: '#f0f0ff', h: '#ffffff', d: '#9a9ac8', t: '#c8c8e8', c: '#ffffff' },
  'molt-decoy': { b: '#c49aff', h: '#e8d8ff', d: '#6a4ab0', t: '#9a7ae0', c: '#d8c0ff' },
  'gate-stake': { b: '#7cf0a0', h: '#d8ffe4', d: '#2f9a6a', t: '#4fd080', c: '#a8ffc8' },
};
const ENEMY_DEF: Record<string, SpriteDef | null> = {
  'pot-grunt': CRAB,
  'pump-runner': null,
  'ring-borer': null,
  'eel-spark': EEL,
  'octopus-hauler': OCTOPUS,
};

function enemySprite(key: string): HTMLCanvasElement {
  const def = ENEMY_DEF[key];
  if (def) return buildSprite(def, {}, { rim: '#ffffff' });
  return creatureSprite(
    key === 'pump-runner' ? 31 : 77,
    key === 'pump-runner' ? '#ff9a3a' : '#9aa6c8',
    '#ffffff',
    11,
  );
}

function drawLane(g: Ctx, a: P, b: P, t: number, color: string): void {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round(a.x + ((b.x - a.x) * i) / steps);
    const y = Math.round(a.y + ((b.y - a.y) * i) / steps);
    rect(g, x - 9, y - 7, 18, 14, '#0e2a44');
  }
  for (let i = 0; i <= steps; i += 3) {
    const k = ((i + t * 20) % steps) / steps;
    const x = Math.round(a.x + (b.x - a.x) * k);
    const y = Math.round(a.y + (b.y - a.y) * k);
    rect(g, x, y, 2, 1, color);
  }
}

function createScene(): GameScene<TowerDefenseState> {
  const hitAt = new Map<number, number>();
  const strikeAt = new Map<string, number>();
  let leakT = -10;

  const nodeOf = (enemy: { lane: string; pos: number }) => {
    const path = STAGE.paths[enemy.lane as keyof typeof STAGE.paths];
    return NODES[path?.[Math.min(path.length - 1, enemy.pos)] ?? 'SEA']!;
  };

  return {
    anchor: () => ({ x: 254, y: 100 }),
    hits(state, actions): HitRegion[] {
      return STAGE.slotOrder.flatMap((slot) => {
        const occupied = state.roster.some((u) => u.slot === slot);
        const a = occupied
          ? actions.find((x) => x.id === `recall:${slot}`)
          : actions.find((x) => x.id.startsWith('deploy:') && x.id.endsWith(`:${slot}`));
        if (!a) return [];
        const n = NODES[slot]!;
        return [{ x: n.x - 14, y: n.y - 18, w: 28, h: 28, actionId: a.id }];
      });
    },
    draw(f) {
      const { g, t, state } = f;
      sky(g, ['#0a2a48', '#06203a', '#041628', '#020a14'], 0, VH, 10);
      godRays(g, t, '#6fd0ff', 4, 0.05);
      dither(g, 0, 0, VW, VH, '#0a2238', 0.18);
      // Lanes.
      for (const lane of STAGE.lanes) {
        const path = STAGE.paths[lane];
        for (let i = 0; i < path.length - 1; i += 1)
          drawLane(g, NODES[path[i]!]!, NODES[path[i + 1]!]!, t, '#3a8ac0');
      }
      // Sea gate (integrity).
      const ratio = state.integrity / Math.max(1, state.maxIntegrity);
      glow(g, 360, 118, 46, ratio > 0.5 ? '#4fd1ff' : '#ff4d6d', 0.3 + 0.1 * Math.sin(t * 3));
      rect(g, 344, 60, 30, 116, '#24365a');
      rect(g, 344, 60, 30, 2, '#6a8ac0');
      for (let i = 0; i < state.maxIntegrity; i += 1) {
        const lit = i < state.integrity;
        rect(g, 350, 168 - i * 13, 18, 9, lit ? '#4fd1ff' : '#3a1a2a');
        if (lit) rect(g, 350, 168 - i * 13, 18, 1, '#c8f4ff');
      }
      if (leakT >= 0 && f.since < 0.5) glow(g, 352, 118, 60, '#ff2040', 0.5 * (1 - f.since * 2));
      // Slots.
      const focusSlot = /:(L1|M1|R1|C|LP|RP)$/.exec(f.focus?.id ?? '')?.[1];
      for (const slot of STAGE.slotOrder) {
        const n = NODES[slot]!;
        const platform = slot === 'LP' || slot === 'RP';
        rect(g, n.x - 12, n.y + 4, 24, 5, platform ? '#4a5a7a' : '#2a4a6a');
        rect(g, n.x - 12, n.y + 4, 24, 1, '#8aa8d0');
        if (focusSlot === slot) {
          glow(g, n.x, n.y, 22, '#ffe066', 0.45 + 0.2 * Math.sin(t * 8));
          plate(g, f.focus!.label, n.x, n.y - 36, '#ffe066', 150);
        }
        drawText(g, slot, n.x, n.y + 9, { color: '#6a8ac0', align: 'center' });
      }
      // Units.
      for (const unit of state.roster) {
        if (!unit.slot) continue;
        const n = NODES[unit.slot]!;
        const strike = strikeAt.get(unit.slot);
        const lunge =
          strike !== undefined && t - strike < 0.25
            ? Math.sin(((t - strike) / 0.25) * Math.PI) * 6
            : 0;
        shadow(g, n.x, n.y + 4, 18);
        blit(
          g,
          buildSprite(SHRIMP, UNIT_PAL[unit.key], { rim: '#ffffff', flip: true }),
          n.x - lunge,
          n.y + 4 + Math.round(Math.sin(t * 3 + n.x)),
          { anchor: 'bc' },
        );
        const max = UNITS[unit.key]?.maxHp ?? 10;
        bar(g, n.x - 9, n.y - 12, 18, 2, unit.hp / max, '#7cf0a0');
      }
      // Enemies (stacked per node).
      const counts = new Map<string, number>();
      for (const e of state.enemies) {
        const n = nodeOf(e);
        const key = `${n.x},${n.y}`;
        const k = counts.get(key) ?? 0;
        counts.set(key, k + 1);
        const x = n.x - 6 - k * 9;
        const y = n.y + 6 + (k % 2) * 3;
        const hit = hitAt.get(e.uid);
        const flash = hit !== undefined && t - hit < 0.18;
        shadow(g, x, y, 14);
        blit(g, enemySprite(e.key), x, y + Math.round(Math.sin(t * 6 + e.uid)), {
          anchor: 'bc',
          tint: '#ffffff',
          tintAlpha: flash ? 0.9 : 0,
        });
        bar(g, x - 7, y - 16, 14, 2, e.hp / Math.max(1, ENEMIES[e.key]?.maxHp ?? 5), '#ff4d6d');
        if (e.slowed) rect(g, x - 2, y - 20, 4, 2, '#9fe4ff');
      }
      // Next wave forecast at entrances.
      const next = state.wavePlan[state.pulse - 1] ?? [];
      for (const spawn of next) {
        const n = NODES[STAGE.paths[spawn.lane][0]!]!;
        const a = 0.5 + 0.5 * Math.sin(t * 6);
        glow(g, n.x - 16, n.y, 14, '#ff4d6d', 0.2 + 0.2 * a);
        drawText(g, `${ENEMIES[spawn.enemy]?.short ?? '?'}×${spawn.count}`, n.x - 26, n.y - 18, {
          color: '#ffb0b0',
        });
      }
    },
    hud(f) {
      const { g, t, state } = f;
      drawText(g, `Pulse ${Math.min(state.pulse, 10)}/10`, 8, 20, { color: '#9fe4ff' });
      pips(g, 70, 23, 10, Math.max(0, state.pulse - 1), '#4fd1ff', state.pulse - 1, t);
      drawText(g, `潮令 ${state.tide}`, VW - 8, 20, { color: '#ffe066', align: 'right' });
      if (state.phase === 'doctrine')
        drawText(g, '选择守线教条', VW / 2, 36, { color: '#ffe8d0', align: 'center', scale: 2 });
      else if (state.phase === 'setup')
        drawText(g, '布防阶段 · 点击槽位部署', VW / 2, 36, { color: '#ffe8d0', align: 'center' });
    },
    react(f, o) {
      for (const e of o.events) {
        if (e.type === 'attack' || e.type === 'kill') {
          if (typeof e.uid === 'number') hitAt.set(e.uid, f.t);
          if (typeof e.slot === 'string') strikeAt.set(e.slot, f.t);
          const n = NODES[String(e.slot)] ?? NODES.C!;
          f.fx.burst(n.x - 14, n.y, {
            count: e.type === 'kill' ? 22 : 8,
            colors: ['#ffffff', '#ffe066', '#ff8a5c'],
            speed: 80,
            shape: 'spark',
          });
          if (e.type === 'kill') f.fx.freeze(0.04);
        } else if (e.type === 'strike' || e.type === 'splash') {
          const n = NODES[String(e.slot)] ?? NODES.C!;
          strikeAt.set(String(e.slot), f.t);
          f.fx.burst(n.x - 14, n.y, { count: 14, colors: ['#9fe4ff', '#ffffff'], speed: 90 });
        } else if (e.type === 'leak') {
          leakT = 0;
          f.fx.shake(4, 0.35);
          f.fx.burst(352, 118, { count: 30, colors: ['#ff4d6d', '#ffffff'], speed: 120 });
        } else if (e.type === 'deploy') {
          const n = NODES[String(e.slot)] ?? NODES.C!;
          f.fx.burst(n.x, n.y, {
            count: 24,
            colors: ['#9fe4ff', '#ffffff'],
            speed: 70,
            gravity: -40,
          });
        } else if (e.type === 'skill') {
          f.fx.flash('#9fe4ff', 0.35);
          f.fx.shake(2, 0.3);
        }
      }
    },
  };
}

const module: GameModule<TowerDefenseState> = { definition, createScene };
export default module;
