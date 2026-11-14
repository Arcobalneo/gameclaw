import { definition } from '@games/shrimp-greens/src/definition';
import type { VegeState } from '@games/shrimp-greens/src/engine';
import { sky } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { bar, type Ctx, dither, ellipse, hash01, mix, rect, VH, VW, withAlpha } from '../gfx/pixel';
import type { GameModule, GameScene } from '../gfx/scene';
import { BOWL, BROCCOLI, buildSprite, CARROT, PERSON, TOMATO } from '../gfx/sprites';
import { drawText, fitText } from '../gfx/text';
import { blit, plate } from '../gfx/world';

const DRUMSTICK = {
  rows: ['..mmm.', '.mmmmm', '.mmmmm', '..mmm.', '...b..', '...bb.'],
  pal: { m: '#b0602a', b: '#f0e8d8' },
};
const SHIRTS = ['#7a6af0', '#ff7a59', '#4fd1ff', '#ffd23f', '#5ee08f', '#ff7ad9'];

function backdrop(g: Ctx, phase: string, t: number): void {
  if (phase === 'school') {
    sky(g, ['#d8e4f0', '#b8c8dc', '#8a9ab8'], 0, 120, 6);
    for (let x = 20; x < VW; x += 70) {
      rect(g, x, 20, 50, 40, '#9fd4ff');
      rect(g, x, 20, 50, 2, '#ffffff');
      rect(g, x + 24, 20, 2, 40, '#6a7a9a');
    }
  } else if (phase === 'work') {
    sky(g, ['#3a4a6a', '#2a3450', '#1a2238'], 0, 120, 6);
    for (let x = 0; x < VW; x += 16) rect(g, x, (30 + hash01(x, 2) * 30) | 0, 12, 90, '#24304a');
  } else {
    sky(g, ['#5a3420', '#4a2a18', '#3a2012'], 0, 120, 6);
    rect(g, 150, 20, 84, 54, '#1a2a4a');
    rect(g, 150, 20, 84, 2, '#8a6a4a');
    rect(g, 191, 20, 2, 54, '#8a6a4a');
    glow(g, 192, 46, 40, '#ffe6a0', 0.12 + 0.03 * Math.sin(t));
    // Paper lanterns.
    for (const x of [60, 324]) {
      rect(g, x - 6, 18, 12, 16, '#e83a2a');
      glow(g, x, 26, 22, '#ff8a4a', 0.35 + 0.08 * Math.sin(t * 3 + x));
    }
  }
}

