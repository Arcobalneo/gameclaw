import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, createRun, type RaftState, recapOf, statusOf } from './engine';

const GAME_ID = 'claw-raft';
const GAME_VERSION = '4.1.0';

export const definition: GameDefinition<RaftState> = {
  meta: {
    id: GAME_ID,
    name: '虾筏',
    englishName: 'Claw Raft',
    tagline: '左右一偏，重的一侧就落水',
    description:
      '夜筏只有左舷、中舱、右舷。每一箱的重量和这一阵风都先看见。偏重的一侧会落水，再偏就翻。把货挪进中舱要花一只手，箱子还停在码头。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'port、mid、starboard 把当前这一箱放进左舷、中舱或右舷。中舱满了就没有 mid。',
      'shift 把较重一侧的一成货挪进中舱，花 1 只手。这一箱不装，阵风也不变。',
      'detail 写明这一下放下去会平稳、落水还是翻筏，以及下一阵风会不会再偏。',
      '八箱之后货重达到定额就靠岸。翻筏，或者货不够，都是输。',
      '分数：货重×25 + 平稳×20 − 落水×60。靠岸 +380。没靠岸只留三分之一。一次落水比两成货重更贵。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
