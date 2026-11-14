/**
 * 虾熔 / Claw Melt.
 *
 * Drop a shell into a six-wide well. Shells of the same size melt only when
 * they sit side by side, then fall. A stack in one column does not melt.
 * Every few drops the tide slides each top shell one step toward the shorter
 * side. Filling a column plugs the mouth. A tall edge spills.
 */

import {
  type ActionResult,
  type ActionView,
  illegalAction,
  Rng,
  type StatusView,
} from '@gameclaw/gamekit';
import { SHELL, WELL_H, WELL_W } from './content';

export type Outcome = 'ongoing' | 'won' | 'lost' | 'aborted';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface MeltDrop {
  col: number;
  chain: number;
  spill: number;
  tilted: boolean;
}

export interface MeltState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  cells: number[];
  piece: number;
  next: number;
  drops: number;
  dropCap: number;
  winSize: number;
  tiltEvery: number;
  tiltDir: -1 | 1;
  points: number;
  merges: number;
  bestChain: number;
  maxSize: number;
  spilled: number;
  last: MeltDrop | null;
  timeline: string[];
  notes: string[];
  outcome: Outcome;
  cause: string;
}

interface Resolved {
  merges: number;
  chain: number;
  points: number;
  maxSize: number;
}

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): { dropCap: number; winSize: number; tiltEvery: number } {
  if (difficulty === 'easy') return { dropCap: 12, winSize: 5, tiltEvery: 5 };
  if (difficulty === 'hard') return { dropCap: 18, winSize: 6, tiltEvery: 3 };
  return { dropCap: 16, winSize: 6, tiltEvery: 4 };
}

function rollPiece(rng: Rng): number {
  const n = rng.int(1, 10);
  if (n <= 5) return 1;
  if (n <= 8) return 2;
  return 3;
}

function at(x: number, y: number): number {
  return y * WELL_W + x;
}

export function columnHeight(cells: readonly number[], x: number): number {
  let height = 0;
  for (let y = 0; y < WELL_H; y += 1) if ((cells[at(x, y)] ?? 0) > 0) height += 1;
  return height;
}

function topIndex(cells: readonly number[], x: number): number | null {
  for (let y = 0; y < WELL_H; y += 1) if ((cells[at(x, y)] ?? 0) > 0) return at(x, y);
  return null;
}

export function fall(cells: number[]): void {
  for (let x = 0; x < WELL_W; x += 1) {
    const stack: number[] = [];
    for (let y = WELL_H - 1; y >= 0; y -= 1) {
      const value = cells[at(x, y)] ?? 0;
      if (value > 0) stack.push(value);
    }
    for (let y = 0; y < WELL_H; y += 1) cells[at(x, y)] = 0;
    for (let i = 0; i < stack.length; i += 1) cells[at(x, WELL_H - 1 - i)] = stack[i] ?? 0;
  }
}

function groupsOf(cells: readonly number[]): number[][] {
  const groups: number[][] = [];
  for (let y = 0; y < WELL_H; y += 1) {
    let x = 0;
    while (x < WELL_W) {
      const size = cells[at(x, y)] ?? 0;
      if (size <= 0) {
        x += 1;
        continue;
      }
      let end = x;
      while (end + 1 < WELL_W && (cells[at(end + 1, y)] ?? 0) === size) end += 1;
      if (end > x) {
        const group: number[] = [];
        for (let i = x; i <= end; i += 1) group.push(at(i, y));
        groups.push(group);
      }
      x = end + 1;
    }
  }
  return groups;
}

export function resolve(cells: number[]): Resolved {
  let merges = 0;
  let chain = 0;
  let points = 0;
  let maxSize = 0;
  for (const value of cells) if (value > maxSize) maxSize = value;
  for (let guard = 0; guard < 12; guard += 1) {
    const groups = groupsOf(cells);
    if (!groups.length) break;
    chain += 1;
    const placed: { index: number; size: number }[] = [];
    for (const group of groups) {
      const base = cells[group[0] ?? 0] ?? 0;
      const size = Math.min(7, base + 1);
      let best = group[0] ?? 0;
      for (const index of group) {
        const y = Math.floor(index / WELL_W);
        const x = index % WELL_W;
        const by = Math.floor(best / WELL_W);
        const bx = best % WELL_W;
        if (y > by || (y === by && x < bx)) best = index;
      }
      placed.push({ index: best, size });
      for (const index of group) cells[index] = 0;
      points += size * size * 6;
      merges += 1;
      if (size > maxSize) maxSize = size;
    }
    for (const place of placed) cells[place.index] = place.size;
    fall(cells);
  }
  return { merges, chain, points, maxSize };
}

