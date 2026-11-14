/**
 * 虾罩 / Claw Mask.
 *
 * Two layers share one shoal. A three-cell window shows the ink layer.
 * Everywhere else shows the tide layer. Step on whichever layer is showing.
 * The tide climbs if you take too long.
 */

import {
  type ActionResult,
  type ActionView,
  illegalAction,
  Rng,
  type StatusView,
} from '@gameclaw/gamekit';

export type Outcome = 'ongoing' | 'won' | 'lost' | 'aborted';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Cell = 'walk' | 'gap';

export interface MaskState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  corridor: number;
  corridors: number;
  ink: Cell[];
  tide: Cell[];
  mask: number;
  pos: number;
  flood: number;
  ticks: number;
  slides: number;
  falls: number;
  fallLimit: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

const WIDTH = 3;
const LENGTH = 8;

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): { corridors: number; fallLimit: number } {
  if (difficulty === 'easy') return { corridors: 3, fallLimit: 4 };
  if (difficulty === 'hard') return { corridors: 5, fallLimit: 2 };
  return { corridors: 4, fallLimit: 3 };
}

function makeCorridor(rng: Rng): { ink: Cell[]; tide: Cell[] } {
  const ink: Cell[] = [];
  const tide: Cell[] = [];
  const inverted = new Set(rng.sample([2, 3, 4, 5, 6], 2));
  for (let i = 0; i < LENGTH; i += 1) {
    if (inverted.has(i)) {
      ink.push('gap');
      tide.push('walk');
    } else {
      ink.push('walk');
      tide.push('gap');
    }
  }
  return { ink, tide };
}

export function covered(mask: number, index: number): boolean {
  return index >= mask && index < mask + WIDTH;
}

export function visible(state: MaskState, index: number): Cell {
  const layer = covered(state.mask, index) ? state.ink : state.tide;
  return layer[index] ?? 'gap';
}

function note(state: MaskState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

function tick(state: MaskState, log: string[]): void {
  state.ticks += 1;
  if (state.ticks % 2 === 0) state.flood += 1;
  if (state.flood >= 0 && state.pos < state.flood) {
    state.falls += 1;
    state.pos = -1;
    state.mask = 0;
    state.flood = -3;
    state.ticks = 0;
    const line = `潮水追上了。回到廊口。坠落 ${state.falls}。`;
    log.push(line);
    note(state, line);
    if (state.falls >= state.fallLimit) {
      state.outcome = 'lost';
      state.cause = '坠落过多';
      log.push(`面罩结束：${state.cause}`);
    }
  }
}

function clearCorridor(state: MaskState, rng: Rng, log: string[]): void {
  const line = `第 ${state.corridor} 廊走完。`;
  log.push(line);
  note(state, line);
  state.timeline.push(line);
  if (state.corridor >= state.corridors) {
    state.outcome = 'won';
    state.cause = '廊走完了';
    log.push(`面罩结束：${state.cause}`);
    return;
  }
  state.corridor += 1;
  const next = makeCorridor(rng);
  state.ink = next.ink;
  state.tide = next.tide;
  state.pos = -1;
  state.mask = 0;
  state.flood = -3;
  state.ticks = 0;
}

function apply(state: MaskState, actionId: string, rng: Rng | null, log: string[]): void {
  if (actionId === 'mask:+1' || actionId === 'mask:-1') {
    state.mask += actionId === 'mask:+1' ? 1 : -1;
    state.slides += 1;
    const line = `面罩移到 ${state.mask + 1}。`;
    log.push(line);
    note(state, line);
    tick(state, log);
    return;
  }
  const dest = state.pos + 1;
  if (visible(state, dest) === 'walk') {
    state.pos = dest;
    const line = `迈到第 ${state.pos + 1} 格。`;
    log.push(line);
    note(state, line);
    if (state.pos >= LENGTH - 1) {
      if (rng) clearCorridor(state, rng, log);
      else {
        state.outcome = 'won';
        state.cause = '廊走完了';
      }
      return;
    }
  } else {
    state.falls += 1;
    state.pos = -1;
    state.mask = 0;
    state.flood = -3;
    state.ticks = 0;
    const line = `踩空，回到廊口。坠落 ${state.falls}。`;
    log.push(line);
    note(state, line);
    if (state.falls >= state.fallLimit) {
      state.outcome = 'lost';
      state.cause = '坠落过多';
      log.push(`面罩结束：${state.cause}`);
    }
    return;
  }
  tick(state, log);
}

function clone(state: MaskState): MaskState {
  return structuredClone(state);
}

export function suggest(state: MaskState): string {
  const options = ['step', 'mask:+1', 'mask:-1'];
  let best = 'step';
  let bestScore = -Infinity;
  const scoreOf = (next: MaskState): number => {
    if (next.outcome === 'lost') return -1_000 + next.pos;
    if (next.cause === '廊走完了' && next.corridor !== state.corridor) return 500;
    if (next.outcome === 'won') return 800;
    return next.pos * 20 - next.flood * 8 - next.falls * 40;
  };
  const visit = (current: MaskState, depth: number, first: string): void => {
    const value = scoreOf(current);
    if (depth === 0 || current.outcome !== 'ongoing') {
      if (value > bestScore) {
        bestScore = value;
        best = first;
      }
      return;
    }
    for (const id of options) {
      if (id === 'mask:+1' && current.mask >= LENGTH - WIDTH) continue;
      if (id === 'mask:-1' && current.mask <= 0) continue;
      const next = clone(current);
      apply(next, id, null, []);
      visit(next, depth - 1, first);
    }
  };
  for (const id of options) {
    if (id === 'mask:+1' && state.mask >= LENGTH - WIDTH) continue;
    if (id === 'mask:-1' && state.mask <= 0) continue;
    const next = clone(state);
    apply(next, id, null, []);
    visit(next, 4, id);
  }
  return best;
}

export function createRun(options: { seed: number; difficulty?: string }): MaskState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  const first = makeCorridor(rng);
  return {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    corridor: 1,
    corridors: rule.corridors,
    ink: first.ink,
    tide: first.tide,
    mask: 0,
    pos: -1,
    flood: -3,
    ticks: 0,
    slides: 0,
    falls: 0,
    fallLimit: rule.fallLimit,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '面罩进行中',
  };
}

