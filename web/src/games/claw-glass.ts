import { TILT_LABEL } from '@games/claw-glass/src/content';
import { definition } from '@games/claw-glass/src/definition';
import { beamEnd, beamPoints, fogged, type GlassState } from '@games/claw-glass/src/engine';
import type { Grade } from '../gfx/art';
import { moon, sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { ctx2d, disc, ellipse, hash01, line, makeCanvas, rect, withAlpha } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit, plate, shadow } from '../gfx/world';

const OX = 46;
const OY = 28;
const CW = 42;
const CH = 30;

let court: HTMLCanvasElement | null = null;
let monk: HTMLCanvasElement | null = null;

function at(x: number, y: number): { x: number; y: number } {
  return { x: OX + x * CW + CW / 2, y: OY + y * CH + CH / 2 };
}

function monkSprite(): HTMLCanvasElement {
  if (!monk) monk = buildSprite(SHRIMP, { b: '#d8e4ff', c: '#fff6dc', h: '#ffffff' });
  return monk;
}

function courtLayer(): HTMLCanvasElement {
  if (court) return court;
  const c = makeCanvas(384, 216);
  const g = ctx2d(c);
  sky(g, ['#0c1838', '#101428', '#080c18'], 0, 216, 8);
  rect(g, 36, 22, 312, 156, '#121826');
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const pos = at(x, y);
      const tile = (x + y) % 2 === 0 ? '#1a2234' : '#161c2c';
      rect(g, pos.x - 18, pos.y - 12, 36, 24, tile);
      rect(g, pos.x - 18, pos.y - 12, 36, 1, '#2a3450');
      if (hash01(x * 7 + y, 3) > 0.72) rect(g, pos.x - 4, pos.y, 3, 1, '#3a4458');
    }
  }
  rect(g, 36, 22, 312, 2, '#c8b48a');
  rect(g, 36, 176, 312, 2, '#6a5a40');
  for (let i = 0; i < 6; i += 1) {
    rect(g, 48 + i * 48, 18, 6, 8, '#2a2418');
    rect(g, 46 + i * 48, 16, 10, 2, '#c8b48a');
  }
  court = c;
  return c;
}

