/**
 * 虾算 / Claw Sum.
 *
 * Four pulls. Add, double, or halve until the public target. An exact land
 * clears the stage. Missing the cap is a miss.
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
export type Op = 'add2' | 'add3' | 'double' | 'half';

export interface SumState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  stage: number;
  stages: number;
  value: number;
  target: number;
  pulls: number;
  pullCap: number;
  misses: number;
  missLimit: number;
  exacts: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

const OPS: Op[] = ['add2', 'add3', 'double', 'half'];

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): { stages: number; pullCap: number; missLimit: number } {
  if (difficulty === 'easy') return { stages: 3, pullCap: 7, missLimit: 3 };
  if (difficulty === 'hard') return { stages: 5, pullCap: 5, missLimit: 2 };
  return { stages: 4, pullCap: 6, missLimit: 2 };
}

function note(state: SumState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

export function applyOp(value: number, op: Op): number | null {
  if (op === 'add2') return value + 2;
  if (op === 'add3') return value + 3;
  if (op === 'double') return value * 2;
  if (value % 2 === 0) return value / 2;
  return null;
}

function nextStage(state: SumState, rng: Rng): void {
  state.value = rng.int(2, 6);
  state.target = state.value + rng.int(4, 9);
  state.pulls = 0;
}

function finishStage(state: SumState, rng: Rng, log: string[], exact: boolean): void {
  if (exact) state.exacts += 1;
  else state.misses += 1;
  const line = exact
    ? `第 ${state.stage} 釜正好是 ${state.target}。`
    : `第 ${state.stage} 釜没对准。`;
  log.push(line);
  note(state, line);
  state.timeline.push(line);
  if (!exact && state.misses >= state.missLimit) {
    state.outcome = 'lost';
    state.cause = '没对准';
    log.push(`演算结束：${state.cause}`);
    return;
  }
  if (state.stage >= state.stages) {
    if (state.exacts >= state.stages) {
      state.outcome = 'won';
      state.cause = '釜都对准';
    } else {
      state.outcome = 'lost';
      state.cause = '没对准';
    }
    log.push(`演算结束：${state.cause}`);
    return;
  }
  state.stage += 1;
  nextStage(state, rng);
}

export function suggest(state: SumState): string {
  let best = 'add2';
  let bestScore = -Infinity;
  const pull = (value: number, pulls: number, depth: number): number => {
    if (value === state.target) return 200 - pulls;
    if (pulls >= state.pullCap || depth === 0)
      return value > state.target ? -40 : -Math.abs(state.target - value);
    let local = -Infinity;
    for (const op of OPS) {
      const next = applyOp(value, op);
      if (next === null || next > 40) continue;
      local = Math.max(local, pull(next, pulls + 1, depth - 1));
    }
    return local;
  };
  for (const op of OPS) {
    const next = applyOp(state.value, op);
    if (next === null) continue;
    const score = next === state.target ? 500 : pull(next, state.pulls + 1, 5);
    if (score > bestScore) {
      bestScore = score;
      best = op;
    }
  }
  return best;
}

export function createRun(options: { seed: number; difficulty?: string }): SumState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  const state: SumState = {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    stage: 1,
    stages: rule.stages,
    value: 2,
    target: 8,
    pulls: 0,
    pullCap: rule.pullCap,
    misses: 0,
    missLimit: rule.missLimit,
    exacts: 0,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '演算进行中',
  };
  nextStage(state, rng);
  state.rng = rng.serialize();
  return state;
}

const OP_LABEL: Record<Op, string> = { add2: '加二', add3: '加三', double: '翻倍', half: '对半' };

export function statusOf(state: SumState): StatusView {
  const ended = state.outcome !== 'ongoing';
  return {
    headline: ended
      ? `演算结束 · ${state.cause}`
      : `第 ${state.stage}/${state.stages} 釜 · 现在 ${state.value} · 目标 ${state.target}`,
    phase: ended ? '收尾' : '演算',
    outcome: state.outcome,
    turn: state.stage,
    metrics: [
      { label: '釜', value: `${state.stage}/${state.stages}` },
      { label: '现在', value: state.value },
      { label: '目标', value: state.target },
      { label: '拉杆', value: `${state.pulls}/${state.pullCap}` },
      { label: '对准', value: state.exacts },
      { label: '落空', value: `${state.misses}/${state.missLimit}` },
    ],
    sections: [{ title: '记录', lines: state.notes.length ? [...state.notes] : ['还没拉杆'] }],
  };
}

export function actionsOf(state: SumState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const actions = OPS.filter((op) => applyOp(state.value, op) !== null).map((op) => {
    const next = applyOp(state.value, op) ?? state.value;
    return {
      id: op,
      label: OP_LABEL[op],
      detail: `拉一下变成 ${next}。目标是 ${state.target}。`,
      risk: next === state.target ? 'low' : next > state.target ? 'high' : 'medium',
    } satisfies ActionView;
  });
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

export function act(state: SumState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const next = applyOp(state.value, actionId as Op);
  const log: string[] = [];
  if (next === null) {
    log.push('奇数不能对半。');
  } else {
    state.value = next;
    state.pulls += 1;
    log.push(`现在是 ${state.value}。`);
    if (state.value === state.target) finishStage(state, rng, log, true);
    else if (state.pulls >= state.pullCap) finishStage(state, rng, log, false);
  }
  note(state, log[0] ?? '');
  state.rng = rng.serialize();
  return { log, events: [{ type: 'pull', value: state.value, op: actionId }] };
}

export function abort(state: SumState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: SumState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const raw =
    state.outcome === 'won' ? state.exacts * 80 + 340 - state.misses * 60 : state.exacts * 40;
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: SumState) {
  return {
    title: '虾算 · 演算结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '对准', value: state.exacts },
      { label: '落空', value: state.misses },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有一釜结束'],
    lessons: [
      `本局对准 ${state.exacts} 釜，落空 ${state.misses} 釜。`,
      '加二、加三、翻倍、偶数才能对半。正好等于目标才算对准。',
      '拉杆次数用完还没相等，这一釜算落空。',
    ],
    memoryPrompt:
      '把每釜的起点和目标、你是先加还是先翻倍写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
