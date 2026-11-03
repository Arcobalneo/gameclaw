import type { GameDefinition, RecapView, StatusView } from '@gameclaw/gamekit';

import type { VegeState } from './engine';
import { abort, act, actionsOf, createRun, recapOf, statusOf } from './engine';

const GAME_ID = 'shrimp-greens';
const GAME_VERSION = '2.5.0';

function recapView(state: VegeState): RecapView {
  const recap = recapOf(state);
  return {
    title: recap.title,
    outcome: recap.outcome === 'ongoing' ? 'aborted' : recap.outcome,
    cause: recap.cause,
    metrics: recap.metrics,
    timeline: recap.timeline.slice(-10),
    lessons: recap.lessons,
    memoryPrompt: recap.memoryPrompt,
  };
}

export const definition: GameDefinition<VegeState> = {
  meta: {
    id: GAME_ID,
    name: '虾素',
    englishName: 'Shrimp Greens',
    tagline: '十六席，把自己的盘子吃完',
    description:
      '你自己是素食者，不是因为母亲孕期吃素才不吃肉。开局随机性别、性格和家庭：家里可能无肉不欢，也可能同素不同理。十六席从饭桌吃到校园、应酬和你自己的灶。守盘、同席、把话说清、备菜，或者为了场面咬一口——那一口不提供体力。立席要把一种活法收束下来，只是活到最后不算赢。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      '你是自己选的素食者，不是「胎内素」。性别、性格、家庭和理由写在「你是谁」。',
      '十六席，每席一个动作。家里、校园、出门、立席各四席。当前席的热度和有没有素菜，行动前就看得到。',
      'hold 守自己的盘子。没素就扣身体。安静的素菜桌只回身体，不涨立场；吵的素菜桌才涨立场，并掉关系。',
      'share 在热度 ≤ 2 的空桌涨关系。热度 3 不涨关系，还扣身体和立场。软的人在低热度不掉立场。',
      'name 是一次掷骰。日志里有点数、修正和需要的线。成功率是 0 的席不会出现这个动作。',
      'stock 在自己的灶备菜（上限 3）。bring 把备菜摆上没有素菜的桌子，不叠冲突。',
      'bite 为场面咬一口肉：关系 +2，身体 -2，立场 -2。这一口不提供体力。',
      'leave 离席。稳的人关系伤得轻，烈的人立场涨得多。',
      '肉食家庭：没素菜且热度≥2 的家里，硬守、离席或没说动会叠冲突。冲突到 3 且身体≤2、家人≤2 会爆。家人先归零则是断席。',
      '素食家庭若理由不同，differ 把分歧说开，之后才可能分席。',
      '立席只列出你已经够到的收束：自席、同桌、外席、分席。十六席仍不收束就是输。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state) as StatusView,
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: recapView,
};
