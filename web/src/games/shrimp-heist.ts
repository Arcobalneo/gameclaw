import { definition } from '@games/shrimp-heist/src/definition';
import { sky, stars } from '../gfx/backdrop';
import { glow } from '../gfx/fx';
import { VH, VW } from '../gfx/pixel';
import type { GameModule, GameScene } from '../gfx/scene';
import { drawText, wrapPixelText } from '../gfx/text';

// biome-ignore lint/suspicious/noExplicitAny: placeholder scene
function createScene(): GameScene<any> {
  return {
    draw(f) {
      sky(f.g, ['#1b0b3a', '#06283f', '#03121f'], 0, VH, 10);
      stars(f.g, f.t, 4, 60);
      glow(f.g, VW / 2, VH / 2, 80, '#ff7ad9', 0.2);
      wrapPixelText(f.status.headline, 300, 3).forEach((l, i) => {
        drawText(f.g, l, VW / 2, 80 + i * 14, { align: 'center' });
      });
    },
  };
}

// biome-ignore lint/suspicious/noExplicitAny: placeholder scene
const module: GameModule<any> = { definition, createScene };
export default module;