export function tilt(cells: number[], dir: -1 | 1): number {
  const moves: { from: number; dest: number | null }[] = [];
  for (let x = 0; x < WELL_W; x += 1) {
    const from = topIndex(cells, x);
    if (from === null) continue;
    const height = columnHeight(cells, x);
    const nx = x + dir;
    if (nx < 0 || nx >= WELL_W) {
      if (height >= 3) moves.push({ from, dest: null });
      continue;
    }
    if (columnHeight(cells, nx) <= height) moves.push({ from, dest: nx });
  }
  const incoming: number[][] = Array.from({ length: WELL_W }, () => []);
  let spilled = 0;
  for (const move of moves) {
    const size = cells[move.from] ?? 0;
    cells[move.from] = 0;
    if (move.dest === null) spilled += 1;
    else incoming[move.dest]?.push(size);
  }
  for (let x = 0; x < WELL_W; x += 1) {
    for (const size of incoming[x] ?? []) {
      let placed = false;
      for (let y = 0; y < WELL_H; y += 1) {
        if ((cells[at(x, y)] ?? 0) === 0) {
          cells[at(x, y)] = size;
          placed = true;
          break;
        }
      }
      if (!placed) spilled += 1;
    }
  }
  fall(cells);
  return spilled;
}

function scanMax(cells: readonly number[]): number {
  let max = 0;
  for (const value of cells) if (value > max) max = value;
  return max;
}

function openColumns(cells: readonly number[]): number[] {
  const cols: number[] = [];
  for (let x = 0; x < WELL_W; x += 1) if (columnHeight(cells, x) < WELL_H) cols.push(x);
  return cols;
}

export interface DropPreview {
  col: number;
  chain: number;
  spill: number;
  maxSize: number;
  points: number;
  height: number;
  tilted: boolean;
}

export function previewDrop(state: MeltState, col: number): DropPreview | null {
  if (columnHeight(state.cells, col) >= WELL_H) return null;
  const cells = state.cells.slice();
  for (let y = WELL_H - 1; y >= 0; y -= 1) {
    if ((cells[at(col, y)] ?? 0) === 0) {
      cells[at(col, y)] = state.piece;
      break;
    }
  }
  let resolved = resolve(cells);
  let spill = 0;
  const tilted = (state.drops + 1) % state.tiltEvery === 0;
  if (tilted) {
    spill = tilt(cells, state.tiltDir);
    const extra = resolve(cells);
    resolved = {
      merges: resolved.merges + extra.merges,
      chain: Math.max(resolved.chain, extra.chain),
      points: resolved.points + extra.points,
      maxSize: Math.max(resolved.maxSize, extra.maxSize, scanMax(cells)),
    };
  }
  let height = 0;
  for (let x = 0; x < WELL_W; x += 1) height = Math.max(height, columnHeight(cells, x));
  return {
    col,
    chain: resolved.chain,
    spill,
    maxSize: Math.max(resolved.maxSize, scanMax(cells)),
    points: resolved.points,
    height,
    tilted,
  };
}

function applyPreviewScore(state: MeltState, preview: DropPreview): number {
  if (preview.height >= WELL_H && preview.maxSize < state.winSize) return -5_000 + preview.points;
  if (preview.maxSize >= state.winSize) return 5_000 + preview.points;
  return preview.points * 10 + preview.chain * 20 - preview.spill * 40 - preview.height * 3;
}

export function suggest(state: MeltState): string {
  let best = '';
  let bestScore = -Infinity;
  for (const col of openColumns(state.cells)) {
    const preview = previewDrop(state, col);
    if (!preview) continue;
    const score = applyPreviewScore(state, preview);
    if (score > bestScore) {
      bestScore = score;
      best = `drop:${col}`;
    }
  }
  return best || 'drop:0';
}

function shellName(size: number): string {
  return SHELL[size] ?? '壳';
}

export function createRun(options: { seed: number; difficulty?: string }): MeltState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  const piece = rollPiece(rng);
  const next = rollPiece(rng);
  return {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    cells: Array.from({ length: WELL_W * WELL_H }, () => 0),
    piece,
    next,
    drops: 0,
    dropCap: rule.dropCap,
    winSize: rule.winSize,
    tiltEvery: rule.tiltEvery,
    tiltDir: -1,
    points: 0,
    merges: 0,
    bestChain: 0,
    maxSize: piece,
    spilled: 0,
    last: null,
    timeline: [],
    notes: [],
    outcome: 'ongoing',
    cause: '潮井进行中',
  };
}

export function statusOf(state: MeltState): StatusView {
  const ended = state.outcome !== 'ongoing';
  const until = state.tiltEvery - (state.drops % state.tiltEvery);
  return {
    headline: ended
      ? `潮井结束 · ${state.cause}`
      : `第 ${state.drops}/${state.dropCap} 落 · 最大 ${state.maxSize}/${state.winSize} · 距潮 ${until}`,
    phase: ended ? '收尾' : '落壳',
    outcome: state.outcome,
    turn: state.drops,
    metrics: [
      { label: '落子', value: `${state.drops}/${state.dropCap}` },
      { label: '合成', value: state.merges },
      { label: '连锁', value: state.bestChain },
      { label: '滑出', value: state.spilled },
      { label: '壳分', value: state.points },
      { label: '最大', value: state.maxSize },
    ],
    sections: [
      {
        title: '手里',
        lines: [`这一枚 ${shellName(state.piece)}`, `下一枚 ${shellName(state.next)}`],
      },
      {
        title: '潮向',
        lines: [state.tiltDir < 0 ? '潮向左' : '潮向右', `每 ${state.tiltEvery} 落推一次顶壳`],
      },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['井还是空的'] },
    ],
  };
}