function layerWord(cell: Cell): string {
  return cell === 'walk' ? '可走' : '空';
}

export function statusOf(state: MaskState): StatusView {
  const ended = state.outcome !== 'ongoing';
  const next = state.pos + 1;
  return {
    headline: ended
      ? `面罩结束 · ${state.cause}`
      : `第 ${state.corridor}/${state.corridors} 廊 · 面罩 ${state.mask + 1} · 潮 ${state.flood}`,
    phase: ended ? '收尾' : '面罩',
    outcome: state.outcome,
    turn: state.corridor,
    metrics: [
      { label: '廊', value: `${state.corridor}/${state.corridors}` },
      { label: '位置', value: state.pos + 1 },
      { label: '面罩', value: state.mask + 1 },
      { label: '潮', value: state.flood },
      { label: '滑移', value: state.slides },
      { label: '坠落', value: `${state.falls}/${state.fallLimit}` },
    ],
    sections: [
      {
        title: '下一格',
        lines: [
          next < LENGTH
            ? `第 ${next + 1} 格现在是${layerWord(visible(state, next))}`
            : '这廊已经走完',
        ],
      },
      {
        title: '两层',
        lines: [
          `墨 ${state.ink.map((cell) => (cell === 'walk' ? '走' : '空')).join(' · ')}`,
          `潮 ${state.tide.map((cell) => (cell === 'walk' ? '走' : '空')).join(' · ')}`,
        ],
      },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['面罩还在廊口'] },
    ],
  };
}

export function actionsOf(state: MaskState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const next = state.pos + 1;
  const cell = next < LENGTH ? visible(state, next) : 'walk';
  const actions: ActionView[] = [
    {
      id: 'step',
      label: '迈步',
      detail: cell === 'walk' ? '下一格现在可走。' : '下一格现在是空的，迈步会掉回去。',
      risk: cell === 'walk' ? 'low' : 'high',
    },
  ];
  if (state.mask < LENGTH - WIDTH) {
    actions.push({
      id: 'mask:+1',
      label: '罩右移',
      detail: `面罩盖住第 ${state.mask + 2} 到 ${state.mask + 4} 格。盖住的地方看墨层。`,
      risk: 'medium',
    });
  }
  if (state.mask > 0) {
    actions.push({
      id: 'mask:-1',
      label: '罩左移',
      detail: `面罩盖住第 ${state.mask} 到 ${state.mask + 2} 格。盖住的地方看墨层。`,
      risk: 'medium',
    });
  }
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

export function act(state: MaskState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  apply(state, actionId, rng, log);
  state.rng = rng.serialize();
  return {
    log,
    events: [{ type: actionId === 'step' ? 'step' : 'slide', pos: state.pos, mask: state.mask }],
  };
}

export function abort(state: MaskState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: MaskState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const cleared = state.outcome === 'won' ? state.corridors : state.corridor - 1;
  const body = cleared * 90 - state.slides * 4 - state.falls * 75;
  const raw = state.outcome === 'won' ? body + 360 : Math.max(0, cleared * 35);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: MaskState) {
  const cleared = state.outcome === 'won' ? state.corridors : Math.max(0, state.corridor - 1);
  return {
    title: '虾罩 · 面罩结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '廊', value: cleared },
      { label: '滑移', value: state.slides },
      { label: '坠落', value: state.falls },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有走完一廊'],
    lessons: [
      `本局走完 ${cleared} 廊，滑了 ${state.slides} 次，坠落 ${state.falls}。`,
      '面罩盖住的三格看墨层，其余看潮层。要走的那格必须是可走的那一层。',
      '每两步潮往前一格。在廊口磨蹭，潮会先到。',
    ],
    memoryPrompt:
      '把本局面罩该往哪边滑、哪一格必须露在罩外写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
