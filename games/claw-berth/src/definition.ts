import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, type BerthState, createRun, recapOf, statusOf } from './engine';

export const definition: GameDefinition<BerthState> = {
  meta: {
    id: 'claw-berth',
    name: '虾泊',
    englishName: 'Claw Berth',
    tagline: '吃水要进得去，危货不能挨着',
    description:
      '四个泊位水深不同。船的吃水不能超过水深，拖船可以多塞深一档。危货挨在一起算事故。等待让已靠的船继续装货，也让还在港外的船失去耐心。',
    version: '4.0.0',
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'dock:0 到 dock:3 把当前船靠上空泊位，吃水必须不超过水深。',
      'tug:n 花一艘拖船，把只深一档的船塞进去。wait 装卸一拍。',
      'detail 写明会不会和旁边的危货贴在一起。',
      '货装到定额就赢。事故、怒船或潮退还没装满就输。',
      '分数：货×12 + 开航×15 − 怒×40 − 事故×70。装满 +320。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
