import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, createRun, type RoundState, recapOf, statusOf } from './engine';

export const definition: GameDefinition<RoundState> = {
  meta: {
    id: 'claw-round',
    name: '虾循',
    englishName: 'Claw Round',
    tagline: '六拍之后潮会退',
    description:
      '桥上五样东西都看得见。六拍之后潮退，位置回到桥头。只有入袋的东西留得下来。闸门公开要其中两样。装错一件就浪费这一潮。',
    version: '4.0.0',
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'step:1 向前，step:-1 退后。grab 拿起脚下的东西。pocket 入袋。drop 放回空格。',
      '拍数用完就潮退。没入袋的手里东西会放回脚下。',
      '要带的两样写在状态里。装错会计入错袋。',
      '两样都入袋就赢。潮数用完还没齐就输。',
      '分数：齐了是 460 − 多花的潮×30 − 错袋×60。没齐只按带对的件数×40。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
