import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, createRun, type MeltState, recapOf, statusOf } from './engine';

const GAME_ID = 'claw-melt';
const GAME_VERSION = '4.0.0';

export const definition: GameDefinition<MeltState> = {
  meta: {
    id: GAME_ID,
    name: '虾熔',
    englishName: 'Claw Melt',
    tagline: '六列潮井。顶壳会被潮推走',
    description:
      '把壳落入六列潮井。同一行左右相连的同尺寸壳熔成更大的一枚，叠在同一列不会熔。列一旦叠满，井口就堵住。每隔几落，潮把不比邻列矮的顶壳推一格；边上一列高过两层就会滑出井。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'drop:0 到 drop:5 把当前这枚壳落入对应列。列满了就不会出现。',
      'detail 给出这一落的合成次数、壳分、最大尺寸和滑出数。预览不含下一枚的随机。',
      '同一行里左右相连的同尺寸会熔成大一号，再下落。上下叠在一列不会熔。某一列叠满就堵住井口。',
      '潮向左或潮向右写在状态里。顶壳只在邻列不更高时滑动。高出两层的边壳滑出井。',
      '分数：壳分 + 最好连锁×28 + 最大尺寸×30 − 滑出×22。过井 +380。堵住井口只留壳分的三分之一。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
