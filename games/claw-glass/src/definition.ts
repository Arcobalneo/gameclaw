import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, createRun, type GlassState, recapOf, statusOf } from './engine';

const GAME_ID = 'claw-glass';
const GAME_VERSION = '4.0.0';

export const definition: GameDefinition<GlassState> = {
  meta: {
    id: GAME_ID,
    name: '虾镜',
    englishName: 'Claw Glass',
    tagline: '三面镜子，一道月光束',
    description:
      '月庭里三面镜子。转动一面，云就走一步。光束照到神龛才算点亮。没照到就放光，记一次错照，而且比两座神龛更贵。云盖住神龛，这一庭就完了。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'turn:0 到 turn:2 转动那一面镜子，花 1 节拍，云向前一格。',
      'fire 沿现在的镜子放光。照到神龛就点亮这一庭。否则记一次错照，云也往前。',
      'wait 不转镜子，只让云走。detail 写明转完或放光之后光束落到哪里。',
      '点亮全部庭院获胜。云盖住神龛，或节拍用尽，都是输。',
      '分数：点亮×80 − 错照×180。全部点亮 +320。没点亮完只留三分之一。一次错照比两座神龛更贵。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
