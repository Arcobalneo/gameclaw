import { ENEMIES, STAGE, UNITS } from '@games/claw-guard/src/content';
import { definition } from '@games/claw-guard/src/definition';
import type { TowerDefenseState } from '@games/claw-guard/src/engine';
import type { Grade } from '../gfx/art';
import { godRays, sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  bar,
  type Ctx,
  ctx2d,
  dither,
  ellipse,
  hash01,
  makeCanvas,
  mix,
  rect,
  VH,
  VW,
  withAlpha,
} from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
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
import { tiny } from '../gfx/tiny';
import { blit, kelp, pips, plate, shadow } from '../gfx/world';

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

let boardCache: HTMLCanvasElement | null = null;

/** Static seabed: sand trenches for lanes, rocks, coral, entrance caves. Painted once. */
function board(): HTMLCanvasElement {
  if (boardCache) return boardCache;
  const c = makeCanvas(VW, VH);
  const g = ctx2d(c);
  sky(g, ['#0c3050', '#082640', '#061a30', '#030d1a'], 0, VH, 10);
  // Rocky seabed noise.
  for (let i = 0; i < 260; i += 1) {
    const x = hash01(i, 1) * VW;
    const y = hash01(i, 2) * VH;
    const r = 1 + hash01(i, 3) * 3;
    ellipse(g, x, y, r + 1, r * 0.7, mix('#0a2a44', '#14405e', hash01(i, 4)));
  }
  // Trenches: wide dark bed, sand floor, lit top lip.
  const seg = (a: P, b: P, w: number, col: string) => {
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    for (let i = 0; i <= steps; i += 1) {
      const x = Math.round(a.x + ((b.x - a.x) * i) / steps);
      const y = Math.round(a.y + ((b.y - a.y) * i) / steps);
      ellipse(g, x, y, w, w * 0.75, col);
    }
  };
  const all: [P, P][] = [];
  for (const lane of STAGE.lanes) {
    const path = STAGE.paths[lane];
    for (let i = 0; i < path.length - 1; i += 1) all.push([NODES[path[i]!]!, NODES[path[i + 1]!]!]);
  }
  for (const [a, b] of all) seg({ x: a.x, y: a.y - 1 }, { x: b.x, y: b.y - 1 }, 13, '#2a5a7a');
  for (const [a, b] of all) seg({ x: a.x, y: a.y + 2 }, { x: b.x, y: b.y + 2 }, 12, '#051424');
  for (const [a, b] of all) seg(a, b, 10, '#24404e');
  for (const [a, b] of all) seg({ x: a.x, y: a.y + 1 }, { x: b.x, y: b.y + 1 }, 8, '#2e4c58');
  dither(g, 0, 0, VW, VH, '#3a5a6a', 0.06);
  // Sand ripples + shells in trenches.
  for (let i = 0; i < 60; i += 1) {
    const [a, b] = all[i % all.length]!;
    const k = hash01(i, 7);
    const x = Math.round(a.x + (b.x - a.x) * k + (hash01(i, 8) - 0.5) * 10);
    const y = Math.round(a.y + (b.y - a.y) * k + (hash01(i, 9) - 0.5) * 8);
    rect(g, x, y, 3, 1, i % 5 ? '#456a72' : '#e8c8b0');
  }
  // Entrance caves at the left edge.
  for (const n of [NODES.L0!, NODES.M0!, NODES.R0!]) {
    ellipse(g, n.x - 30, n.y, 22, 20, '#04101c');
    ellipse(g, n.x - 30, n.y, 18, 16, '#000408');
    for (let k = -18; k <= 18; k += 6) rect(g, n.x - 14, n.y + k, 3, 2, '#1a3a52');
  }
  // Coral clusters in the gaps.
  const coral = (x: number, y: number, col: string) => {
    for (let k = 0; k < 5; k += 1) {
      const h = 6 + ((k * 5) % 9);
      rect(g, x + k * 3, y - h, 2, h, col);
      rect(g, x + k * 3 - 1, y - h, 4, 2, mix(col, '#ffffff', 0.35));
    }
    rect(g, x - 1, y, 16, 2, withAlpha('#000000', 0.4));
  };
  coral(80, 92, '#ff6b8a');
  coral(86, 150, '#ffb347');
  coral(206, 196, '#c49aff');
  coral(200, 40, '#ff8a5c');
  coral(290, 60, '#5ad1ff');
  coral(296, 182, '#ff6b8a');
  boardCache = c;
  return c;
}

