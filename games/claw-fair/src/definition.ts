import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, createRun, type FairState, recapOf, statusOf } from './engine';

export const definition: GameDefinition<FairState> = {
  meta: {
    id: 'claw-fair',
    name: '虾市',
    englishName: 'Claw Fair',
    tagline: '客人记得昨天的价钱',
    description:
      '今天的袋子和昨天的价钱都公开。照昨、加一，或者降到袋子里。加价被拒绝时，昨天的价钱不变。货空了就得进货。',
    version: '4.0.0',
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'hold 按昨天卖。raise 比昨天加一。cut 降到客人袋子里的数。',
      '客人付不起，或者加价超过一，就会走。走掉不改昨天的价钱。',
      'restock 这一天不卖，货加二。',
      '钱够定额就赢。走掉到上限，或市散了还不够，就输。',
      '分数：利×8 + 成交×20 − 走掉×50。钱够 +280。一次走掉比两笔薄利更贵。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
