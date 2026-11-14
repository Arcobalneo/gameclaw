import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, createRun, type DelveState, recapOf, statusOf } from './engine';

export const definition: GameDefinition<DelveState> = {
  meta: {
    id: 'claw-delve',
    name: '虾掘',
    englishName: 'Claw Delve',
    tagline: '离开没撑的一层，井就会塌',
    description:
      '井壁上的矿都看得见。横挖不会塌。下挖会离开这一层，没有支撑就塌一次。撑比要离开的层少。矿够了就停。',
    version: '4.0.0',
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'shift:-1 向左，shift:1 向右。横挖只在这一层，不会塌。',
      'brace 给这一层撑。cut 下挖。离开没撑的层会塌一次。',
      '矿在哪一格写在井壁上。踩到那一格才算挖到。',
      '矿够定额就赢。塌过了上限，或到井底还不够，就输。',
      '分数：矿×20 + 层×15 − 塌×50。挖够 +300。一次塌比方比两车矿更贵。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
