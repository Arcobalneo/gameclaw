import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, createRun, type FlipState, recapOf, statusOf } from './engine';

const GAME_ID = 'claw-flip';
const GAME_VERSION = '4.0.0';

export const definition: GameDefinition<FlipState> = {
  meta: {
    id: GAME_ID,
    name: '虾拨',
    englishName: 'Claw Flip',
    tagline: '一拨，板和空对调',
    description:
      '一条八格的桥。拨动一次，所有板变成空，所有空变成板。石头永远不可走。簧很少，用来跳过石头。迈上不可走的格子会受伤并停住。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'flip 拨动开关。step 迈一格，落点不可走就会受伤。hop 花 1 簧跳过下一格，落点必须可走。',
      '正位时板可走、空不可走。反位相反。石头两边都不可走。',
      'detail 写明下一格是板、空还是石，以及现在可走与否。',
      '走完全部段获胜。受伤达到上限就输。',
      '分数：走完的段×100 + 剩余簧×20 − 伤×80 − 拨动×6。全部走完 +320。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
