import type { GameDefinition, RecapView, StatusView } from '@gameclaw/gamekit';

import type { TinyState } from './engine';
import { abort, act, actionsOf, createRun, recapOf, statusOf } from './engine';

const GAME_ID = 'shrimp-conquest';
const GAME_VERSION = '2.7.0';

function recapView(state: TinyState): RecapView {
  const recap = recapOf(state);
  return {
    title: recap.title,
    outcome: recap.outcome,
    cause: recap.cause,
    metrics: recap.metrics,
    timeline: recap.timeline.slice(-10),
    lessons: recap.lessons,
    memoryPrompt: recap.memoryPrompt,
  };
}

export const definition: GameDefinition<TinyState> = {
  meta: {
    id: GAME_ID,
    name: '虾征',
    englishName: 'Shrimp Conquest',
    tagline: '五十二週，小武器，一場不一定屬於誰的勝利',
    description:
      '小人國的璿芃受國王召令，要在一年內選一個大人國攻陷，戰爭或外交都行。買糧或偷取被當成老鼠吃掉的物資，遇見好人與壞蛋，用火柴、頂針、繡花針與發條設計小體型武器。被發現時進入路線閃躲或時機連擊；失敗會被俘，也可能獲救。鏡面國藏著一個指向自家王城的反轉。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      '先用 target:bastion|harvest|mirror 選大人國；--content mirror 可直接選定鏡面國。',
      '野外行動各花一週與一份糧草。buy 花 3 銀幣回本國買糧；steal 補給較多但會提高暴露與發現率。',
      'scout 取情報與部件，aid 攢善意，earn 賺銀幣；日常會遇到好人或壞蛋，結果寫進 events。',
      'design 進工坊，依次 part:frame / part:head / part:drive，再 assemble。威力太低的武器對大人只是抓癢。',
      'raid 走戰爭，negotiate 走外交；status 公開兩條攻陷門檻，達標後用 conquer:war 或 conquer:pact。',
      '被發現用 respond:flee 或 respond:fight。逃跑選 route 再按預告 dodge；迎戰看游標與出手點，用 strike 連擊或 brace。',
      '小遊戲的時限是狀態內的決策拍數，不讀真實時鐘；非交互 agent 與 seed 回放使用相同輸入。',
      '被俘後可用 rescue:signal / rescue:ransom / rescue:wait；三次等待失敗才進入俘虜結局。',
      '第五十二週行動後仍未攻陷為逾期。鏡面國的戰爭與外交都會進入鏡國反轉。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state) as StatusView,
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: recapView,
};
