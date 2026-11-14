import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, createRun, type ReefState, recapOf, statusOf } from './engine';

export const definition: GameDefinition<ReefState> = {
  meta: {
    id: 'claw-reef',
    name: '虾礁',
    englishName: 'Claw Reef',
    tagline: '先走，潮再推没下锚的',
    description:
      '标点都看得见。先走一步，或者下锚停住。然后公开的潮把没下锚的推一格。标只在潮推完、你还站着的那一格算数。',
    version: '4.0.0',
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'step:n e s w 先走一格。anchor 这一潮停住，花一只锚。',
      'detail 写明潮推完会落在哪，或者会不会顶墙。',
      '顶到墙算一次被冲，人留在原地。',
      '两个标都在潮后踩到就赢。被冲过上限，或潮退了还没踩完，就输。',
      '分数：标×90 + 剩余锚×10 − 被冲×70。踩完 +280。一次被冲比省下两只锚更贵。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
