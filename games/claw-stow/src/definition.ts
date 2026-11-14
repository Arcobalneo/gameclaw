import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, createRun, recapOf, type StowState, statusOf } from './engine';

const GAME_ID = 'claw-stow';
const GAME_VERSION = '4.0.0';

export const definition: GameDefinition<StowState> = {
  meta: {
    id: GAME_ID,
    name: '虾仓',
    englishName: 'Claw Stow',
    tagline: '先上架，再按单据取',
    description:
      '六格货架。先进一箱垫货，再进单据要的那一箱，然后提取。取出别的字，或者放过这张单，都算取错。没人点的货放久了会自己腾出来，那一次不算取错。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      '进货时 shelve:N 放入空格，mark:N 放入并贴标签。没有空格时才能 swap:N。',
      '提取时 pull:N 取出那一格。字对了才算取对。hold 放过这张单，记一次取错。',
      'detail 写明这一格的字和单据要的字是否相同。状态里能看见后两张单据。',
      '取错达到上限就收仓。单据走完时取对达到定额才算交完。',
      '分数：取对×30 + 最好连段×15 − 取错×70。交完 +340。没交完只留三分之一。一次取错比两次取对更贵。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
