import { TILT_LABEL } from '@games/claw-glass/src/content';
import { definition } from '@games/claw-glass/src/definition';
import { beamPoints, type GlassState } from '@games/claw-glass/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { disc, line, rect, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { drawText } from '../gfx/text';

const OX = 48;
const OY = 28;
const CW = 42;
const CH = 28;

function at(x: number, y: number): { x: number; y: number } {
  return { x: OX + x * CW + CW / 2, y: OY + y * CH + CH / 2 };
}

function createScene(): GameScene<GlassState> {
  return {
    grade(): Grade {
      return { top: '#102040', bottom: '#060810', bloom: 0.6, vignette: 0.8 };
    },
    anchor: (state) => at(state.shrine.x, state.shrine.y),
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const regions: HitRegion[] = state.mirrors.flatMap((mirror, index) => {
        const id = `turn:${index}`;
        if (!actions.some((action) => action.id === id)) return [];
        const pos = at(mirror.x, mirror.y);
        return [{ x: pos.x - 16, y: pos.y - 16, w: 32, h: 32, actionId: id }];
      });
      if (actions.some((action) => action.id === 'fire')) {
        regions.push({ x: 300, y: 164, w: 70, h: 36, actionId: 'fire' });
      }
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      sky(g, ['#0c1830', '#101428', '#080c18'], 0, 216, 8);
      stars(g, t, 2, 24, 40);
      moon(g, 28, 24, 8, '#fff6dc', '#9eb4ff');
      rect(g, 40, 24, 300, 150, '#121826');
      for (let y = 0; y < 5; y += 1) {
        for (let x = 0; x < 7; x += 1) {
          const pos = at(x, y);
          rect(g, pos.x - 2, pos.y - 2, 4, 4, '#1c2436');
        }
      }
      for (const rock of state.rocks) {
        const pos = at(rock.x, rock.y);
        rect(g, pos.x - 8, pos.y - 6, 16, 12, '#3a4458');
      }
      const shrine = at(state.shrine.x, state.shrine.y);
      const pulse = 0.4 + Math.sin(t * 3) * 0.15;
      glow(g, shrine.x, shrine.y, 12, '#ffd27a', state.outcome === 'won' ? 0.8 : pulse);
      disc(g, shrine.x, shrine.y, 5, '#ffd27a');
      const cloud = state.clouds[state.cloud];
      if (cloud) {
        const pos = at(cloud.x, cloud.y);
        const drift = Math.round(Math.sin(t * 2) * 1);
        disc(g, pos.x + drift, pos.y, 8, withAlpha('#d0d8ee', 0.85));
        disc(g, pos.x + 6 + drift, pos.y + 2, 5, withAlpha('#eef2ff', 0.7));
      }
      const points = beamPoints(state);
      for (let i = 1; i < points.length; i += 1) {
        const a = at(points[i - 1]!.x, points[i - 1]!.y);
        const b = at(points[i]!.x, points[i]!.y);
        line(g, a.x, a.y, b.x, b.y, withAlpha('#fff6dc', 0.55 + Math.sin(t * 8) * 0.2));
      }
      state.mirrors.forEach((mirror, index) => {
        const pos = at(mirror.x, mirror.y);
        const tilt = mirror.tilt === 1 ? -1 : 1;
        line(g, pos.x - 8, pos.y + 8 * tilt, pos.x + 8, pos.y - 8 * tilt, '#c8e4ff');
        line(g, pos.x - 7, pos.y + 8 * tilt, pos.x + 7, pos.y - 8 * tilt, '#ffffff');
        const label = say(f, TILT_LABEL[mirror.tilt]);
        if (label && f.focus?.id === `turn:${index}`) {
          drawText(g, label, pos.x, pos.y - 16, {
            color: '#fff6dc',
            align: 'center',
            outline: '#080c18',
          });
        }
      });
      const fire = say(f, '放光');
      if (fire && f.actions.some((action) => action.id === 'fire')) {
        const on = f.focus?.id === 'fire';
        rect(g, 300, 164, 70, 32, on ? '#24345a' : '#141a2c');
        rect(g, 300, 164, 70, 2, '#fff6dc');
        drawText(g, fire, 335, 172, { color: '#fff6dc', align: 'center' });
      }
    },
    react(f, outcome) {
      if (outcome.events.some((event) => event.type === 'fire')) {
        const hit = outcome.result.log.some((line) => line.includes('神龛'));
        f.cue(hit ? 'coin' : 'bad');
        f.fx.burst(200, 80, {
          count: 18,
          colors: hit ? ['#fff6dc', '#ffd27a'] : ['#9eb4ff', '#ffffff'],
          speed: 50,
          life: 0.6,
        });
      } else f.cue('whoosh');
    },
  };
}

const module: GameModule<GlassState> = { definition, createScene };
export default module;
