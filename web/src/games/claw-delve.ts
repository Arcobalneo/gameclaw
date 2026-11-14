import { definition } from '@games/claw-delve/src/definition';
import type { DelveState } from '@games/claw-delve/src/engine';
import type { Grade } from '../gfx/art';
import { sky } from '../gfx/backdrop';
import { rect } from '../gfx/pixel';
import type { GameModule, GameScene, HitRegion } from '../gfx/scene';
import { buildSprite, SHRIMP } from '../gfx/sprites';
import { blit } from '../gfx/world';

function createScene(): GameScene<DelveState> {
  return {
    grade(): Grade {
      return { top: '#1a140c', bottom: '#0c0a08', bloom: 0.3, vignette: 0.85 };
    },
    anchor: () => ({ x: 190, y: 110 }),
    hits(state, actions): HitRegion[] {
      const regions: HitRegion[] = [];
      const left = actions.find((action) => action.id === 'shift:-1');
      const right = actions.find((action) => action.id === 'shift:1');
      const down = actions.find((action) => action.id === 'cut');
      if (left) regions.push({ x: 70, y: 40 + state.layer * 28, w: 36, h: 24, actionId: left.id });
      if (right)
        regions.push({ x: 250, y: 40 + state.layer * 28, w: 36, h: 24, actionId: right.id });
      if (down) regions.push({ x: 150, y: 150, w: 70, h: 36, actionId: down.id });
      return regions;
    },
    draw(f) {
      const { g, state } = f;
      sky(g, ['#1a140c', '#100c08', '#080604'], 0, 216, 6);
      state.oreCol.forEach((ore, layer) => {
        for (let col = 0; col < 3; col += 1) {
          const x = 120 + col * 48;
          const y = 28 + layer * 34;
          const open = state.open[layer]?.[col] === true;
          rect(g, x, y, 40, 28, open ? '#3a2a18' : '#24180e');
          if (ore === col) rect(g, x + 12, y + 8, 16, 12, '#e0b050');
          if (state.braced[layer]) rect(g, x, y + 24, 40, 4, '#8a6840');
        }
      });
      const shrimp = buildSprite(SHRIMP);
      blit(g, shrimp, 140 + state.col * 48, 52 + state.layer * 34, { scale: 2, anchor: 'bc' });
    },
  };
}

const module: GameModule<DelveState> = { definition, createScene };
export default module;