function createScene(): GameScene<GlassState> {
  let flash = 0;

  return {
    grade(): Grade {
      return { top: '#9eb4ff', bottom: '#060810', bloom: 0.55, vignette: 0.8, strength: 0.3 };
    },
    anchor: (state) => at(state.shrine.x, state.shrine.y),
    reset() {
      flash = 0;
    },
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const regions: HitRegion[] = state.mirrors.flatMap((mirror, index) => {
        const id = `turn:${index}`;
        if (!actions.some((action) => action.id === id)) return [];
        const pos = at(mirror.x, mirror.y);
        return [{ x: pos.x - 16, y: pos.y - 16, w: 32, h: 32, actionId: id }];
      });
      if (actions.some((action) => action.id === 'fire')) {
        regions.push({ x: 300, y: 168, w: 72, h: 32, actionId: 'fire' });
      }
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      g.drawImage(courtLayer(), 0, 0);
      stars(g, t, 5, 22, 36, '#d8e4ff');
      moon(g, 28, 18, 9, '#fff6dc', '#9eb4ff');
      for (const rock of state.rocks) {
        const pos = at(rock.x, rock.y);
        ellipse(g, pos.x, pos.y + 2, 10, 6, '#0c1018');
        rect(g, pos.x - 8, pos.y - 6, 16, 10, '#4a5468');
        rect(g, pos.x - 8, pos.y - 6, 16, 2, '#8a94a8');
      }
      const shrine = at(state.shrine.x, state.shrine.y);
      const pulse = 0.35 + Math.sin(t * 3) * 0.12;
      rect(g, shrine.x - 10, shrine.y - 14, 3, 18, '#c8b48a');
      rect(g, shrine.x + 7, shrine.y - 14, 3, 18, '#c8b48a');
      rect(g, shrine.x - 12, shrine.y - 16, 26, 4, '#ffe08a');
      glow(g, shrine.x, shrine.y, 14, '#ffd27a', state.outcome === 'won' ? 0.85 : pulse);
      disc(g, shrine.x, shrine.y - 2, 4, '#fff6dc');
      const cloud = state.clouds[state.cloud];
      if (cloud) {
        const pos = at(cloud.x, cloud.y);
        const drift = Math.round(Math.sin(t * 1.6) * 2);
        ellipse(g, pos.x + drift, pos.y + 2, 14, 6, withAlpha('#0c1018', 0.35));
        disc(g, pos.x + drift - 4, pos.y, 8, withAlpha('#c8d0e8', 0.9));
        disc(g, pos.x + drift + 5, pos.y + 1, 6, withAlpha('#eef2ff', 0.85));
        disc(g, pos.x + drift, pos.y - 2, 5, withAlpha('#ffffff', 0.7));
      }
      const end = beamEnd(state);
      const beam = end === 'shrine' ? '#fff6dc' : end === 'cloud' ? '#9eb4ff' : '#6a7898';
      const points = beamPoints(state);
      for (let i = 1; i < points.length; i += 1) {
        const a = at(points[i - 1]!.x, points[i - 1]!.y);
        const b = at(points[i]!.x, points[i]!.y);
        const flick = 0.45 + Math.sin(t * 10 + i) * 0.2;
        line(g, a.x, a.y + 1, b.x, b.y + 1, withAlpha('#fff6dc', 0.25));
        line(g, a.x, a.y, b.x, b.y, withAlpha(beam, flick + (flash > 0 ? 0.4 : 0)));
      }
      if (flash > 0) {
        glow(g, shrine.x, shrine.y, 22, '#fff6dc', flash);
        flash = Math.max(0, flash - 0.04);
      }
      state.mirrors.forEach((mirror, index) => {
        const pos = at(mirror.x, mirror.y);
        const tilt = mirror.tilt === 1 ? -1 : 1;
        const covered = fogged(state, index);
        const hot = f.focus?.id === `turn:${index}`;
        shadow(g, pos.x, pos.y + 8, 10);
        line(g, pos.x - 10, pos.y + 8 * tilt, pos.x + 10, pos.y - 8 * tilt, '#1a2438');
        line(
          g,
          pos.x - 9,
          pos.y + 8 * tilt,
          pos.x + 9,
          pos.y - 8 * tilt,
          covered ? '#6a7898' : '#d8ecff',
        );
        line(
          g,
          pos.x - 8,
          pos.y + 7 * tilt,
          pos.x + 6,
          pos.y - 7 * tilt,
          hot ? '#ffffff' : '#9ec8ff',
        );
        rect(g, pos.x - 2, pos.y + 8, 4, 3, '#8a94a8');
        if (hot) {
          const label = say(f, TILT_LABEL[mirror.tilt]);
          if (label) {
            drawText(g, label, pos.x, pos.y - 16, {
              color: '#fff6dc',
              align: 'center',
              outline: '#080c18',
            });
          }
        }
      });
      const bob = Math.round(Math.sin(t * 2) * 1);
      blit(g, monkSprite(), 24, 196 + bob, { scale: 2, anchor: 'bc' });
      const fire = say(f, '放光');
      if (fire && f.actions.some((action) => action.id === 'fire')) {
        const on = f.focus?.id === 'fire';
        const ready = beamEnd(state) === 'shrine';
        rect(g, 300, 168, 72, 30, on ? '#24345a' : '#141a2c');
        rect(g, 300, 168, 72, 2, ready ? '#fff6dc' : '#6a7898');
        drawText(g, fire, 336, 176, { color: '#fff6dc', align: 'center' });
      }
    },
    hud(f) {
      const { g, state } = f;
      rect(g, 250, 6, 120, 14, withAlpha('#080c18', 0.7));
      for (let i = 0; i < Math.min(state.beatMax, 8); i += 1) {
        rect(g, 256 + i * 10, 9, 7, 7, i < state.beats ? '#d8e4ff' : '#2a3450');
      }
      const hint = say(f, '转镜子要花一拍。云盖住的镜子转不了。');
      if (hint && state.notes.length === 0 && state.outcome === 'ongoing') {
        plate(g, hint, 180, 198, '#d8e4ff', 280);
      }
    },
    react(f, outcome) {
      const kind = String(outcome.events[0]?.type ?? '');
      if (kind === 'fire') {
        const hit = outcome.result.log.some((line) => line.includes('神龛'));
        flash = hit ? 0.9 : 0.2;
        f.cue(hit ? 'coin' : 'bad');
        if (!hit) f.fx.shake(2);
        const shrine = at(f.state.shrine.x, f.state.shrine.y);
        f.fx.burst(shrine.x, shrine.y, {
          count: 18,
          colors: hit ? ['#fff6dc', '#ffd27a'] : ['#9eb4ff', '#ffffff'],
          speed: 50,
          life: 0.6,
          glow: true,
        });
        f.fx.float(shrine.x, shrine.y - 16, hit ? '+' : 'X', hit ? '#fff6dc' : '#ff8aa0');
      } else f.cue('whoosh');
    },
  };
}

const module: GameModule<GlassState> = { definition, createScene };
export default module;
