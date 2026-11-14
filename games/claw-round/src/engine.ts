/**
 * 虾循 / Claw Round.
 *
 * Six beats, then the tide rewinds the pier. You may pocket one item and
 * keep it. The gate wants two public items. A wrong pocket spends the loop.
 */

import {
  type ActionResult,
  type ActionView,
  illegalAction,
  Rng,
  type StatusView,
} from '@gameclaw/gamekit';
import { ITEM_LABEL, ITEMS, type Item } from './content';

export type Outcome = 'ongoing' | 'won' | 'lost' | 'aborted';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface RoundState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  spots: (Item | null)[];
  pos: number;
  held: Item | null;
  pocket: Item[];
  wrong: number;
  beat: number;
  beats: number;
  loop: number;
  loops: number;
  need: Item[];
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): { loops: number; beats: number } {
  if (difficulty === 'easy') return { loops: 4, beats: 7 };
  if (difficulty === 'hard') return { loops: 3, beats: 5 };
  return { loops: 3, beats: 6 };
}

function note(state: RoundState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

function hasNeed(state: RoundState): boolean {
  return state.need.every((item) => state.pocket.includes(item));
}

export function suggest(state: RoundState): string {
  const want = state.need.find((item) => !state.pocket.includes(item));
  if (!want) return 'step:e';
  if (state.held === want) return 'pocket';
  if (state.held) return 'drop';
  const at = state.spots.indexOf(want);
  if (at < 0) return 'step:e';
  if (state.pos < at) return 'step:e';
  if (state.pos > at) return 'step:w';
  return 'grab';
}

export function createRun(options: { seed: number; difficulty?: string }): RoundState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  const spots = rng.shuffle([...ITEMS]) as Item[];
  return {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    spots,
    pos: 0,
    held: null,
    pocket: [],
    wrong: 0,
    beat: 0,
    beats: rule.beats,
    loop: 1,
    loops: rule.loops,
    need: rng.sample(spots, 2),
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '潮环进行中',
  };
}

function rewind(state: RoundState, log: string[]): void {
  if (state.held) {
    if (state.spots[state.pos] === null) state.spots[state.pos] = state.held;
    state.held = null;
  }
  state.pos = 0;
  state.beat = 0;
  const line = `潮退了。口袋里是${state.pocket.map((item) => ITEM_LABEL[item]).join(' · ') || '空的'}。`;
  log.push(line);
  note(state, line);
  state.timeline.push(line);
  if (hasNeed(state)) {
    state.outcome = 'won';
    state.cause = '两件都在';
    log.push(`潮环结束：${state.cause}`);
    return;
  }
  state.loop += 1;
  if (state.loop > state.loops) {
    state.outcome = 'lost';
    state.cause = '潮走完了';
    log.push(`潮环结束：${state.cause}`);
  }
}

export function statusOf(state: RoundState): StatusView {
  const ended = state.outcome !== 'ongoing';
  const here = state.spots[state.pos];
  return {
    headline: ended
      ? `潮环结束 · ${state.cause}`
      : `第 ${state.loop}/${state.loops} 潮 · 第 ${state.beat}/${state.beats} 拍 · 位 ${state.pos + 1}`,
    phase: ended ? '收尾' : '潮环',
    outcome: state.outcome,
    turn: state.loop,
    metrics: [
      { label: '潮', value: `${state.loop}/${state.loops}` },
      { label: '拍', value: `${state.beat}/${state.beats}` },
      { label: '位置', value: state.pos + 1 },
      { label: '错袋', value: state.wrong },
    ],
    sections: [
      { title: '要带', lines: [state.need.map((item) => ITEM_LABEL[item]).join(' · ')] },
      {
        title: '手里',
        lines: [
          state.held ? ITEM_LABEL[state.held] : '空手',
          `口袋 ${state.pocket.map((item) => ITEM_LABEL[item]).join(' · ') || '空'}`,
        ],
      },
      {
        title: '桥上',
        lines: state.spots.map(
          (item, index) => `第 ${index + 1} 格 ${item ? ITEM_LABEL[item] : '空'}`,
        ),
      },
      { title: '脚下', lines: [here ? ITEM_LABEL[here] : '空'] },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['潮还没退'] },
    ],
  };
}

