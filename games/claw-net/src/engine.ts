/**
 * 虾网 / Claw Net.
 *
 * A 5×4 net. Tears wet a sound knot when two of them touch it, and a wet knot
 * becomes a tear if a tear still touches it. Thread is too short to tie every
 * hole. Haul before the count hits eight.
 */

import {
  type ActionResult,
  type ActionView,
  illegalAction,
  Rng,
  type StatusView,
} from '@gameclaw/gamekit';
import { type Knot, NET_H, NET_W, RIP_AT } from './content';

export type Outcome = 'ongoing' | 'won' | 'lost' | 'aborted';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface NetState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  cells: Knot[];
  night: number;
  nights: number;
  thread: number;
  threadCap: number;
  threadGain: number;
  quota: number;
  basket: number;
  cuts: number;
  spreads: number;
  timeline: string[];
  notes: string[];
  outcome: Outcome;
  cause: string;
}

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): {
  thread: number;
  threadCap: number;
  threadGain: number;
  quota: number;
} {
  if (difficulty === 'easy') return { thread: 14, threadCap: 16, threadGain: 4, quota: 28 };
  if (difficulty === 'hard') return { thread: 10, threadCap: 12, threadGain: 2, quota: 44 };
  return { thread: 12, threadCap: 14, threadGain: 3, quota: 36 };
}

function idx(x: number, y: number): number {
  return y * NET_W + x;
}

function neighbors(x: number, y: number): number[] {
  const found: number[] = [];
  if (x > 0) found.push(idx(x - 1, y));
  if (x + 1 < NET_W) found.push(idx(x + 1, y));
  if (y > 0) found.push(idx(x, y - 1));
  if (y + 1 < NET_H) found.push(idx(x, y + 1));
  return found;
}

export function countKind(cells: readonly Knot[], kind: Knot): number {
  let n = 0;
  for (const cell of cells) if (cell === kind) n += 1;
  return n;
}

function tornTouching(cells: readonly Knot[], index: number): number {
  const x = index % NET_W;
  const y = Math.floor(index / NET_W);
  let n = 0;
  for (const ni of neighbors(x, y)) if (cells[ni] === 'torn') n += 1;
  return n;
}

export function pulse(cells: readonly Knot[]): { cells: Knot[]; spreads: number } {
  const next = cells.slice();
  let spreads = 0;
  for (let i = 0; i < cells.length; i += 1) {
    const torn = tornTouching(cells, i);
    const cell = cells[i];
    if (cell === 'tied' && torn >= 2) {
      next[i] = 'wet';
      spreads += 1;
    } else if (cell === 'wet' && torn >= 1) {
      next[i] = 'torn';
      spreads += 1;
    } else if (cell === 'wet' && torn === 0) {
      next[i] = 'tied';
    }
  }
  return { cells: next, spreads };
}

export function fishOf(cells: readonly Knot[]): number {
  return Math.max(0, countKind(cells, 'tied') - countKind(cells, 'torn') * 2);
}

function note(state: NetState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

export function createRun(options: { seed: number; difficulty?: string }): NetState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  const cells: Knot[] = Array.from({ length: NET_W * NET_H }, () => 'tied');
  for (const index of rng.sample(
    cells.map((_, i) => i),
    3,
  ))
    cells[index] = 'torn';
  return {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    cells,
    night: 1,
    nights: 4,
    thread: rule.thread,
    threadCap: rule.threadCap,
    threadGain: rule.threadGain,
    quota: rule.quota,
    basket: 0,
    cuts: 0,
    spreads: 0,
    timeline: [],
    notes: [],
    outcome: 'ongoing',
    cause: '补网进行中',
  };
}

function rip(state: NetState, log: string[]): void {
  state.outcome = 'lost';
  state.cause = '网破了';
  log.push('收网结束：网破了');
}

