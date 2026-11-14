import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, createRun, type MaskState, recapOf, statusOf } from './engine';

const GAME_ID = 'claw-mask';
const GAME_VERSION = '4.0.0';

export const definition: GameDefinition<MaskState> = {
  meta: {
    id: GAME_ID,
    name: '虾罩',
    englishName: 'Claw Mask',
    tagline: '三格面罩，两层礁路',
    description:
      '同一条廊有墨层和潮层。面罩盖住的三格看墨层，其余看潮层。迈上可走的那一层。有的格子必须露在罩外。每两步潮往前一格，在廊口磨蹭会被潮追上。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'step 迈一步。mask:+1 和 mask:-1 把三格面罩左右移动。',
      '盖住的格子看墨层，没盖住的看潮层。detail 写明下一格现在可走还是空。',
      '每两个动作潮往前一格。潮超过你的位置，或者你还在廊口而潮已经到了，都会坠落。',
      '走完全部廊获胜。坠落达到上限就输。',
      '分数：走完的廊×90 − 滑移×4 − 坠落×75。全部走完 +360。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
