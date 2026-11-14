import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, createRun, type NetState, recapOf, statusOf } from './engine';

const GAME_ID = 'claw-net';
const GAME_VERSION = '4.0.0';

export const definition: GameDefinition<NetState> = {
  meta: {
    id: GAME_ID,
    name: '虾网',
    englishName: 'Claw Net',
    tagline: '补洞，或者在网破之前收鱼',
    description:
      '一张五乘四的夜网。破洞挨着两面，完好的结会变湿；湿结再挨着破洞就会裂开。补一结花一根线，剪一结不再蔓延但也没有鱼。四夜里把鱼收到定额，破洞到八张网就破。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'tie:x:y 补一个破洞或湿结，花 1 线。cut:x:y 把完好结剪成缺口。haul 按当前网收鱼。',
      '坐标从 0 起。detail 写明这一补能稳住几处邻居，以及现在收网大约几条鱼。',
      '脉冲在补或剪之后发生：两个破洞邻居让完好结变湿，一个破洞邻居让湿结裂开。湿结若不再挨破洞，会干回完好。',
      '收网不脉冲。鱼 = 完好 − 破洞×2，最少 0。然后夜里加线，并新开两个破洞。',
      '分数：鱼×12 + 剩余线×6 − 剪口×18。鱼够了 +340。没够或网破只按鱼×4。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
