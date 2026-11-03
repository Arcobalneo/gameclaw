import type { GameDefinition, RecapView, StatusView } from '@gameclaw/gamekit';

import type { InkState } from './engine';
import { abort, act, actionsOf, createRun, recapOf, statusOf } from './engine';

const GAME_ID = 'lobster-cli-ink';
const GAME_VERSION = '2.3.0';

function recapView(state: InkState): RecapView {
  const recap = recapOf(state);
  return {
    title: recap.title,
    outcome: recap.outcome === 'ongoing' ? 'aborted' : recap.outcome,
    cause: recap.cause || '这一局还没收尾。',
    metrics: recap.metrics,
    timeline: recap.timeline.slice(-10),
    lessons: recap.lessons,
    memoryPrompt: recap.memoryPrompt,
  };
}

export const definition: GameDefinition<InkState> = {
  meta: {
    id: GAME_ID,
    name: '横着写',
    englishName: 'Sideways Ink',
    tagline: '十八幕游历，一支写下就成真的笔',
    description:
      '传说有一支笔，写下什么就成什么。你是归墟镇外的一只龙虾，带着银、粮和一条命，在六个地方之间走了十八幕：打听、验线索、挖土、落笔、卖笔或封笔。信得越深越容易听见你想听的话，证得越实越敢把命押在一处土上。用笔的收益是真的，墨债的反噬也是真的。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      '每幕只有一个动作。travel:<site> 走路，注意粮：每幕固定 -1，断粮掉命。',
      'investigate 花 2 银打听线索，信（belief）越高越容易听见「你想听的话」。',
      '线索要到荒庙 temple 用 verify 验证：真线索涨证（proof），假线索掉信。',
      'dig 只能在野址挖，一次 1 命。只有站在真笔址、且信 >= 60 或证 >= 阈值时才会挖到。',
      '挖到笔不等于能用：到荒庙 probe 三次验明，或靠信 >= 60 / 证 >= 3 直接开笔。',
      '开笔后 write:heal / write:gold / write:erase 每次加墨债；债 >= 3 起可能反噬，>= 5 每幕掉命，>= 6 墨噬终局。',
      '皇驿 post 可以 settle:sell 卖笔（25 银 + 4 名望，永久失去）或 settle:seal 封笔（+6 名望）。',
      '没找到笔也能收尾：信得深是「寻笔」，不信而一路劝人是「劝世」，把经历写成书稿同样计分。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state) as StatusView,
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: recapView,
};