function createScene(): GameScene<VegeState> {
  let pulseT = -10;
  let mood: 'good' | 'bad' | 'none' = 'none';

  return {
    anchor: () => ({ x: VW / 2, y: 150 }),
    draw(f) {
      const { g, t, state } = f;
      const scene = state.scenes[Math.min(state.turn, state.scenes.length - 1)];
      const phase = scene?.phase ?? 'home';
      backdrop(g, phase, t);
      rect(g, 0, 120, VW, VH - 120, phase === 'school' ? '#6a7a8a' : '#2a1a10');
      // Diners around the far side.
      const count = scene?.who === 'self' ? 0 : scene?.who === 'class' ? 5 : 4;
      for (let i = 0; i < count; i += 1) {
        const x = VW / 2 - ((count - 1) * 52) / 2 + i * 52;
        const tense = (scene?.heat ?? 0) >= 3 && Math.sin(t * 2 + i) > 0.6;
        blit(
          g,
          buildSprite(PERSON, { c: SHIRTS[i % SHIRTS.length]! }, { rim: '#ffffff' }),
          x,
          112 + (tense ? -2 : 0),
          { anchor: 'bc', scale: 2 },
        );
        if (tense) drawText(g, '!', x + 12, 76, { color: '#ff6b6b' });
      }
      // Table.
      ellipse(g, VW / 2, 140, 150, 26, '#5a3a22');
      ellipse(g, VW / 2, 137, 148, 24, '#8a5a32');
      dither(g, VW / 2 - 140, 128, 280, 6, '#a06a3a', 0.3);
      // Dishes.
      const veg = scene?.vegOnTable ?? true;
      const dishes = veg ? [BROCCOLI, CARROT, TOMATO] : [DRUMSTICK, DRUMSTICK, BROCCOLI];
      dishes.forEach((d, i) => {
        const x = VW / 2 - 80 + i * 80;
        blit(g, buildSprite(BOWL), x, 140, { anchor: 'bc', scale: 2 });
        blit(g, buildSprite(d, {}, { rim: '#ffffff' }), x, 128, { anchor: 'bc', scale: 2 });
        for (let s = 0; s < 3; s += 1) {
          const sy = 112 - ((t * 12 + s * 7 + i * 5) % 20);
          rect(
            g,
            x - 4 + s * 4 + Math.round(Math.sin(t * 2 + s) * 2),
            sy,
            1,
            2,
            withAlpha('#ffffff', 0.4),
          );
        }
      });
      // The player's seat (back view) with stance aura.
      const lineRatio = state.line / 8;
      glow(
        g,
        VW / 2,
        190,
        40,
        mix('#ff6b6b', '#7ee07a', lineRatio),
        0.3 + (t - pulseT < 0.6 ? 0.4 : 0),
      );
      rect(g, VW / 2 - 14, 168, 28, 30, '#3a6a3a');
      rect(g, VW / 2 - 9, 156, 18, 14, '#2a1a2a');
      rect(g, VW / 2 - 14, 168, 28, 2, '#5a9a5a');
      if (scene) plate(g, `${scene.title}`, VW / 2, 40, '#fff0d0', 160);
      if (scene && (scene.heat ?? 0) >= 3)
        glow(g, VW / 2, 90, 90, '#ff3a2a', 0.08 + 0.04 * Math.sin(t * 4));
      if (mood !== 'none' && t - pulseT < 1)
        drawText(g, mood === 'good' ? '♥' : '…', VW / 2, 140 - (t - pulseT) * 20, {
          color: mood === 'good' ? '#ff9ae0' : '#a0a0c0',
          align: 'center',
          scale: 2,
        });
    },
    hud(f) {
      const { g, state } = f;
      const scene = state.scenes[Math.min(state.turn, state.scenes.length - 1)];
      drawText(g, `第 ${Math.min(state.turn + 1, state.maxTurns)}/${state.maxTurns} 席`, 8, 20, {
        color: '#ffe8c0',
      });
      const rows: [string, number, string][] = [
        ['身体', state.body, '#7ee07a'],
        ['家人', state.home, '#ff9ae0'],
        ['场面', state.room, '#9fe4ff'],
        ['立场', state.line, '#ffe066'],
      ];
      rows.forEach(([label, v, color], i) => {
        drawText(g, label, VW - 110, 40 + i * 12, { color });
        bar(g, VW - 80, 45 + i * 12, 70, 3, v / 8, color);
      });
      if (scene?.blurb && f.since < 6)
        plate(g, fitText(scene.blurb, 320), VW / 2, 184, '#fff0d0', 340);
    },
    react(f, o) {
      const prev = o.previous as VegeState;
      const s = o.state;
      pulseT = f.t;
      const delta =
        s.body + s.home + s.room + s.line - (prev.body + prev.home + prev.room + prev.line);
      mood = delta > 0 ? 'good' : delta < 0 ? 'bad' : 'none';
      if (delta < -1) f.fx.shake(2, 0.25);
      f.fx.burst(VW / 2, 170, {
        count: 18,
        colors: delta >= 0 ? ['#7ee07a', '#ffffff'] : ['#ff8a8a', '#a0a0c0'],
        speed: 60,
        gravity: -20,
      });
    },
  };
}

const module: GameModule<VegeState> = { definition, createScene };
export default module;
