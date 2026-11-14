import { definition } from '@games/shrimp-trek/src/definition';
import type { RoguelikeState } from '@games/shrimp-trek/src/engine';
import { fog, godRays, ground, ridge, sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  type Ctx,
  easeOutBack,
  easeOutCubic,
  hash01,
  hashString,
  line,
  mix,
  rect,
  VH,
  VW,
} from '../gfx/pixel';
import type { GameModule, GameScene } from '../gfx/scene';
import {
  buildSprite,
  CRAB,
  creatureSprite,
  EEL,
  JELLY,
  OCTOPUS,
  type Palette,
  SHRIMP,
  SHRIMP_WALK,
} from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, kelp, orb, pips, plate, shadow } from '../gfx/world';

const FLOOR = 172;
const LINEAGE_PAL: Record<string, Palette> = {
  crusher: { b: '#ff6b4a', h: '#ffb08a', d: '#c23a2e', t: '#e8503a', c: '#ff8a5c' },
  oracle: { b: '#5ad1ff', h: '#c0f0ff', d: '#2a7ab0', t: '#3ab0e0', c: '#8fe4ff' },
  gambler: { b: '#ffd23f', h: '#fff4b0', d: '#c9871b', t: '#e8b030', c: '#ffe066' },
};
const MUTATION_COLOR: Record<string, string> = {
  left: '#ff7a59',
  right: '#ffb347',
  shell: '#c8a0ff',
  sense: '#5ad1ff',
  dash: '#7cf0a0',
  molt: '#ff7ad9',
  camo: '#4fbf6a',
};

function enemySprite(key: string | null): HTMLCanvasElement {
  switch (key) {
    case 'octopus':
      return buildSprite(OCTOPUS, {}, { rim: '#ffffff', flip: true });
    case 'eel':
      return buildSprite(EEL, {}, { rim: '#ffffff', flip: true });
    case 'feeding':
      return buildSprite(JELLY, {}, { rim: '#ffffff' });
    case 'chef':
      return buildSprite(
        CRAB,
        { b: '#f0f0ff', h: '#ffffff', d: '#9a9ac8', c: '#ffffff' },
        { rim: '#ffffff' },
      );
    default:
      return creatureSprite(hashString(key ?? 'x'), '#6a7a9a', '#c8d4ff', 14);
  }
}

function drawNet(g: Ctx, x: number, y: number, t: number): void {
  for (let i = 0; i < 9; i += 1) {
    const sway = Math.sin(t * 2 + i * 0.5) * 3;
    line(g, x + i * 8, y, x + i * 8 + sway, y + 60, '#9aa6c8');
    line(g, x, y + i * 7, x + 64 + sway, y + i * 7, '#6a7698');
  }
}

function drawPlastic(g: Ctx, x: number, y: number, t: number): void {
  const colors = ['#ff5d73', '#4fd1ff', '#f0f0ff', '#ffd23f'];
  for (let i = 0; i < 9; i += 1) {
    const px = x + hash01(i, 4) * 60 + Math.sin(t + i) * 4;
    const py = y + hash01(i, 5) * 50 + Math.cos(t * 1.3 + i) * 3;
    rect(g, px, py, 6 + (i % 3) * 2, 3 + (i % 2) * 2, colors[i % 4]!);
    rect(g, px, py, 6 + (i % 3) * 2, 1, '#ffffff66');
  }
}

function drawGate(g: Ctx, x: number, t: number): void {
  glow(g, x, FLOOR - 40, 70, '#5ad1ff', 0.25 + 0.08 * Math.sin(t * 2));
  rect(g, x - 34, FLOOR - 92, 14, 92, '#2a3a5a');
  rect(g, x + 20, FLOOR - 92, 14, 92, '#2a3a5a');
  rect(g, x - 40, FLOOR - 100, 80, 12, '#3a4c70');
  rect(g, x - 40, FLOOR - 100, 80, 2, '#7a90c0');
  for (let i = 0; i < 6; i += 1) {
    const lit = Math.sin(t * 3 + i) > 0;
    rect(g, x - 30, FLOOR - 84 + i * 13, 6, 4, lit ? '#5ad1ff' : '#1a4a6a');
    rect(g, x + 24, FLOOR - 84 + i * 13, 6, 4, lit ? '#1a4a6a' : '#5ad1ff');
  }
  for (let y = FLOOR - 88; y < FLOOR; y += 2) {
    const a = 0.25 + 0.2 * Math.sin(t * 4 + y * 0.2);
    rect(g, x - 20, y, 40, 1, `rgba(90,209,255,${a.toFixed(2)})`);
  }
}

