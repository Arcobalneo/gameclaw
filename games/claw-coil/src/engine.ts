/**
 * 虾绕 / Claw Coil.
 *
 * The tail follows the head. Push the crate onto the dock. A wall or your
 * own body is a strike and you do not move.
 */

import {
  type ActionResult,
  type ActionView,
  illegalAction,
  Rng,
  type StatusView,
} from '@gameclaw/gamekit';
import { DIR, type Dir, LEVELS } from './content';

export type Outcome = 'ongoing' | 'won' | 'lost' | 'aborted';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface CoilState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  stage: number;
  stages: number;
  preset: number;
  snake: [number, number][];
  crate: [number, number];
  dock: [number, number];
  strikes: number;
  strikeLimit: number;
  seated: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

const WIDTH = 7;
const HEIGHT = 5;

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): { stages: number; strikeLimit: number } {
  if (difficulty === 'easy') return { stages: 2, strikeLimit: 4 };
  if (difficulty === 'hard') return { stages: 3, strikeLimit: 2 };
  return { stages: 3, strikeLimit: 3 };
}

function wall(x: number, y: number): boolean {
  return x <= 0 || y <= 0 || x >= WIDTH - 1 || y >= HEIGHT - 1;
}

function same(a: readonly number[], b: readonly number[]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function note(state: CoilState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

function load(state: CoilState, preset: number): void {
  const level = LEVELS[preset % LEVELS.length] ?? LEVELS[0];
  if (!level) return;
  state.preset = preset % LEVELS.length;
  state.snake = level.snake.map((cell) => [cell[0], cell[1]]);
  state.crate = [level.crate[0], level.crate[1]];
  state.dock = [level.dock[0], level.dock[1]];
}

function signature(snake: [number, number][], crate: [number, number]): string {
  return `${snake.map((cell) => cell.join(',')).join(';')}>${crate.join(',')}`;
}

function stepOf(
  snake: [number, number][],
  crate: [number, number],
  dir: Dir,
): { snake: [number, number][]; crate: [number, number] } | null {
  const step = DIR[dir];
  const head = snake[0] ?? [1, 1];
  const nx = head[0] + (step[0] ?? 0);
  const ny = head[1] + (step[1] ?? 0);
  const blocked = (x: number, y: number, cells: [number, number][]) =>
    wall(x, y) || cells.some((cell) => cell[0] === x && cell[1] === y);
  if (blocked(nx, ny, snake.slice(0, -1))) return null;
  if (crate[0] === nx && crate[1] === ny) {
    const cx = nx + (step[0] ?? 0);
    const cy = ny + (step[1] ?? 0);
    if (blocked(cx, cy, snake)) return null;
    return { snake: [[nx, ny], ...snake.slice(0, -1)], crate: [cx, cy] };
  }
  return { snake: [[nx, ny], ...snake.slice(0, -1)], crate: [crate[0], crate[1]] };
}

export function suggest(state: CoilState): string {
  const startSnake = state.snake.map((cell) => [cell[0], cell[1]] as [number, number]);
  const startCrate: [number, number] = [state.crate[0], state.crate[1]];
  const queue: { snake: [number, number][]; crate: [number, number]; first: Dir | '' }[] = [
    { snake: startSnake, crate: startCrate, first: '' },
  ];
  const seen = new Set<string>();
  let guard = 0;
  while (queue.length && guard < 4000) {
    const node = queue.shift();
    guard += 1;
    if (!node) break;
    const key = signature(node.snake, node.crate);
    if (seen.has(key)) continue;
    seen.add(key);
    if (same(node.crate, state.dock)) return node.first || 'e';
    for (const dir of ['n', 'e', 's', 'w'] as const) {
      const next = stepOf(node.snake, node.crate, dir);
      if (!next) continue;
      queue.push({ snake: next.snake, crate: next.crate, first: node.first || dir });
    }
  }
  const head = state.snake[0] ?? [1, 1];
  for (const dir of ['n', 'e', 's', 'w'] as const) {
    const step = DIR[dir];
    const nx = head[0] + (step[0] ?? 0);
    const ny = head[1] + (step[1] ?? 0);
    if (!wall(nx, ny)) return dir;
  }
  return 'e';
}

export function createRun(options: { seed: number; difficulty?: string }): CoilState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  const state: CoilState = {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    stage: 1,
    stages: rule.stages,
    preset: 0,
    snake: [[1, 1]],
    crate: [2, 1],
    dock: [3, 1],
    strikes: 0,
    strikeLimit: rule.strikeLimit,
    seated: 0,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '绕行进行中',
  };
  load(state, rng.int(0, LEVELS.length - 1));
  return state;
}

function occupy(state: CoilState, x: number, y: number, ignoreTail: boolean): boolean {
  const body = ignoreTail ? state.snake.slice(0, -1) : state.snake;
  return body.some((cell) => cell[0] === x && cell[1] === y);
}

export function statusOf(state: CoilState): StatusView {
  const ended = state.outcome !== 'ongoing';
  const head = state.snake[0] ?? [1, 1];
  return {
    headline: ended
      ? `绕行结束 · ${state.cause}`
      : `第 ${state.stage}/${state.stages} 箱 · 头 ${head[0]},${head[1]} · 撞 ${state.strikes}`,
    phase: ended ? '收尾' : '绕行',
    outcome: state.outcome,
    turn: state.stage,
    metrics: [
      { label: '箱', value: `${state.seated}/${state.stages}` },
      { label: '撞', value: `${state.strikes}/${state.strikeLimit}` },
      { label: '身长', value: state.snake.length },
    ],
    sections: [
      {
        title: '箱',
        lines: [
          `箱在 ${state.crate[0]},${state.crate[1]}`,
          `坞在 ${state.dock[0]},${state.dock[1]}`,
        ],
      },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['还没推动'] },
    ],
  };
}

