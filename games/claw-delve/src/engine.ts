/**
 * 虾掘 / Claw Delve.
 *
 * A public shaft. Dig down or sideways. Leaving a layer with no brace
 * collapses it. Braces are fewer than the layers you have to leave.
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

export interface DelveState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  layers: number;
  layer: number;
  col: number;
  oreCol: number[];
  open: boolean[][];
  mined: boolean[];
  braced: boolean[];
  braces: number;
  ore: number;
  quota: number;
  collapses: number;
  collapseLimit: number;
  turn: number;
  turnCap: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): {
  braces: number;
  quota: number;
  collapseLimit: number;
  turnCap: number;
} {
  if (difficulty === 'easy') return { braces: 3, quota: 2, collapseLimit: 2, turnCap: 18 };
  if (difficulty === 'hard') return { braces: 1, quota: 2, collapseLimit: 1, turnCap: 12 };
  return { braces: 2, quota: 3, collapseLimit: 1, turnCap: 16 };
}

function note(state: DelveState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

function settle(state: DelveState, log: string[]): void {
  if (state.turn > state.turnCap) {
    state.outcome = 'lost';
    state.cause = '挖太久';
    log.push(`掘井结束：${state.cause}`);
    return;
  }
  if (state.collapses > state.collapseLimit) {
    state.outcome = 'lost';
    state.cause = '井塌了';
    log.push(`掘井结束：${state.cause}`);
    return;
  }
  if (state.ore >= state.quota) {
    state.outcome = 'won';
    state.cause = '矿够了';
    log.push(`掘井结束：${state.cause}`);
    return;
  }
  const here = state.oreCol[state.layer] ?? -1;
  const more = here >= 0 && !state.mined[state.layer];
  if (state.layer === state.layers - 1 && !more) {
    state.outcome = 'lost';
    state.cause = '矿不够';
    log.push(`掘井结束：${state.cause}`);
  }
}

export function suggest(state: DelveState): string {
  const here = state.oreCol[state.layer] ?? -1;
  if (here >= 0 && !state.mined[state.layer] && here !== state.col) {
    return here > state.col ? 'shift:1' : 'shift:-1';
  }
  const below = state.layer + 1;
  if (below < state.layers) {
    const want = state.oreCol[below] ?? state.col;
    if (want !== state.col) return want > state.col ? 'shift:1' : 'shift:-1';
    if (!state.braced[state.layer] && state.braces > 0) return 'brace';
    return 'cut';
  }
  return 'shift:1';
}

export function createRun(options: { seed: number; difficulty?: string }): DelveState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  const layers = 5;
  const oreCol = [-1];
  for (let i = 1; i < layers; i += 1) oreCol.push(rng.int(0, 2));
  const open = Array.from({ length: layers }, () => [false, false, false]);
  open[0]![1] = true;
  const state: DelveState = {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    layers,
    layer: 0,
    col: 1,
    oreCol,
    open,
    mined: Array.from({ length: layers }, () => false),
    braced: Array.from({ length: layers }, () => false),
    braces: rule.braces,
    ore: 0,
    quota: rule.quota,
    collapses: 0,
    collapseLimit: rule.collapseLimit,
    turn: 0,
    turnCap: rule.turnCap,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '',
  };
  return state;
}

export function statusOf(state: DelveState): StatusView {
  const rows = state.oreCol.map((col, index) => {
    const mark = state.braced[index] ? '撑' : '空';
    const ore = col < 0 ? '无矿' : `矿在 ${col + 1}`;
    return `第 ${index + 1} 层 ${ore} ${mark}`;
  });
  return {
    headline:
      state.outcome === 'ongoing'
        ? `第 ${state.layer + 1}/${state.layers} 层 · 矿 ${state.ore}/${state.quota} · 塌 ${state.collapses}`
        : `掘井结束 · ${state.cause}`,
    phase: state.outcome === 'ongoing' ? '掘井' : '收尾',
    outcome: state.outcome,
    turn: state.turn,
    metrics: [
      { label: '层', value: `${state.layer + 1}/${state.layers}` },
      { label: '矿', value: `${state.ore}/${state.quota}` },
      { label: '撑', value: state.braces },
      { label: '塌', value: `${state.collapses}/${state.collapseLimit}` },
    ],
    sections: [
      { title: '井壁', lines: rows },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['还没下挖'] },
    ],
  };
}

export function actionsOf(state: DelveState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const actions: ActionView[] = [];
  if (state.col > 0) {
    actions.push({
      id: 'shift:-1',
      label: '向左',
      detail: '在这一层向左挖开一格。横挖不会塌。',
      risk: 'low',
    });
  }
  if (state.col < 2) {
    actions.push({
      id: 'shift:1',
      label: '向右',
      detail: '在这一层向右挖开一格。横挖不会塌。',
      risk: 'low',
    });
  }
  if (state.layer + 1 < state.layers) {
    const bare = !state.braced[state.layer];
    actions.push({
      id: 'cut',
      label: '下挖',
      detail: bare ? '离开这一层。没有支撑，井会塌一次。' : '这一层有支撑，下挖不会塌。',
      risk: bare ? 'high' : 'low',
    });
    if (!state.braced[state.layer] && state.braces > 0) {
      actions.push({
        id: 'brace',
        label: '支撑',
        detail: `用一根撑。还剩 ${state.braces} 根。`,
        risk: 'low',
      });
    }
  }
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

function mine(state: DelveState, log: string[]): void {
  const col = state.oreCol[state.layer] ?? -1;
  if (col === state.col && !state.mined[state.layer]) {
    state.mined[state.layer] = true;
    state.ore += 1;
    const line = `挖到矿。矿 ${state.ore}。`;
    log.push(line);
    state.timeline.push(line);
  }
}

export function act(state: DelveState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  state.turn += 1;
  if (actionId === 'brace') {
    state.braced[state.layer] = true;
    state.braces -= 1;
    log.push(`第 ${state.layer + 1} 层撑住了。`);
  } else if (actionId.startsWith('shift:')) {
    const dir = Number(actionId.slice('shift:'.length));
    state.col += dir;
    state.open[state.layer]![state.col] = true;
    log.push(`移到第 ${state.col + 1} 格。`);
    mine(state, log);
  } else {
    const left = state.layer;
    state.layer += 1;
    state.open[state.layer]![state.col] = true;
    log.push(`下到第 ${state.layer + 1} 层。`);
    mine(state, log);
    if (!state.braced[left]) {
      state.collapses += 1;
      const line = `第 ${left + 1} 层塌了。塌 ${state.collapses}。`;
      log.push(line);
      state.timeline.push(line);
    }
  }
  note(state, log[0] ?? '');
  settle(state, log);
  state.rng = rng.serialize();
  return { log, events: [{ type: 'delve', action: actionId, ore: state.ore }] };
}

export function abort(state: DelveState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: DelveState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const body = state.ore * 20 + (state.layer + 1) * 15 - state.collapses * 50;
  const raw = state.outcome === 'won' ? body + 300 : Math.max(0, state.ore * 8);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: DelveState) {
  return {
    title: '虾掘 · 掘井结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '矿', value: state.ore },
      { label: '塌', value: state.collapses },
      { label: '层', value: state.layer + 1 },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有塌方'],
    lessons: [
      `本局矿 ${state.ore}，塌了 ${state.collapses} 次。`,
      '离开没有支撑的一层，井就会塌。横挖不会塌。',
      '一次塌比方比两车矿更贵。撑要留在离开之前。',
    ],
    memoryPrompt:
      '把哪一层的矿在左中右、你在离开前有没有撑写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
