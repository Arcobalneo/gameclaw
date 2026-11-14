/**
 * 虾数 / Claw Count.
 *
 * One number decides which planks exist. A run of planks has to share a
 * number, because changes are scarce. A magnet crosses one plank anyway.
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

export interface CountState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  level: number;
  levels: number;
  tiles: number[][];
  pos: number;
  count: number;
  budget: number;
  budgetMax: number;
  magnets: number;
  falls: number;
  fallLimit: number;
  changes: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

const COUNTS = [0, 1, 2, 3] as const;

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): {
  levels: number;
  budget: number;
  magnets: number;
  fallLimit: number;
} {
  if (difficulty === 'easy') return { levels: 3, budget: 5, magnets: 3, fallLimit: 4 };
  if (difficulty === 'hard') return { levels: 5, budget: 2, magnets: 1, fallLimit: 2 };
  return { levels: 4, budget: 3, magnets: 2, fallLimit: 3 };
}

/** One blank plank on the named stages. No number covers it, so only a magnet crosses. */
function orphanOn(level: number, difficulty: Difficulty): boolean {
  if (difficulty === 'easy') return level === 2;
  if (difficulty === 'hard') return level === 3;
  return level === 2 || level === 4;
}

function makePier(rng: Rng, orphan: boolean): number[][] {
  const tiles: number[][] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = rng.int(0, 3);
    let b = rng.int(0, 3);
    if (b === a) b = (a + 1) % 4;
    const safe = a < b ? [a, b] : [b, a];
    tiles.push(safe);
  }
  const first = tiles[0] ?? [0, 1];
  if (!first.includes(0)) tiles[0] = [0, first[0] ?? 1].sort((x, y) => x - y);
  if (orphan) tiles[2 + rng.int(0, 3)] = [];
  return tiles;
}

function note(state: CountState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

function nextTile(state: CountState): number[] | null {
  return state.tiles[state.pos] ?? null;
}

function safe(tile: number[] | null, count: number): boolean {
  return tile?.includes(count) ?? false;
}

function cover(state: CountState, count: number): number {
  let n = 0;
  for (let i = state.pos; i < state.tiles.length; i += 1) {
    if (!(state.tiles[i] ?? []).includes(count)) break;
    n += 1;
  }
  return n;
}

export function suggest(state: CountState): string {
  const tile = nextTile(state);
  if (!tile) return 'step';
  if (tile.length === 0) return state.magnets > 0 ? 'magnet' : 'step';
  if (safe(tile, state.count)) return 'step';
  if (state.budget > 0) {
    let best = tile[0] ?? 0;
    let bestCover = -1;
    for (const count of COUNTS) {
      if (!tile.includes(count)) continue;
      const length = cover(state, count);
      if (length > bestCover) {
        bestCover = length;
        best = count;
      }
    }
    return `set:${best}`;
  }
  if (state.magnets > 0) return 'magnet';
  return 'step';
}

export function createRun(options: { seed: number; difficulty?: string }): CountState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  return {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    level: 1,
    levels: rule.levels,
    tiles: makePier(rng, orphanOn(1, difficulty)),
    pos: 0,
    count: 0,
    budget: rule.budget,
    budgetMax: rule.budget,
    magnets: rule.magnets,
    falls: 0,
    fallLimit: rule.fallLimit,
    changes: 0,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '数桥进行中',
  };
}

function nums(tile: number[] | null): string {
  if (!tile || tile.length === 0) return '空';
  return tile.join('/');
}

export function statusOf(state: CountState): StatusView {
  const ended = state.outcome !== 'ongoing';
  const tile = nextTile(state);
  return {
    headline: ended
      ? `数桥结束 · ${state.cause}`
      : `第 ${state.level}/${state.levels} 段 · 数字 ${state.count} · 改数 ${state.budget}`,
    phase: ended ? '收尾' : '数桥',
    outcome: state.outcome,
    turn: state.level,
    metrics: [
      { label: '段', value: `${state.level}/${state.levels}` },
      { label: '数字', value: state.count },
      { label: '改数', value: state.budget },
      { label: '磁铁', value: state.magnets },
      { label: '坠落', value: `${state.falls}/${state.fallLimit}` },
      { label: '位置', value: `${state.pos}/${state.tiles.length}` },
    ],
    sections: [
      {
        title: '下一块',
        lines: [tile ? `可走数字 ${nums(tile)}` : '这段已经走完'],
      },
      {
        title: '桥面',
        lines: state.tiles.map((item, index) => `第 ${index + 1} 格 ${nums(item)}`),
      },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['还没有迈步'] },
    ],
  };
}

