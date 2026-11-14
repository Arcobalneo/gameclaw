import { definition } from '@games/claw-trek/src/definition';
import type { RoguelikeState } from '@games/claw-trek/src/engine';
import type { Grade } from '../gfx/art';
import { fog, godRays, ground, ridge, sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import {
  type Ctx,
  easeOutBack,
  easeOutCubic,
  ellipse,
  hashString,
  line,
  mix,
  rect,
  VH,
  VW,
  withAlpha,
} from '../gfx/pixel';
import { type GameModule, type GameScene, say } from '../gfx/scene';
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
import { tiny } from '../gfx/tiny';
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

/** A drifting gill net: catenary floats line, knotted diamond mesh, snagged debris. */
function drawNet(g: Ctx, x: number, y: number, t: number): void {
  const w = 96;
  const h = 96;
  const sway = (yy: number) => Math.sin(t * 1.6 + yy * 0.06) * (yy / h) * 6;
  const cols = 9;
  const rows = 9;
  const px = (c: number, r: number) =>
    x + (c / (cols - 1)) * w + sway(r * (h / rows)) + Math.sin(c * 0.8) * (r / rows) * 4;
  const py = (c: number, r: number) =>
    y + 6 + Math.sin((c / (cols - 1)) * Math.PI) * 8 + r * (h / rows);
  for (let r = 0; r < rows; r += 1)
    for (let c = 0; c < cols; c += 1) {
      if (c < cols - 1)
        line(
          g,
          Math.round(px(c, r)),
          Math.round(py(c, r)),
          Math.round(px(c + 1, r + (r % 2 ? -0.5 : 0.5))),
          Math.round(py(c + 1, r + (r % 2 ? -0.5 : 0.5))),
          '#7a8aa8',
        );
      if (r < rows - 1)
        line(
          g,
          Math.round(px(c, r)),
          Math.round(py(c, r)),
          Math.round(px(c, r + 1)),
          Math.round(py(c, r + 1)),
          '#5a6a88',
        );
      rect(g, Math.round(px(c, r)), Math.round(py(c, r)), 1, 1, '#c8d4e8');
    }
  // Head rope with orange floats.
  for (let c = 0; c < cols - 1; c += 1)
    line(
      g,
      Math.round(px(c, 0)),
      Math.round(py(c, 0)),
      Math.round(px(c + 1, 0)),
      Math.round(py(c + 1, 0)),
      '#d8c8a0',
    );
  for (let c = 0; c < cols; c += 2) {
    const fx = Math.round(px(c, 0));
    const fy = Math.round(py(c, 0)) - 4 + Math.round(Math.sin(t * 2 + c) * 1);
    ellipse(g, fx, fy, 5, 3, '#c84a1a');
    ellipse(g, fx, fy - 1, 4, 2, '#ff8a3a');
    rect(g, fx - 2, fy - 2, 2, 1, '#ffd0a0');
  }
  // Snagged fish skeleton + weed.
  const sx = Math.round(px(5, 5));
  const sy = Math.round(py(5, 5));
  line(g, sx - 6, sy, sx + 6, sy, '#e8e0d0');
  for (let i = -4; i <= 4; i += 2) line(g, sx + i, sy - 2, sx + i, sy + 2, '#c8c0b0');
  rect(g, sx + 6, sy - 2, 3, 4, '#e8e0d0');
  for (let i = 0; i < 10; i += 1)
    rect(
      g,
      Math.round(px(2, 6)) + Math.round(Math.sin(t + i * 0.6) * 2),
      Math.round(py(2, 6)) + i * 2,
      1,
      2,
      '#3a9a5a',
    );
}

/** Drifting plastic: a billowing bag, a bottle and six-pack rings. */
function drawPlastic(g: Ctx, x: number, y: number, t: number): void {
  // Bag: translucent body that breathes with the current.
  const breath = Math.sin(t * 1.8);
  const bx = x + 30 + Math.round(Math.sin(t * 0.7) * 6);
  const by = y + 14 + Math.round(Math.cos(t * 0.9) * 4);
  g.globalAlpha = 0.55;
  for (let r = 0; r < 34; r += 1) {
    const wv =
      12 + Math.sin((r / 34) * Math.PI) * (8 + breath * 3) + Math.sin(r * 0.5 + t * 4) * 1.5;
    rect(g, Math.round(bx - wv), by + r, Math.round(wv * 2), 1, r < 4 ? '#f8f8ff' : '#d8e4f0');
  }
  g.globalAlpha = 1;
  for (const hx of [-11, 5]) {
    const top = Math.round(by - 9 - breath);
    line(g, bx + hx, by + 1, bx + hx + 1, top + 2, '#e8eef8');
    line(g, bx + hx + 1, top + 2, bx + hx + 4, top, '#e8eef8');
    line(g, bx + hx + 4, top, bx + hx + 6, by + 1, '#c8d4e4');
  }
  rect(g, bx - 6, by + 10, 3, 14, withAlpha('#ffffff', 0.6));
  for (let i = 0; i < 4; i += 1)
    rect(g, bx - 10 + i * 6, by + 22 + (i % 2) * 3, 4, 1, withAlpha('#a8b8c8', 0.7));
  // Bottle tumbling slowly.
  const bt = x - 4;
  const btY = y + 60 + Math.round(Math.sin(t * 1.2) * 3);
  rect(g, bt, btY, 22, 9, withAlpha('#7ad0ff', 0.55));
  rect(g, bt, btY, 22, 2, withAlpha('#e8f8ff', 0.8));
  rect(g, bt + 6, btY + 2, 8, 5, '#ff5d73');
  rect(g, bt + 22, btY + 2, 5, 5, withAlpha('#7ad0ff', 0.55));
  rect(g, bt + 27, btY + 2, 3, 5, '#3ab0ff');
  // Six-pack rings.
  const rx = x + 52;
  const ry = y + 68 + Math.round(Math.cos(t * 1.4) * 2);
  for (let i = 0; i < 3; i += 1)
    for (let j = 0; j < 2; j += 1) {
      ellipse(g, rx + i * 9, ry + j * 7, 5, 4, '#e8e8f0');
      ellipse(g, rx + i * 9, ry + j * 7, 3, 2, '#0a2a4a');
    }
}

/** Dark near-camera silhouettes that sell depth. */
function foreground(g: Ctx, scroll: number, t: number, color: string): void {
  const span = VW + 120;
  for (let i = 0; i < 5; i += 1) {
    const x = ((((i * 97 - scroll * 1.35) % span) + span) % span) - 60;
    const h = 34 + (i % 3) * 6;
    // Coral fan / rock.
    if (i % 2) {
      ellipse(g, x, VH + 6, 46, h * 0.45, color);
      ellipse(g, x + 18, VH + 2, 26, h * 0.6, color);
      for (let k = 0; k < 6; k += 1) {
        const bx = x - 30 + k * 11;
        const bh = 14 + ((k * 7) % 12);
        rect(g, bx, VH - h * 0.45 - bh + 8, 3, bh, color);
        rect(g, bx - 3, VH - h * 0.45 - bh + 8, 9, 3, color);
      }
    } else {
      for (let k = 0; k < 4; k += 1) {
        const sway = Math.sin(t * 1.4 + i + k) * 4;
        for (let yy = 0; yy < h; yy += 2)
          rect(
            g,
            Math.round(x + k * 9 + sway * (yy / h) ** 1.5),
            VH - yy,
            5 - Math.floor((yy / h) * 3),
            2,
            color,
          );
      }
    }
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
      fog(g, t, 104, 26, '#3a8ac0', 0.1, 3);
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
            say(f, f.actions[i]?.label.split('：')[0] ?? '') || id.toUpperCase(),
            x,
            FLOOR - 62,
            focus ? '#ffe066' : '#d8ccff',
            100,
          );
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
          const lb = focus ? say(f, f.focus!.label) : '';
          if (lb) plate(g, lb, x, y - 30, '#ffe066', 140);
        });
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
          glow(g, ex, FLOOR - 34, 48, key === 'eel' ? '#fff36b' : '#ff7ad9', 0.18);
          shadow(g, ex, FLOOR + 1, 30);
          blit(g, s, ex, FLOOR - 4 + bob, {
            scale: 3,
            anchor: 'bc',
            tint: '#ffffff',
            tintAlpha: hitFlash ? 0.85 : 0,
          });
        }
        const name = say(f, f.status.headline.split('·').pop()?.trim() ?? '');
        if (name && state.phase === 'encounter') plate(g, name, ex, FLOOR - 118, '#ffd0b0', 140);
      }

      // Ground detail + foreground parallax.
      for (let i = 0; i < 14; i += 1) {
        const span = VW + 20;
        const gx = ((((i * 41 - scroll) % span) + span) % span) - 10;
        const gy = FLOOR + 6 + (i % 4) * 9;
        if (i % 3 === 0) {
          ellipse(g, gx, gy, 4, 2, '#e8c8a8');
          rect(g, gx - 1, gy - 1, 2, 1, '#fff0e0');
        } else rect(g, gx, gy, 3, 2, i % 2 ? '#2a4a62' : '#4a7090');
      }
      foreground(g, scroll, t, mix('#04101e', '#010610', deep));
    },
    grade(state): Grade {
      const deep = Math.min(1, (state.cycle - 1) * 0.25 + state.localDepth * 0.03);
      return {
        top: mix('#9fe4ff', '#5a7aff', deep),
        bottom: '#020818',
        strength: 0.3,
        bloom: 0.55 + deep * 0.2,
      };
    },
    hud(f) {
      const { g, t, state } = f;
      if (state.phase === 'lineage') return;
      tiny(g, `C${state.cycle}`, 10, 10, { color: '#9fe4ff' });
      pips(
        g,
        26,
        9,
        10,
        Math.min(10, state.localDepth),
        '#5ad1ff',
        Math.min(9, state.localDepth),
        t,
      );
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
          f.fx.hit(282, FLOOR - 26, 'medium', 0, ['#ffffff', '#ffe066', '#ff8a5c']);
          f.fx.splash(282, FLOOR - 20, '#9fe4ff', 12);
          f.fx.float(286, FLOOR - 60, '★', '#9dffb0');
          f.cue('hit');
        } else {
          hurt = 0;
          f.fx.burst(112, FLOOR - 14, { count: 22, colors: ['#ff4d6d', '#ffffff'], speed: 90 });
          f.fx.hit(112, FLOOR - 14, 'heavy', Math.PI, ['#ff4d6d', '#ffffff']);
          f.fx.flash('#ff2040', 0.25);
          const prev = o.previous as RoguelikeState;
          const loss = prev.stats.shell - o.state.stats.shell;
          if (loss > 0) f.fx.float(112, FLOOR - 50, `-${loss}`, '#ff8a8a');
          f.cue('heavy');
        }
      } else if (ev.type === 'mutation') {
        mutateT = 0;
        f.fx.ring(112, FLOOR - 14, MUTATION_COLOR[String(ev.key)] ?? '#ffe066', 30);
        f.cue('good');
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
