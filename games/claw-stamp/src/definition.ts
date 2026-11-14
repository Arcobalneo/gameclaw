import type { GameDefinition } from '@gameclaw/gamekit';
import { abort, act, actionsOf, createRun, recapOf, type StampState, statusOf } from './engine';

const GAME_ID = 'claw-stamp';
const GAME_VERSION = '4.0.0';

export const definition: GameDefinition<StampState> = {
  meta: {
    id: GAME_ID,
    name: '虾印',
    englishName: 'Claw Stamp',
    tagline: '十二张夜渡。擦边的船资更高，记过也更贵',
    description:
      '夜渡窗口一次只看一位旅客。合法就盖，禁行就拒。擦边船资更高，盖下去记过并打断连段；特赦免船资，细看花耐心才能把擦边改成合法。放行够数才开船，记过满了就收班。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'stamp 盖章，refuse 拒签。edge 且还有特赦时才有 pardon。耐心至少 2 才有 listen。',
      'detail 写明这一下的船资、记过和连段。擦边盖章会计过。禁行盖章和合法拒签都是误判。',
      'listen 花 2 耐心。只有擦边会改成合法，人还在窗口，之后仍要盖章。',
      '放行达到目标且记过未满才算开船。记过满或耐心用尽会输。',
      '分数：船资×12 + 拦截×35 + 最好连段×22 − 记过×80 − 误判×40。开船 +420 再加剩余耐心×8。没开船只留三分之一。中止为 0。',
    ],
  },
  create: (options) => createRun(options),
  status: (state) => statusOf(state),
  actions: (state) => actionsOf(state),
  act: (state, actionId) => act(state, actionId),
  abort: (state) => abort(state),
  recap: (state) => recapOf(state),
};
