import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, createRun, type LampState, recapOf, statusOf } from './engine';

const GAME_ID = 'claw-lamp';
const GAME_VERSION = '4.1.0';

export const definition: GameDefinition<LampState> = {
  meta: {
    id: GAME_ID,
    name: '虾灯',
    englishName: 'Claw Lamp',
    tagline: '灯笼不能互相看见',
    description:
      '黑浅滩上的柱子照亮水洼。两根能看见彼此的柱不能同时立着灯笼。潮水只够很少几次挪动，立错了再收回来比省下灯笼更贵。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'place:N 把一只灯笼立上第 N 根柱，花 1 潮。lift:N 收起来，也花 1 潮，并记一次挪灯。',
      '能看见已经立着的灯的柱不会出现在动作里。detail 写明新照亮几个水洼，以及挡住哪几根柱。',
      '水洼都亮了才能 seal。省下的灯笼记入分数。',
      '潮用尽而水洼还黑，这一局就输。封完全部段数获胜。',
      '分数：封上的段×100 + 省下灯笼×8 − 挪灯×18。全部封上 +360。没封完只留三分之一。一次挪灯比两只省下的灯笼更贵。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
