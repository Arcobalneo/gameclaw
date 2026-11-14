import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, createRun, recapOf, type SumState, statusOf } from './engine';

export const definition: GameDefinition<SumState> = {
  meta: {
    id: 'claw-sum',
    name: '虾算',
    englishName: 'Claw Sum',
    tagline: '拉杆，把数字对准目标',
    description:
      '每一釜有一个公开的目标。你可以加二、加三、翻倍，或者在偶数时对半。正好等于目标就过釜。拉杆次数用完还不相等，这一釜落空。落空太多次就停釜。',
    version: '4.0.0',
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'add2 加二，add3 加三，double 翻倍，half 对半。奇数没有 half。',
      'detail 写明拉完会变成多少，以及目标。',
      '正好相等立刻过釜。次数用完仍不相等算落空。',
      '全部釜对准就赢。落空到上限就输。',
      '分数：对准×80 + 340 − 落空×60。没赢只按对准×40。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