/** The sea gate: stone arch, glowing integrity bars as the portcullis. */
function drawGate(g: Ctx, integrity: number, max: number, t: number): void {
  rect(g, 340, 54, 38, 128, '#2a3a52');
  rect(g, 340, 54, 3, 128, '#6a7a98');
  rect(g, 374, 54, 4, 128, '#141e30');
  for (let y = 60; y < 182; y += 10) rect(g, 340, y, 38, 1, '#1e2a40');
  rect(g, 336, 48, 46, 8, '#3a4a68');
  rect(g, 336, 48, 46, 1, '#9aaac8');
  for (let i = 0; i < max; i += 1) {
    const lit = i < integrity;
    const y = 168 - i * 13;
    rect(g, 347, y, 24, 9, lit ? '#1a6a9a' : '#2a1220');
    if (lit) {
      rect(g, 347, y, 24, 2, '#9fe4ff');
      rect(g, 347 + ((Math.floor(t * 6) + i) % 6) * 4, y + 3, 3, 2, '#c8f4ff');
    } else rect(g, 351, y + 4, 16, 1, '#ff4d6d');
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
      g.drawImage(board(), 0, 0);
      godRays(g, t, '#6fd0ff', 4, 0.05);
      for (const [x, y, h] of [
        [12, 216, 30],
        [110, 30, 18],
        [250, 216, 22],
        [320, 30, 16],
      ] as const)
        kelp(g, x, y, h, t, '#2a8a5a');
      // Flow markers drift toward the gate.
      for (const lane of STAGE.lanes) {
        const path = STAGE.paths[lane];
        for (let i = 0; i < path.length - 1; i += 1) {
          const a = NODES[path[i]!]!;
          const b = NODES[path[i + 1]!]!;
          for (let k = 0; k < 3; k += 1) {
            const p = (t * 0.35 + k / 3 + i * 0.17) % 1;
            rect(
              g,
              Math.round(a.x + (b.x - a.x) * p),
              Math.round(a.y + (b.y - a.y) * p),
              2,
              1,
              withAlpha('#9fe4ff', Math.sin(p * Math.PI) * 0.6),
            );
          }
        }
      }
      const ratio = state.integrity / Math.max(1, state.maxIntegrity);
      glow(g, 360, 118, 46, ratio > 0.5 ? '#4fd1ff' : '#ff4d6d', 0.25 + 0.08 * Math.sin(t * 3));
      drawGate(g, state.integrity, state.maxIntegrity, t);
      if (leakT >= 0 && f.since < 0.5) glow(g, 352, 118, 60, '#ff2040', 0.5 * (1 - f.since * 2));
      // Slots.
      const focusSlot = /:(L1|M1|R1|C|LP|RP)$/.exec(f.focus?.id ?? '')?.[1];
      for (const slot of STAGE.slotOrder) {
        const n = NODES[slot]!;
        const platform = slot === 'LP' || slot === 'RP';
        ellipse(g, n.x, n.y + 7, 13, 4, withAlpha('#000000', 0.45));
        ellipse(g, n.x, n.y + 5, 12, 4, platform ? '#5a6a7a' : '#4a5a6a');
        ellipse(g, n.x, n.y + 4, 11, 3, platform ? '#8a9aa8' : '#6a7a88');
        rect(g, n.x - 6, n.y + 3, 4, 1, '#c8d4e0');
        if (focusSlot === slot) {
          glow(g, n.x, n.y, 22, '#ffe066', 0.45 + 0.2 * Math.sin(t * 8));
        }
        tiny(g, slot, n.x, n.y + 11, { color: '#8aa8c8', align: 'center', alpha: 0.7 });
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
          n.y + 5 + Math.round(Math.sin(t * 3 + n.x)),
          { anchor: 'bc', scale: 2 },
        );
        const max = UNITS[unit.key]?.maxHp ?? 10;
        bar(g, n.x - 9, n.y - 22, 18, 2, unit.hp / max, '#7cf0a0');
      }
      // Enemies (stacked per node).
      const counts = new Map<string, number>();
      for (const e of state.enemies) {
        const n = nodeOf(e);
        const key = `${n.x},${n.y}`;
        const k = counts.get(key) ?? 0;
        counts.set(key, k + 1);
        const x = n.x - 8 - k * 12;
        const y = n.y + 6 + (k % 2) * 3;
        const hit = hitAt.get(e.uid);
        const flash = hit !== undefined && t - hit < 0.18;
        shadow(g, x, y, 14);
        blit(g, enemySprite(e.key), x, y + Math.round(Math.sin(t * 6 + e.uid)), {
          anchor: 'bc',
          scale: 1.5,
          tint: '#ffffff',
          tintAlpha: flash ? 0.9 : 0,
        });
        bar(g, x - 7, y - 22, 14, 2, e.hp / Math.max(1, ENEMIES[e.key]?.maxHp ?? 5), '#ff4d6d');
        if (e.slowed) rect(g, x - 2, y - 20, 4, 2, '#9fe4ff');
      }
      if (focusSlot) {
        const n = NODES[focusSlot]!;
        const lb = say(f, f.focus!.label);
        if (lb) plate(g, lb, n.x, n.y - 40, '#ffe066', 150);
      }
      // Next wave forecast at entrances.
      const next = state.wavePlan[state.pulse - 1] ?? [];
      for (const spawn of next) {
        const n = NODES[STAGE.paths[spawn.lane][0]!]!;
        const a = 0.5 + 0.5 * Math.sin(t * 6);
        glow(g, n.x - 16, n.y, 14, '#ff4d6d', 0.2 + 0.2 * a);
        blit(g, enemySprite(spawn.enemy), n.x - 32, n.y - 16, { anchor: 'bc', alpha: 0.75 });
        tiny(g, `×${spawn.count}`, n.x - 24, n.y - 22, { color: '#ffb0b0' });
      }
    },
    grade: (): Grade => ({ top: '#a0e8ff', bottom: '#020a18', strength: 0.26, bloom: 0.55 }),
    hud(f) {
      const { g, t, state } = f;
      tiny(g, `${Math.min(state.pulse, 10)}/10`, 8, 9, { color: '#9fe4ff' });
      pips(g, 32, 8, 10, Math.max(0, state.pulse - 1), '#4fd1ff', state.pulse - 1, t);
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
          if (e.type === 'kill') {
            f.fx.hit(n.x - 14, n.y, 'medium', Math.PI, ['#ffffff', '#ffe066', '#ff8a5c']);
            f.cue('hit');
          } else f.cue('whoosh');
        } else if (e.type === 'strike' || e.type === 'splash') {
          const n = NODES[String(e.slot)] ?? NODES.C!;
          strikeAt.set(String(e.slot), f.t);
          f.fx.splash(n.x - 14, n.y, '#9fe4ff', 14);
          f.cue('splash');
        } else if (e.type === 'leak') {
          leakT = 0;
          f.fx.hit(352, 118, 'heavy', 0, ['#ff4d6d', '#ffffff']);
          f.cue('heavy');
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
          f.fx.addTrauma(0.3);
          f.cue('good');
        }
      }
    },
  };
}

const module: GameModule<TowerDefenseState> = { definition, createScene };
export default module;
