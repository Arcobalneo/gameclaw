import type { GameDefinition, RecapView, StatusView } from '@gameclaw/gamekit';
import type { PumpkinState } from './engine';
import {
  abort,
  act,
  actionsOf,
  createRun,
  NIGHT_LIMIT,
  recapOf,
  statusOf,
  WIN_CAPTURED,
  WIN_PUMPKINS,
} from './engine';

const GAME_ID = 'shrimp-rampage';
const GAME_VERSION = '4.0.0';

function recapView(state: PumpkinState): RecapView {
  const recap = recapOf(state);
  return {
    title: recap.title,
    outcome: recap.outcome,
    cause: recap.cause || '这一季还没收尾。',
    metrics: recap.metrics,
    timeline: recap.timeline.slice(-10),
    lessons: recap.lessons,
    memoryPrompt: recap.memoryPrompt,
    score: recap.score,
  };
}

export const definition: GameDefinition<PumpkinState> = {
  meta: {
    id: GAME_ID,
    name: '虾闹',
    englishName: 'Shrimp Rampage',
    tagline: '四夜六动作，找怪、安抚、收成',
    description:
      '南瓜田里进了会滚、会跑、会弹、会飞的南瓜怪。你要在天亮前摸进六畦田，靠一次查看换来的种属与情绪决定递糖果、哼小调还是轻拍藤须；同时把南瓜种下去、浇上水、收回来——这些动作全都从同一份体力里扣。第三夜所有南瓜一起暴走，每做一个动作它们就换一次畦。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'new 之后先 act probe:p1 看清田里有什么；没探明情绪就安抚会丢掉契合加成。',
      '安抚用 act soothe:candy:p1 / soothe:song:p1 / soothe:pat:p1；契合看情绪：暴躁吃糖、顽皮听歌、怯生怕拍。',
      '种田是 plant:p1 → water:p1 → harvest:p1，三步各占一个动作；收成给南瓜 + 南瓜籽。',
      'cook 消耗 1 个南瓜换体力上限 +2，是唯一的长期成长；eat-seed / rest 是小额回体力。',
      'rally 一次暴露最多 3 只南瓜怪的位置，但会把它们惊到（躁动 +1）。',
      `第 ${NIGHT_LIMIT} 夜结束时要同时满足收成 ${WIN_PUMPKINS} 与安抚 ${WIN_CAPTURED}；任一条不够都算没守住。`,
      'end-night 提前收工：剩下的动作作废，但体力会带到明晚。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state) as StatusView,
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: recapView,
};
