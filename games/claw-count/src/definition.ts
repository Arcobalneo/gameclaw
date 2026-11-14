import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, type CountState, createRun, recapOf, statusOf } from './engine';

const GAME_ID = 'claw-count';
const GAME_VERSION = '4.0.0';

export const definition: GameDefinition<CountState> = {
  meta: {
    id: GAME_ID,
    name: '虾数',
    englishName: 'Claw Count',
    tagline: '一个数字决定哪块板还在',
    description:
      '桥面每格只在两个数字下存在。改数字的次数很少，所以要选一个能连着走最远的数字。磁铁可以硬走过一块对不上的板。坠落三次，这段就结束。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'set:0 到 set:3 改数字，花 1 次改数。step 在下一块可走时前进，否则坠落回段首。',
      'magnet 花一块磁铁，不管数字走上这一格。',
      'detail 写明这个数字还能连着走几格。桥面每一格的可走数字都在状态里。',
      '走完全部段数获胜。坠落达到上限就输。',
      '分数：走完的段×90 + 剩余磁铁×35 − 坠落×70 − 改数×4。全部走完 +380。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
