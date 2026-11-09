import type { GameDefinition } from '@gameclaw/gamekit';

import type { BurgerState } from './engine';
import { abort, act, actionsOf, createRun, recapOf, statusOf } from './engine';

const GAME_ID = 'shrimp-burger';
const GAME_VERSION = '2.8.0';

export const definition: GameDefinition<BurgerState> = {
  meta: {
    id: GAME_ID,
    name: '虾堡',
    englishName: 'Shrimp Burger',
    tagline: '限时接料，错料照吃，害虫来了腾出另一只手',
    description:
      '在混乱的汉堡站台接住落下的食材与火候球。配方外材料照样入栈，最终好不好吃看确定性味觉阈值；部分落物会自行融合；小动物间歇偷吃，需要腾出一只手驱赶；火候过生或过熟会惹恼客人，必须安抚。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'catch:<0|1|2> 接住对应落物格（食材 / 火候 / 融合）；错料不会自动失败。',
      'serve 出餐：公开阈值后抽判定值；tasty/lucky 计入进度，bad/disaster 进入安抚窗口。',
      'shoo:<pestId> 驱赶害虫；忽略则会被偷吃材料或火候。',
      'soothe 安抚不满客人；guest 阶段用 wait 等于放任离店。',
      'wait 空拍刷新落物并冷却火候；discard-top 丢掉顶层误接。',
      'normal：60 拍内送出 4 份美味。失败原因会写进 recap（订单、阈值、roll、错料、火候、偷吃）。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