export function actionsOf(state: CountState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const tile = nextTile(state);
  const actions: ActionView[] = [];
  if (tile && state.budget > 0) {
    for (const count of COUNTS) {
      if (count === state.count) continue;
      actions.push({
        id: `set:${count}`,
        label: `设为 ${count}`,
        detail: safe(tile, count)
          ? `把数字设为 ${count}。下一块可走，还能连着走 ${cover(state, count)} 格。`
          : `把数字设为 ${count}。下一块仍然不可走。`,
        risk: safe(tile, count) ? 'low' : 'high',
        cost: '1 改数',
      });
    }
  }
  actions.push({
    id: 'step',
    label: '迈步',
    detail: safe(tile, state.count)
      ? '下一块在这个数字下可走。'
      : '下一块不可走，迈步会坠落回段首。',
    risk: safe(tile, state.count) ? 'low' : 'high',
  });
  if (tile && state.magnets > 0) {
    actions.push({
      id: 'magnet',
      label: '磁铁',
      detail: '花一块磁铁，不管数字，走上这一格。',
      risk: 'medium',
      cost: '1 磁铁',
    });
  }
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

function fall(state: CountState, log: string[]): void {
  state.falls += 1;
  state.pos = 0;
  state.budget = state.budgetMax;
  const line = `坠落，回到段首。坠落 ${state.falls}。`;
  log.push(line);
  note(state, line);
  if (state.falls >= state.fallLimit) {
    state.outcome = 'lost';
    state.cause = '坠落过多';
    log.push(`数桥结束：${state.cause}`);
  }
}

function clearLevel(state: CountState, rng: Rng, log: string[]): void {
  const line = `第 ${state.level} 段走完。`;
  log.push(line);
  note(state, line);
  state.timeline.push(line);
  if (state.level >= state.levels) {
    state.outcome = 'won';
    state.cause = '桥走完了';
    log.push(`数桥结束：${state.cause}`);
    return;
  }
  state.level += 1;
  state.tiles = makePier(rng, orphanOn(state.level, state.difficulty));
  state.pos = 0;
  state.count = 0;
  state.budget = state.budgetMax;
}

export function act(state: CountState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  const tile = nextTile(state);
  if (actionId.startsWith('set:')) {
    state.count = Number(actionId.slice(4));
    state.budget -= 1;
    state.changes += 1;
    const line = `数字改为 ${state.count}。剩余改数 ${state.budget}。`;
    log.push(line);
    note(state, line);
  } else if (actionId === 'magnet') {
    state.magnets -= 1;
    state.pos += 1;
    const line = `磁铁吸住第 ${state.pos} 格。磁铁剩余 ${state.magnets}。`;
    log.push(line);
    note(state, line);
    if (state.pos >= state.tiles.length) clearLevel(state, rng, log);
  } else if (safe(tile, state.count)) {
    state.pos += 1;
    const line = `迈上第 ${state.pos} 格。`;
    log.push(line);
    note(state, line);
    if (state.pos >= state.tiles.length) clearLevel(state, rng, log);
  } else {
    fall(state, log);
  }
  state.rng = rng.serialize();
  return {
    log,
    events: [
      { type: actionId.startsWith('set:') ? 'set' : actionId, count: state.count, pos: state.pos },
    ],
  };
}

export function abort(state: CountState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: CountState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const cleared = state.outcome === 'won' ? state.levels : state.level - 1;
  const body = cleared * 90 + state.magnets * 35 - state.falls * 70 - state.changes * 4;
  const raw = state.outcome === 'won' ? body + 380 : Math.max(0, cleared * 40);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: CountState) {
  const cleared = state.outcome === 'won' ? state.levels : Math.max(0, state.level - 1);
  return {
    title: '虾数 · 数桥结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '段', value: cleared },
      { label: '坠落', value: state.falls },
      { label: '改数', value: state.changes },
      { label: '磁铁', value: state.magnets },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有走完一段'],
    lessons: [
      `本局走完 ${cleared} 段，坠落 ${state.falls}，改了 ${state.changes} 次数字。`,
      '改数不够把每格都换成新数字。要选能连着走最远的那个数字。',
      `磁铁还剩 ${state.magnets}。磁铁能走过一块对不上的板。`,
    ],
    memoryPrompt:
      '把本局哪一段的数字连不上、磁铁用在第几格写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
