import type { GameDefinition } from '@gameclaw/gamekit';

import type { LeapState } from './engine';
import { abort, act, actionsOf, createRun, recapOf, statusOf } from './engine';

const GAME_ID = 'shrimp-leap';
const GAME_VERSION = '2.7.0';

export const definition: GameDefinition<LeapState> = {
  meta: {
    id: GAME_ID,
    name: '虾跃',
    englishName: 'Shrimp Leap',
    tagline: '四十五根灯柱，把果冻跳到天亮',
    description:
      '一颗像史莱姆的果冻小生物，沿着不断延伸的街道跳过一根根灯柱。性格与颜色塑造弹力、控制、耐力和黏性；力度、角度、时机组成每一次离散跳跃。每十五关长大一次，离线同性格同伴可能黏在一起，救出它们能换来灯花与护持。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      '先选 nature:bold|steady|mellow，再选 color:coral|mint|amber|lilac；--content bold:coral 可直接开局。',
      'jump:<low|mid|high>:<flat|arc|high>:<early|on|late> 依次是力度、角度、时机。',
      '动作 detail 公开预计落点、误差和结果；next 是当前推荐。合法但预测会失误的跳跃也会真实结算，不会报非法动作。',
      'rest 回体力并推进风拍。精准落地攒灯花，train:<spring|control|endurance|grip> 花 3 灯花养成。',
      '街图在 state.street 累积延伸；关数提高视野、街速与间距。通关 15 / 30 关长大。',
      '同性格同伴是确定性的离线事件，不联网。黏连时用 rescue:<力度>:<时机>，公开进度、拉力和剩余拍数。',
      '第 45 关落地获胜。摔落到上限、力竭失误或救援最后坠落会输；recap 给出具体关卡、动作和误差。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
