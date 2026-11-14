import { GLYPHS } from '@games/claw-stow/src/content';
import { definition } from '@games/claw-stow/src/definition';
import { glyphName, type StowState } from '@games/claw-stow/src/engine';
import type { Grade } from '../gfx/art';
import { rect } from '../gfx/pixel';
import { type GameModule, type GameScene, type HitRegion, say } from '../gfx/scene';
import { buildSprite, SHRIMP } from '../gfx/sprites';
import { drawText } from '../gfx/text';
import { blit } from '../gfx/world';

const COLORS = ['#7ec8ff', '#ffb45a', '#fff6dc', '#e8e8f0', '#8fd0a0', '#ff8a5c'];

function slot(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: 78 + col * 78, y: 48 + row * 62 };
}

function createScene(): GameScene<StowState> {
  return {
    grade(): Grade {
      return { top: '#3a2418', bottom: '#100c08', bloom: 0.25, vignette: 0.75 };
    },
    anchor: () => ({ x: 180, y: 100 }),
    hits(state, actions): HitRegion[] {
      if (state.outcome !== 'ongoing') return [];
      const regions: HitRegion[] = [];
      for (let i = 0; i < state.bays.length; i += 1) {
        const action = actions.find((item) => item.id.endsWith(`:${i}`));
        if (!action) continue;
        const at = slot(i);
        regions.push({ x: at.x, y: at.y, w: 64, h: 48, actionId: action.id });
      }
      if (actions.some((action) => action.id === 'hold')) {
        regions.push({ x: 300, y: 168, w: 70, h: 36, actionId: 'hold' });
      }
      return regions;
    },
    draw(f) {
      const { g, t, state } = f;
      rect(g, 0, 0, 384, 216, '#1a120c');
      rect(g, 0, 0, 384, 18, '#2a1c12');
      for (let x = 16; x < 384; x += 28) rect(g, x, 6, 10, 4, '#6a4a2a');
      state.bays.forEach((bay, index) => {
        const at = slot(index);
        rect(g, at.x, at.y + 28, 64, 8, '#6a4a2a');
        rect(g, at.x + 4, at.y + 8, 56, 22, '#3a2818');
        if (!bay) return;
        const color = COLORS[bay.glyph] ?? '#fff6dc';
        rect(g, at.x + 18, at.y + 12, 22, 14, color);
        if (bay.labeled) rect(g, at.x + 22, at.y + 4, 14, 6, '#fff6dc');
        const cracks = Math.min(3, bay.age);
        for (let i = 0; i < cracks; i += 1) rect(g, at.x + 20 + i * 4, at.y + 16, 2, 6, '#1a1008');
        const name = say(f, glyphName(bay.glyph));
        if (name) drawText(g, name, at.x + 32, at.y + 14, { color: '#1a1008', align: 'center' });
      });
      const slip = state.events[state.index];
      if (slip && state.outcome === 'ongoing') {
        const label = say(f, GLYPHS[slip.glyph] ?? '贝');
        rect(g, 16, 40, 48, 36, slip.kind === 'order' ? '#c45a48' : '#2a4030');
        if (label) drawText(g, label, 40, 50, { color: '#fff6dc', align: 'center' });
      }
      const bob = Math.round(Math.sin(t * 2) * 1);
      blit(g, buildSprite(SHRIMP), 40, 176 + bob, { scale: 2, anchor: 'bc' });
      const hold = say(f, '放过');
      if (hold && f.actions.some((action) => action.id === 'hold')) {
        rect(g, 300, 168, 70, 32, f.focus?.id === 'hold' ? '#4a2820' : '#241410');
        drawText(g, hold, 335, 176, { color: '#fff4d6', align: 'center' });
      }
    },
    react(f, outcome) {
      if (outcome.events.some((event) => event.type === 'pull')) {
        const wrong = outcome.result.log.some((line) => line.includes('取错'));
        f.cue(wrong ? 'bad' : 'coin');
        f.fx.burst(180, 90, {
          count: 12,
          colors: wrong ? ['#ff5d73', '#ffffff'] : ['#7ee0a0', '#fff6dc'],
          speed: 36,
          life: 0.5,
        });
      } else if (outcome.events.some((event) => event.type === 'hold')) f.cue('bad');
      else f.cue('land');
    },
  };
}

const module: GameModule<StowState> = { definition, createScene };
export default module;