function createScene(): GameScene<RoguelikeState> {
  let scroll = 0;
  let target = 0;
  let lunge = -10;
  let hurt = -10;
  let success = true;
  let mutateT = -10;

  return {
    reset(f) {
      target = f.state.depth * 90;
      scroll = target;
    },
    anchor: () => ({ x: 120, y: FLOOR - 30 }),
    draw(f) {
      const { g, t, state } = f;
      target = state.depth * 90;
      scroll += (target - scroll) * Math.min(1, f.dt * 2.2);
      const moving = Math.abs(target - scroll) > 2;
      const deep = Math.min(1, (state.cycle - 1) * 0.25 + state.localDepth * 0.03);
      sky(
        g,
        [mix('#0b4a7a', '#061a3a', deep), mix('#083058', '#04102a', deep), '#031225', '#010712'],
        0,
        VH,
        12,
      );
      godRays(g, t, '#7fd4ff', 5, 0.06 * (1 - deep * 0.6));
      ridge(
        g,
        {
          seed: 3,
          base: 130,
          amp: 50,
          color: mix('#0c3458', '#081a38', deep),
          kind: 'reef',
          scale: 30,
        },
        scroll * 0.15,
      );
      fog(g, t, 104, 26, '#3a8ac0', 0.22, 3);
      ridge(
        g,
        {
          seed: 7,
          base: 160,
          amp: 40,
          color: mix('#082848', '#051228', deep),
          kind: 'reef',
          edge: '#1a5480',
        },
        scroll * 0.4,
      );
      for (let i = 0; i < 9; i += 1) {
        const kx = ((((i * 53 - scroll * 0.7) % (VW + 40)) + VW + 40) % (VW + 40)) - 20;
        kelp(g, Math.round(kx), FLOOR + 2, 24 + (i % 4) * 9, t, i % 2 ? '#1f7a4a' : '#2a9a5a');
      }
      ground(g, FLOOR, '#3a6a8a', '#14304a', '#08182a', 2);
      // Bubbles.
      if (Math.random() < 0.35)
        f.fx.mote(
          Math.random() * VW,
          VH,
          (Math.random() - 0.5) * 4,
          -12 - Math.random() * 14,
          '#9fe4ff',
          6,
          1,
          true,
        );

      const pal = LINEAGE_PAL[state.lineage ?? 'crusher'] ?? {};
      const walkFrame = moving && Math.floor(t * 10) % 2 ? SHRIMP_WALK : SHRIMP;
      const heroSprite = buildSprite(walkFrame, pal, { rim: '#ffffff' });

      if (state.phase === 'lineage') {
        const ids = ['crusher', 'oracle', 'gambler'];
        ids.forEach((id, i) => {
          const x = 80 + i * 112;
          const focus = f.focus?.id === `lineage:${id}`;
          rect(g, x - 22, FLOOR - 10, 44, 10, '#2a4a6a');
          rect(g, x - 22, FLOOR - 10, 44, 2, '#6a9ac0');
          glow(
            g,
            x,
            FLOOR - 26,
            focus ? 40 : 24,
            mix(pal.b ?? '#ff6b4a', '#ffffff', 0.2),
            focus ? 0.5 : 0.25,
          );
          const bob = Math.round(Math.sin(t * 3 + i) * (focus ? 3 : 1));
          blit(g, buildSprite(SHRIMP, LINEAGE_PAL[id], { rim: '#ffffff' }), x, FLOOR - 12 + bob, {
            scale: 2,
            anchor: 'bc',
          });
          plate(
            g,
            f.actions[i]?.label.split('：')[0] ?? id,
            x,
            FLOOR - 62,
            focus ? '#ffe066' : '#d8ccff',
            100,
          );
        });
        drawText(g, '选择你的龙虾谱系', VW / 2, 30, {
          color: '#ffe8d0',
          align: 'center',
          scale: 2,
        });
        return;
      }

      // Hero.
      const heroX =
        112 +
        easeOutCubic(Math.max(0, 1 - Math.abs(f.since - 0.18) * 5)) *
          (lunge >= 0 && f.since < 0.4 ? 48 : 0);
      const dead = state.outcome === 'lost';
      const knock = hurt >= 0 && f.since < 0.5 ? Math.sin(f.since * 30) * 4 * (1 - f.since * 2) : 0;
      shadow(g, heroX, FLOOR + 1, 36);
      if (state.stats.camouflage > 0) glow(g, heroX, FLOOR - 10, 20, '#4fbf6a', 0.25);
      blit(g, heroSprite, heroX - knock, FLOOR + 1 + (dead ? 0 : Math.round(Math.sin(t * 4))), {
        scale: 2,
        anchor: 'bc',
        flipY: dead,
        tint: dead ? '#6a6a8a' : '#ff2040',
        tintAlpha: dead ? 0.7 : hurt >= 0 && f.since < 0.25 ? 0.6 : 0,
      });
      if (mutateT >= 0 && f.since < 1.2) {
        const k = easeOutBack(f.since / 0.6);
        glow(g, heroX, FLOOR - 14, 30 * k, '#ffe066', 0.6 * (1.2 - f.since));
      }

      // Opponent / gate / mutation orbs.
      if (state.phase === 'mutation') {
        state.offeredMutations.forEach((key, i) => {
          const x = 230 + i * 50;
          const y = FLOOR - 70 + Math.round(Math.sin(t * 2 + i * 2) * 5);
          const focus = f.focus?.id === `mutation:${key}`;
          orb(g, x, y, focus ? 9 : 7, MUTATION_COLOR[key] ?? '#ffffff', t + i);
          if (focus) plate(g, f.focus!.label, x, y - 30, '#ffe066', 140);
        });
        drawText(g, '突变潮 · 三选一', 280, 40, { color: '#ffe066', align: 'center' });
      } else if (state.phase === 'encounter' || state.phase === 'ended') {
        const key = state.encounterKey;
        const ex = 286 + (moving ? (target - scroll) * 0.6 : 0);
        if (key === 'finale' || state.localDepth >= 9) drawGate(g, ex, t);
        else if (key === 'net') drawNet(g, ex - 30, FLOOR - 92, t);
        else if (key === 'plastic') drawPlastic(g, ex - 30, FLOOR - 80, t);
        else if (key) {
          const s = enemySprite(key);
          const hitFlash = lunge >= 0 && f.since > 0.12 && f.since < 0.3 && success;
          const bob = Math.round(Math.sin(t * 2.5) * 3);
          glow(g, ex, FLOOR - 24, 34, key === 'eel' ? '#fff36b' : '#ff7ad9', 0.18);
          shadow(g, ex, FLOOR + 1, 30);
          blit(g, s, ex, FLOOR - 4 + bob, {
            scale: 2,
            anchor: 'bc',
            tint: '#ffffff',
            tintAlpha: hitFlash ? 0.85 : 0,
          });
        }
        const name = f.status.headline.split('·').pop()?.trim() ?? '';
        if (name && state.phase === 'encounter') plate(g, name, ex, FLOOR - 112, '#ffd0b0', 140);
      }

      // Vital bars beside the hero.
      const bars: [number, number, string][] = [
        [state.stats.shell, 12, '#ff8a5c'],
        [state.stats.energy, 10, '#ffe066'],
        [state.stats.salinity, 10, '#5ad1ff'],
      ];
      bars.forEach(([v, max, c], i) => {
        rect(g, 92, FLOOR + 10 + i * 4, 42, 3, '#05030c');
        rect(
          g,
          93,
          FLOOR + 11 + i * 4,
          Math.round((40 * Math.max(0, Math.min(max, v))) / max),
          1,
          c,
        );
      });
    },
    hud(f) {
      const { g, t, state } = f;
      if (state.phase === 'lineage') return;
      drawText(g, `潮段 ${state.cycle}`, 10, VH - 32, { color: '#9fe4ff' });
      pips(
        g,
        60,
        VH - 29,
        10,
        Math.min(10, state.localDepth),
        '#5ad1ff',
        Math.min(9, state.localDepth),
        t,
      );
      drawText(g, `名声 ${state.score}`, VW - 10, VH - 32, { color: '#ffe066', align: 'right' });
    },
    react(f, o) {
      const ev = o.events[0];
      if (!ev) return;
      if (ev.type === 'encounter' || ev.type === 'gate') {
        success = Boolean(ev.success);
        lunge = 0;
        if (success) {
          f.fx.burst(280, FLOOR - 26, {
            count: 30,
            colors: ['#ffffff', '#ffe066', '#ff8a5c'],
            speed: 140,
            shape: 'spark',
          });
          f.fx.shake(3, 0.2);
          f.fx.freeze(0.06);
          f.fx.float(286, FLOOR - 70, '成功!', '#9dffb0');
        } else {
          hurt = 0;
          f.fx.burst(112, FLOOR - 14, { count: 22, colors: ['#ff4d6d', '#ffffff'], speed: 90 });
          f.fx.shake(5, 0.35);
          f.fx.flash('#ff2040', 0.25);
          f.fx.float(112, FLOOR - 50, '失手', '#ff8a8a');
        }
      } else if (ev.type === 'mutation') {
        mutateT = 0;
        f.fx.burst(112, FLOOR - 14, {
          count: 40,
          colors: [MUTATION_COLOR[String(ev.key)] ?? '#ffe066', '#ffffff'],
          speed: 110,
          gravity: -20,
        });
      } else if (ev.type === 'lineage') {
        f.fx.burst(112, FLOOR - 10, {
          count: 36,
          colors: ['#9fe4ff', '#ffffff'],
          speed: 90,
          gravity: -40,
        });
      }
    },
  };
}

const module: GameModule<RoguelikeState> = { definition, createScene };
export default module;