export function actionsOf(state: RoundState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const actions: ActionView[] = [];
  if (state.pos < state.spots.length - 1) {
    actions.push({ id: 'step:e', label: '向前', detail: '往桥尾走一格。', risk: 'low' });
  }
  if (state.pos > 0) {
    actions.push({ id: 'step:w', label: '退后', detail: '往桥头走一格。', risk: 'low' });
  }
  if (state.spots[state.pos] && !state.held) {
    actions.push({
      id: 'grab',
      label: '拿起',
      detail: `拿起${ITEM_LABEL[state.spots[state.pos] ?? 'ticket']}。还没入袋，潮退会冲走。`,
      risk: 'low',
    });
  }
  if (state.held) {
    const useful = state.need.includes(state.held);
    actions.push({
      id: 'pocket',
      label: '入袋',
      detail: useful
        ? '这件是闸门要的，入袋后潮退也留得住。'
        : '这件不是闸门要的。入袋会浪费这一潮。',
      risk: useful ? 'low' : 'high',
    });
    if (state.spots[state.pos] === null) {
      actions.push({
        id: 'drop',
        label: '放下',
        detail: '放回脚下。这一潮还能拿别的。',
        risk: 'medium',
      });
    }
  }
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

export function act(state: RoundState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  const listed = actionId === 'step:1' ? 'step:e' : actionId === 'step:-1' ? 'step:w' : actionId;
  if (!actionsOf(state).some((action) => action.id === listed)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  const step = actionId === 'step:1' ? 'step:e' : actionId === 'step:-1' ? 'step:w' : actionId;
  if (step === 'step:e') state.pos += 1;
  else if (step === 'step:w') state.pos -= 1;
  else if (actionId === 'grab') {
    state.held = state.spots[state.pos] ?? null;
    state.spots[state.pos] = null;
    log.push(`拿起${state.held ? ITEM_LABEL[state.held] : '空'}。`);
  } else if (actionId === 'pocket' && state.held) {
    const item = state.held;
    const useful = state.need.includes(item);
    if (!useful) state.wrong += 1;
    state.pocket.push(item);
    state.held = null;
    log.push(useful ? `入袋${ITEM_LABEL[item]}。` : `入袋${ITEM_LABEL[item]}，潮提前退了。`);
    if (hasNeed(state)) {
      state.outcome = 'won';
      state.cause = '两件都在';
      log.push(`潮环结束：${state.cause}`);
    } else if (!useful) {
      rewind(state, log);
    }
  } else if (actionId === 'drop' && state.held) {
    state.spots[state.pos] = state.held;
    log.push(`放下${ITEM_LABEL[state.held]}。`);
    state.held = null;
  }
  if (log.length === 0) log.push(actionId.startsWith('step') ? '走了一格。' : '停了一拍。');
  note(state, log[0] ?? '');
  const rewound = log.some((line) => line.startsWith('潮退了'));
  if (state.outcome === 'ongoing' && !rewound) {
    state.beat += 1;
    if (state.beat >= state.beats) rewind(state, log);
  }
  state.rng = rng.serialize();
  return { log, events: [{ type: actionId, loop: state.loop, pos: state.pos }] };
}

export function abort(state: RoundState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: RoundState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const got = state.need.filter((item) => state.pocket.includes(item)).length;
  const raw = state.outcome === 'won' ? 460 - (state.loop - 1) * 30 - state.wrong * 60 : got * 40;
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: RoundState) {
  return {
    title: '虾循 · 潮环结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '潮', value: state.loop },
      { label: '错袋', value: state.wrong },
      { label: '口袋', value: state.pocket.length },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['潮还没退过'],
    lessons: [
      `闸门要的是${state.need.map((item) => ITEM_LABEL[item]).join(' · ')}。错袋 ${state.wrong} 次。`,
      '没入袋的东西在潮退时会回到脚下。入袋才留得过潮。',
      `这一局用了 ${state.loop} 潮。拍数不够就够不到桥尾。`,
    ],
    memoryPrompt:
      '把闸门要的两件东西、它们在第几格写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
