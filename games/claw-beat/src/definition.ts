import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, type BeatState, createRun, recapOf, statusOf } from './engine';

const GAME_ID = 'claw-beat';
const GAME_VERSION = '4.0.0';

export const definition: GameDefinition<BeatState> = {
  meta: {
    id: GAME_ID,
    name: '虾节',
    englishName: 'Claw Beat',
    tagline: '四拍一句。每轮只许改两拍',
    description:
      '一句四拍的短语会留下来。每轮最多改两拍，然后拿它迎上下四下来势。点最多两下而且不能相邻，还得留一个歇。闪吃劈，架也吃劈，点吃停，虚专吃闪。五轮内把对方打到零，气息先尽就输。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'set:拍:点|架|闪|歇 改一句里的一拍。commit 用当前短语迎下四拍来势。',
      '每轮改动次数有限，交锋后清零。不合法的短语不会出现在动作里。',
      '交锋 detail 写明这一句你会受多少、对方掉多少、几下拆招、几下格挡。',
      '来势的前四拍是这一轮，后四拍是下一轮。交锋之后前四拍离开，补上新的四拍。',
      '分数：命中×12 + 拆招×30 + 格挡×10 + 剩余气息×8 − 受击×28。击倒 +420。没击倒只留命中和拆招的三分之一。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