const DIR_LABEL: Record<Dir, string> = { n: '北', s: '南', e: '东', w: '西' };

export function actionsOf(state: CoilState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const head = state.snake[0] ?? [1, 1];
  const actions = (Object.keys(DIR) as Dir[]).map((dir) => {
    const step = DIR[dir];
    const nx = head[0] + (step[0] ?? 0);
    const ny = head[1] + (step[1] ?? 0);
    const intoWall = wall(nx, ny) || occupy(state, nx, ny, true);
    const pushing = state.crate[0] === nx && state.crate[1] === ny;
    const cx = nx + (step[0] ?? 0);
    const cy = ny + (step[1] ?? 0);
    const crateBlocked = pushing && (wall(cx, cy) || occupy(state, cx, cy, false));
    let detail = `走到 ${nx},${ny}，箱子还在 ${state.crate[0]},${state.crate[1]}。`;
    if (intoWall) detail = '这一步是墙或者自己的身子，会撞上并停住。';
    else if (crateBlocked) detail = `箱子前面的 ${cx},${cy} 被挡住，推上去会撞。`;
    else if (pushing) {
      detail = `把箱子从 ${state.crate[0]},${state.crate[1]} 推到 ${cx},${cy}。`;
    }
    return {
      id: dir,
      label: DIR_LABEL[dir],
      detail,
      risk: intoWall || crateBlocked ? 'high' : pushing ? 'medium' : 'low',
    } satisfies ActionView;
  });
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

function clearStage(state: CoilState, rng: Rng, log: string[]): void {
  state.seated += 1;
  const line = `第 ${state.stage} 箱进坞。`;
  log.push(line);
  note(state, line);
  state.timeline.push(line);
  if (state.stage >= state.stages) {
    state.outcome = 'won';
    state.cause = '箱子都进了';
    log.push(`绕行结束：${state.cause}`);
    return;
  }
  state.stage += 1;
  load(state, (state.preset + 1) % LEVELS.length);
  state.rng = rng.serialize();
}

export function act(state: CoilState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const dir = actionId as Dir;
  const step = DIR[dir];
  const head = state.snake[0] ?? [1, 1];
  const nx = head[0] + (step[0] ?? 0);
  const ny = head[1] + (step[1] ?? 0);
  const log: string[] = [];
  if (wall(nx, ny) || occupy(state, nx, ny, true)) {
    state.strikes += 1;
    const line = `撞上了。撞 ${state.strikes}。`;
    log.push(line);
    if (state.strikes >= state.strikeLimit) {
      state.outcome = 'lost';
      state.cause = '撞得太多';
      log.push(`绕行结束：${state.cause}`);
    }
  } else if (same(state.crate, [nx, ny])) {
    const cx = nx + (step[0] ?? 0);
    const cy = ny + (step[1] ?? 0);
    if (wall(cx, cy) || occupy(state, cx, cy, false)) {
      state.strikes += 1;
      log.push(`箱子推不动。撞 ${state.strikes}。`);
      if (state.strikes >= state.strikeLimit) {
        state.outcome = 'lost';
        state.cause = '撞得太多';
        log.push(`绕行结束：${state.cause}`);
      }
    } else {
      state.crate = [cx, cy];
      state.snake = [[nx, ny], ...state.snake.slice(0, -1)];
      log.push(`箱子推到 ${cx},${cy}。`);
      if (same(state.crate, state.dock)) clearStage(state, rng, log);
    }
  } else {
    state.snake = [[nx, ny], ...state.snake.slice(0, -1)];
    log.push(`头移到 ${nx},${ny}。`);
  }
  note(state, log[0] ?? '');
  state.rng = rng.serialize();
  return { log, events: [{ type: 'move', dir, seated: state.seated }] };
}

export function abort(state: CoilState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: CoilState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const body = state.seated * 80 + state.snake.length * 8 - state.strikes * 40;
  const raw = state.outcome === 'won' ? body + 300 : state.seated * 30;
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: CoilState) {
  return {
    title: '虾绕 · 绕行结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '箱', value: state.seated },
      { label: '撞', value: state.strikes },
      { label: '身长', value: state.snake.length },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有箱子进坞'],
    lessons: [
      `本局进坞 ${state.seated} 箱，撞了 ${state.strikes} 次。`,
      '尾巴跟着头。推箱子时，箱子前面必须是空的。',
      '撞墙或撞自己不会移动，只加一次撞。',
    ],
    memoryPrompt:
      '把箱子和坞的位置、你从哪一侧推的写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