function openTears(state: NetState, rng: Rng, log: string[]): void {
  const tied = state.cells
    .map((cell, index) => (cell === 'tied' ? index : -1))
    .filter((index) => index >= 0);
  if (tied.length < 2) {
    rip(state, log);
    return;
  }
  for (const index of rng.sample(tied, 2)) state.cells[index] = 'torn';
  if (countKind(state.cells, 'torn') >= RIP_AT) rip(state, log);
}

export function suggest(state: NetState): string {
  if (state.outcome !== 'ongoing') return 'haul';
  let bestId = 'haul';
  let bestTorn = countKind(state.cells, 'torn');
  let bestSaved = -1;
  if (state.thread <= 0) return 'haul';
  for (let i = 0; i < state.cells.length; i += 1) {
    const cell = state.cells[i];
    if (cell !== 'torn' && cell !== 'wet') continue;
    const next = state.cells.slice();
    next[i] = 'tied';
    const pulsed = pulse(next);
    const torn = countKind(pulsed.cells, 'torn');
    if (torn >= RIP_AT) continue;
    const x = i % NET_W;
    const y = Math.floor(i / NET_W);
    let saved = 0;
    for (const ni of neighbors(x, y)) {
      if (state.cells[ni] === 'tied' && tornTouching(state.cells, ni) >= 2) saved += 1;
    }
    if (cell === 'wet') saved += 2;
    if (torn < bestTorn || (torn === bestTorn && saved > bestSaved)) {
      bestTorn = torn;
      bestSaved = saved;
      bestId = `tie:${x}:${y}`;
    }
  }
  if (bestId === 'haul' && fishOf(state.cells) === 0 && state.thread > 0) {
    const wet = state.cells.findIndex((cell) => cell === 'wet' || cell === 'torn');
    if (wet >= 0) return `tie:${wet % NET_W}:${Math.floor(wet / NET_W)}`;
  }
  return bestId;
}

export function statusOf(state: NetState): StatusView {
  const ended = state.outcome !== 'ongoing';
  return {
    headline: ended
      ? `收网结束 · ${state.cause}`
      : `第 ${state.night}/${state.nights} 夜 · 鱼 ${state.basket}/${state.quota} · 线 ${state.thread}`,
    phase: ended ? '收尾' : '补网',
    outcome: state.outcome,
    turn: state.night,
    metrics: [
      { label: '鱼', value: `${state.basket}/${state.quota}` },
      { label: '线', value: state.thread },
      { label: '夜', value: `${state.night}/${state.nights}` },
      { label: '破洞', value: countKind(state.cells, 'torn') },
      { label: '湿结', value: countKind(state.cells, 'wet') },
      { label: '剪口', value: state.cuts },
    ],
    sections: [
      {
        title: '网面',
        lines: [
          `完好 ${countKind(state.cells, 'tied')}`,
          `湿结 ${countKind(state.cells, 'wet')}`,
          `破洞 ${countKind(state.cells, 'torn')}`,
          `缺口 ${countKind(state.cells, 'gap')}`,
          `这一网大约 ${fishOf(state.cells)} 条`,
        ],
      },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['网刚撒下'] },
    ],
  };
}

function savedBy(state: NetState, index: number): number {
  const x = index % NET_W;
  const y = Math.floor(index / NET_W);
  let saved = 0;
  for (const ni of neighbors(x, y)) {
    if (state.cells[ni] === 'tied' && tornTouching(state.cells, ni) >= 2) saved += 1;
  }
  return saved;
}