export function actionsOf(state: MeltState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const actions: ActionView[] = [];
  for (const col of openColumns(state.cells)) {
    const preview = previewDrop(state, col);
    if (!preview) continue;
    actions.push({
      id: `drop:${col}`,
      label: `第 ${col + 1} 列`,
      detail: `预览：合成 ${preview.chain} 次，壳分 +${preview.points}，最大 ${preview.maxSize}，滑出 ${preview.spill}。`,
      risk:
        preview.spill > 0 || preview.height >= WELL_H - 1
          ? 'high'
          : preview.chain > 0
            ? 'low'
            : 'medium',
    });
  }
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

function settle(state: MeltState, log: string[]): void {
  const plugged = openColumns(state.cells).length < WELL_W;
  if (state.maxSize >= state.winSize) {
    state.outcome = 'won';
    state.cause = '珠核合成';
  } else if (plugged) {
    state.outcome = 'lost';
    state.cause = '井口堵住了';
  } else if (state.drops >= state.dropCap) {
    state.outcome = 'won';
    state.cause = '撑过潮井';
  }
  if (state.outcome !== 'ongoing') log.push(`潮井结束：${state.cause}`);
}

export function act(state: MeltState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  const match = /^drop:(\d)$/.exec(actionId);
  const col = match ? Number(match[1]) : -1;
  if (!actionsOf(state).some((action) => action.id === actionId) || col < 0) {
    throw illegalAction('这一列落不进去。', '只落在列出的列。');
  }
  const rng = Rng.restore(state.rng);
  const cells = state.cells;
  for (let y = WELL_H - 1; y >= 0; y -= 1) {
    if ((cells[at(col, y)] ?? 0) === 0) {
      cells[at(col, y)] = state.piece;
      break;
    }
  }
  let resolved = resolve(cells);
  let spill = 0;
  const tilted = (state.drops + 1) % state.tiltEvery === 0;
  if (tilted) {
    spill = tilt(cells, state.tiltDir);
    const extra = resolve(cells);
    resolved = {
      merges: resolved.merges + extra.merges,
      chain: Math.max(resolved.chain, extra.chain),
      points: resolved.points + extra.points,
      maxSize: Math.max(resolved.maxSize, extra.maxSize),
    };
    state.tiltDir = state.tiltDir < 0 ? 1 : -1;
  }
  state.drops += 1;
  state.merges += resolved.merges;
  state.points += resolved.points;
  state.spilled += spill;
  if (resolved.chain > state.bestChain) state.bestChain = resolved.chain;
  state.maxSize = Math.max(state.maxSize, resolved.maxSize, scanMax(cells));
  state.last = { col, chain: resolved.chain, spill, tilted };
  const line = `第 ${col + 1} 列落下。合成 ${resolved.chain} 次，最大 ${state.maxSize}，滑出 ${spill}。`;
  const log = [line];
  if (tilted)
    log.push(state.tiltDir < 0 ? '潮汐刚推向右，下一潮向左。' : '潮汐刚推向左，下一潮向右。');
  state.notes.unshift(line);
  state.notes.splice(3);
  state.timeline.push(line);
  if (state.timeline.length > 24) state.timeline.shift();
  const finished = rollPiece(rng);
  state.piece = state.next;
  state.next = finished;
  settle(state, log);
  state.rng = rng.serialize();
  return {
    log,
    events: [{ type: 'drop', col, chain: resolved.chain, spill, tilted, maxSize: state.maxSize }],
  };
}

export function abort(state: MeltState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: MeltState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const body = state.points + state.bestChain * 28 + state.maxSize * 30 - state.spilled * 22;
  const raw = state.outcome === 'won' ? body + 380 : Math.floor(state.points / 3);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: MeltState) {
  return {
    title: '虾熔 · 潮井结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '壳分', value: state.points },
      { label: '合成', value: state.merges },
      { label: '连锁', value: state.bestChain },
      { label: '最大', value: state.maxSize },
      { label: '滑出', value: state.spilled },
      { label: '落子', value: state.drops },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有落壳'],
    lessons: [
      `本局合成 ${state.merges} 次，最好连锁 ${state.bestChain}，最大 ${shellName(state.maxSize)}。`,
      `滑出 ${state.spilled} 枚。左右挨着才会熔，叠在同一列不会。潮把不比邻列矮的顶壳推过去。`,
      `落了 ${state.drops} 次。目标尺寸是 ${state.winSize}，撑过 ${state.dropCap} 落也算过井。`,
    ],
    memoryPrompt:
      '把本局的最大尺寸、最好连锁、滑出次数和潮向写进你自己的 memory。平铺的井也会被潮推走。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
