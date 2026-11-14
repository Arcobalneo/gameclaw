import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, type ClockState, createRun, recapOf, statusOf } from './engine';

const GAME_ID = 'claw-clock';
const GAME_VERSION = '4.0.0';

export const definition: GameDefinition<ClockState> = {
  meta: {
    id: GAME_ID,
    name: '虾钟',
    englishName: 'Claw Clock',
    tagline: '先转环，指针再吃下一格',
    description:
      '八格环上有你、两只敌和两颗珠。先把环转一格或和对面交换，然后指针前进并吃掉那一格。敌被吃掉是目标。珠被吃掉要扣分。指针吃到你自己会受伤。清空每一圈的敌。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'rotate:1 顺时针转整环，rotate:-1 逆时针，cross 和对面交换。然后指针前进一格。',
      '指针吃到敌就击破，吃到珠就打碎，吃到你就受伤。空格没有事。',
      '这一圈没有敌了就进入下一圈。步数用尽或受伤达到上限就输。',
      '环上每一格都写在状态里。下一格会吃到什么也写在状态里。',
      '分数：清空的圈×100 + 击破×12 − 碎珠×28 − 伤×80。全部清空 +340。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