export function actionsOf(state: NetState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const actions: ActionView[] = [
    {
      id: 'haul',
      label: '收网',
      detail: `现在收网，约 ${fishOf(state.cells)} 条鱼。破洞 ${countKind(state.cells, 'torn')}，湿结 ${countKind(state.cells, 'wet')}。`,
      risk: countKind(state.cells, 'torn') >= 4 ? 'high' : 'medium',
    },
  ];
  for (let y = 0; y < NET_H; y += 1) {
    for (let x = 0; x < NET_W; x += 1) {
      const cell = state.cells[idx(x, y)];
      if ((cell === 'torn' || cell === 'wet') && state.thread > 0) {
        actions.push({
          id: `tie:${x}:${y}`,
          label: `补 ${x + 1}-${y + 1}`,
          detail: `补上这结。可稳住 ${savedBy(state, idx(x, y))} 处即将变湿的邻居。`,
          risk: 'low',
          cost: '1 线',
        });
      }
      if (cell === 'tied') {
        actions.push({
          id: `cut:${x}:${y}`,
          label: `剪 ${x + 1}-${y + 1}`,
          detail: '剪掉这结。裂口不再从这里蔓延，这格以后没有鱼。',
          risk: 'high',
        });
      }
    }
  }
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

function applyPulse(state: NetState): number {
  const pulsed = pulse(state.cells);
  state.cells = pulsed.cells;
  state.spreads += pulsed.spreads;
  return countKind(state.cells, 'torn');
}

export function act(state: NetState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  const events: ActionResult['events'] = [];

  if (actionId === 'haul') {
    const fish = fishOf(state.cells);
    state.basket += fish;
    const line = `第 ${state.night} 夜收网，鱼 ${fish}。累计 ${state.basket}。`;
    log.push(line);
    note(state, line);
    state.timeline.push(line);
    events.push({ type: 'haul', night: state.night, fish, basket: state.basket });
    if (state.night >= state.nights) {
      if (state.basket >= state.quota) {
        state.outcome = 'won';
        state.cause = '鱼够了';
      } else {
        state.outcome = 'lost';
        state.cause = '鱼不够';
      }
      log.push(`收网结束：${state.cause}`);
    } else {
      state.night += 1;
      state.thread = Math.min(state.threadCap, state.thread + state.threadGain);
      openTears(state, rng, log);
    }
    state.rng = rng.serialize();
    return { log, events };
  }

  const tie = /^tie:(\d):(\d)$/.exec(actionId);
  const cut = /^cut:(\d):(\d)$/.exec(actionId);
  const x = Number((tie ?? cut)?.[1] ?? -1);
  const y = Number((tie ?? cut)?.[2] ?? -1);
  const index = idx(x, y);
  if (tie) {
    state.thread -= 1;
    state.cells[index] = 'tied';
    const torn = applyPulse(state);
    const line = `补上 ${x + 1}-${y + 1}。线剩余 ${state.thread}。蔓延后破洞 ${torn}。`;
    log.push(line);
    note(state, line);
    events.push({ type: 'tie', x, y, torn, thread: state.thread });
    if (torn >= RIP_AT) rip(state, log);
  } else {
    state.cells[index] = 'gap';
    state.cuts += 1;
    const torn = applyPulse(state);
    const line = `剪开 ${x + 1}-${y + 1}。蔓延后破洞 ${torn}。`;
    log.push(line);
    note(state, line);
    events.push({ type: 'cut', x, y, torn });
    if (torn >= RIP_AT) rip(state, log);
  }
  state.rng = rng.serialize();
  return { log, events };
}

export function abort(state: NetState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: NetState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const body = state.basket * 12 + state.thread * 6 - state.cuts * 18;
  const raw = state.outcome === 'won' ? body + 340 : state.basket * 4;
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: NetState) {
  return {
    title: '虾网 · 收网结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '鱼', value: state.basket },
      { label: '线', value: state.thread },
      { label: '剪口', value: state.cuts },
      { label: '蔓延', value: state.spreads },
      { label: '夜', value: state.night },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有收网'],
    lessons: [
      `本局鱼 ${state.basket}，目标 ${state.quota}。剪了 ${state.cuts} 处，蔓延 ${state.spreads} 次。`,
      '两个破洞挨着的完好结会变湿。湿结再挨着破洞就会裂开。湿结旁边没有破洞时会干回去。',
      `线从 ${state.thread} 剩到现在。破洞到 ${RIP_AT} 张网就破。`,
    ],
    memoryPrompt:
      '把本局哪几夜在破洞变多前收的网、剪了几处、线够不够写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
