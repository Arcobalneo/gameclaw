import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, type CoilState, createRun, recapOf, statusOf } from './engine';

export const definition: GameDefinition<CoilState> = {
  meta: {
    id: 'claw-coil',
    name: '虾绕',
    englishName: 'Claw Coil',
    tagline: '尾巴跟着头，把箱子推进坞',
    description:
      '头走一格，尾巴就补上。箱子在头的前面会被推一格，前面是墙就推不动。箱子推进坞才算这一箱。撞墙或撞自己停在原地，并记一次撞。',
    version: '4.0.0',
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'n 北，s 南，e 东，w 西。一动就是一格。',
      'detail 会告诉你这一步是不是墙或自己的身子。',
      '箱子的格子和坞的格子写在状态里。',
      '全部箱子进坞就赢。撞的次数到上限就输。',
      '分数：进坞×80 + 身长×8 − 撞×40。全部进坞 +300。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
