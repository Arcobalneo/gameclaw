/**
 * 虾礁 / Claw Reef.
 *
 * Step, or spend an anchor. Then the public current pushes anything that is
 * not anchored. A mark counts only where you stand after that push. An urchin
 * on that cell is a sweep unless the anchor is braced on it.
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
export type Dir = 'n' | 'e' | 's' | 'w';

export interface ReefState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  x: number;
  y: number;
  goals: number[][];
  urchins: number[][];
  got: string[];
  tide: number;
  tideCap: number;
  anchors: number;
  swept: number;
  sweepLimit: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

export const WIDTH = 8;
export const HEIGHT = 5;
const CYCLE: Dir[] = ['e', 's', 'w', 'n'];
const DELTA: Record<Dir, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const DIR_LABEL: Record<Dir, string> = { n: '北', e: '东', s: '南', w: '西' };
const STEPS: Dir[] = ['n', 'e', 's', 'w'];

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): {
  anchors: number;
  sweepLimit: number;
  tideCap: number;
  marks: number;
  urchins: number;
} {
  if (difficulty === 'easy')
    return { anchors: 5, sweepLimit: 2, tideCap: 16, marks: 2, urchins: 1 };
  if (difficulty === 'hard')
    return { anchors: 3, sweepLimit: 1, tideCap: 12, marks: 4, urchins: 3 };
  return { anchors: 4, sweepLimit: 1, tideCap: 14, marks: 3, urchins: 2 };
}

function note(state: ReefState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

function keyOf(cell: number[]): string {
  return `${cell[0]},${cell[1]}`;
}

export function coming(state: ReefState): Dir {
  return CYCLE[state.tide % CYCLE.length] ?? 'e';
}

function inside(x: number, y: number): boolean {
  return x > 0 && y > 0 && x < WIDTH - 1 && y < HEIGHT - 1;
}

function push(x: number, y: number, dir: Dir): { x: number; y: number; blocked: boolean } {
  const [dx, dy] = DELTA[dir];
  const nx = x + dx;
  const ny = y + dy;
  if (!inside(nx, ny)) return { x, y, blocked: true };
  return { x: nx, y: ny, blocked: false };
}

export function onUrchin(state: ReefState, x = state.x, y = state.y): boolean {
  return state.urchins.some((cell) => cell[0] === x && cell[1] === y);
}

interface Node {
  x: number;
  y: number;
  tide: number;
  got: number;
  anchors: number;
  swept: number;
  first: string;
}

/** First action of a clear that stays inside the sweep cap, or null. */
function solve(state: ReefState): string | null {
  const goalKeys = state.goals.map((goal) => keyOf(goal));
  const full = (1 << state.goals.length) - 1;
  let mask = 0;
  state.got.forEach((key) => {
    const index = goalKeys.indexOf(key);
    if (index >= 0) mask |= 1 << index;
  });
  const queue: Node[] = [
    {
      x: state.x,
      y: state.y,
      tide: state.tide,
      got: mask,
      anchors: state.anchors,
      swept: state.swept,
      first: '',
    },
  ];
  const seen = new Set<string>();
  while (queue.length) {
    const node = queue.shift();
    if (!node) break;
    if (node.got === full) return node.first || 'anchor';
    if (node.tide >= state.tideCap || node.swept > state.sweepLimit) continue;
    const sig = `${node.x},${node.y},${node.tide},${node.got},${node.anchors},${node.swept}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    const dir = CYCLE[node.tide % CYCLE.length] ?? 'e';
    const options: string[] = [];
    for (const step of STEPS) {
      const [dx, dy] = DELTA[step];
      if (inside(node.x + dx, node.y + dy)) options.push(`step:${step}`);
    }
    if (node.anchors > 0) options.push('anchor');
    for (const id of options) {
      let x = node.x;
      let y = node.y;
      let anchors = node.anchors;
      let swept = node.swept;
      if (id === 'anchor') anchors -= 1;
      else {
        const step = id.slice(5) as Dir;
        const [dx, dy] = DELTA[step];
        x += dx;
        y += dy;
        const landed = push(x, y, dir);
        x = landed.x;
        y = landed.y;
        if (landed.blocked) swept += 1;
        else if (state.urchins.some((cell) => cell[0] === x && cell[1] === y)) swept += 1;
      }
      if (swept > state.sweepLimit) continue;
      let got = node.got;
      const index = goalKeys.indexOf(`${x},${y}`);
      if (index >= 0) got |= 1 << index;
      queue.push({ x, y, tide: node.tide + 1, got, anchors, swept, first: node.first || id });
    }
  }
  return null;
}

export function suggest(state: ReefState): string {
  return solve(state) ?? (state.anchors > 0 ? 'anchor' : 'step:e');
}

function shuffle<T>(rng: Rng, items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    const swap = items[i]!;
    items[i] = items[j]!;
    items[j] = swap;
  }
}

function lay(state: ReefState, rng: Rng, rule: ReturnType<typeof rules>): void {
  const pool: number[][] = [];
  for (let y = 1; y < HEIGHT - 1; y += 1) {
    for (let x = 1; x < WIDTH - 1; x += 1) {
      if (x === 1 && y === 1) continue;
      pool.push([x, y]);
    }
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    shuffle(rng, pool);
    state.goals = pool
      .slice(0, rule.marks)
      .map((cell) => [cell[0]!, cell[1]!])
      .sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0) || (a[0] ?? 0) - (b[0] ?? 0));
    state.urchins = pool
      .slice(rule.marks, rule.marks + rule.urchins)
      .map((cell) => [cell[0]!, cell[1]!]);
    if (solve(state)) return;
  }
  state.urchins = [];
}

export function createRun(options: { seed: number; difficulty?: string }): ReefState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  const state: ReefState = {
    seed: options.seed >>> 0,
    difficulty,
    rng: [],
    x: 1,
    y: 1,
    goals: [],
    urchins: [],
    got: [],
    tide: 0,
    tideCap: rule.tideCap,
    anchors: rule.anchors,
    swept: 0,
    sweepLimit: rule.sweepLimit,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '',
  };
  lay(state, rng, rule);
  state.rng = rng.serialize();
  return state;
}

export function statusOf(state: ReefState): StatusView {
  const dir = coming(state);
  return {
    headline:
      state.outcome === 'ongoing'
        ? `第 ${state.tide + 1}/${state.tideCap} 潮 · 下一步${DIR_LABEL[dir]} · 标 ${state.got.length}/${state.goals.length}`
        : `礁盘结束 · ${state.cause}`,
    phase: state.outcome === 'ongoing' ? '礁盘' : '收尾',
    outcome: state.outcome,
    turn: state.tide,
    metrics: [
      { label: '标', value: `${state.got.length}/${state.goals.length}` },
      { label: '锚', value: state.anchors },
      { label: '冲', value: `${state.swept}/${state.sweepLimit}` },
      { label: '潮', value: DIR_LABEL[dir] },
    ],
    sections: [
      {
        title: '标点',
        lines: state.goals.map((goal) => {
          const key = keyOf(goal);
          return state.got.includes(key) ? `${key} 已踩` : `${key} 还没踩`;
        }),
      },
      {
        title: '海胆',
        lines: state.urchins.length
          ? state.urchins.map((cell) => `${keyOf(cell)} 海胆。潮推上去算一次被冲，下锚可以压住。`)
          : ['这一盘没有海胆'],
      },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['潮还没推'] },
    ],
  };
}

export function forecastStep(
  state: ReefState,
  step: Dir,
): { x: number; y: number; kind: 'wall' | 'urchin' | 'open' } | null {
  const [dx, dy] = DELTA[step];
  if (!inside(state.x + dx, state.y + dy)) return null;
  const landed = push(state.x + dx, state.y + dy, coming(state));
  if (landed.blocked) return { x: landed.x, y: landed.y, kind: 'wall' };
  if (onUrchin(state, landed.x, landed.y)) return { x: landed.x, y: landed.y, kind: 'urchin' };
  return { x: landed.x, y: landed.y, kind: 'open' };
}

function landingDetail(
  step: Dir,
  dir: Dir,
  landed: { x: number; y: number; blocked: boolean },
  urchin: boolean,
): string {
  if (landed.blocked) return `先向${DIR_LABEL[step]}，潮再向${DIR_LABEL[dir]}。潮会把你顶在墙上。`;
  if (urchin) return `先向${DIR_LABEL[step]}，潮再把你推到 ${landed.x},${landed.y} 的海胆上。`;
  return `先向${DIR_LABEL[step]}，潮再把你推到 ${landed.x},${landed.y}。`;
}

export function actionsOf(state: ReefState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const dir = coming(state);
  const actions: ActionView[] = [];
  for (const step of STEPS) {
    const [dx, dy] = DELTA[step];
    if (!inside(state.x + dx, state.y + dy)) continue;
    const landed = push(state.x + dx, state.y + dy, dir);
    const urchin = !landed.blocked && onUrchin(state, landed.x, landed.y);
    actions.push({
      id: `step:${step}`,
      label: DIR_LABEL[step],
      detail: landingDetail(step, dir, landed, urchin),
      risk: landed.blocked || urchin ? 'high' : 'low',
    });
  }
  if (state.anchors > 0) {
    const braced = onUrchin(state);
    actions.push({
      id: 'anchor',
      label: '下锚',
      detail: braced
        ? `下锚压住海胆，停在 ${state.x},${state.y}。锚还剩 ${state.anchors}。`
        : `这一潮停在 ${state.x},${state.y}。锚还剩 ${state.anchors}。`,
      risk: 'medium',
    });
  }
  return actions;
}

function claim(state: ReefState, log: string[]): void {
  const key = `${state.x},${state.y}`;
  if (state.got.includes(key)) return;
  if (!state.goals.some((goal) => keyOf(goal) === key)) return;
  state.got.push(key);
  const line = `踩到标 ${key}。`;
  log.push(line);
  state.timeline.push(line);
}

export function act(state: ReefState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const dir = coming(state);
  const log: string[] = [];
  if (actionId === 'anchor') {
    state.anchors -= 1;
    const line = onUrchin(state)
      ? `下锚压住海胆。停在 ${state.x},${state.y}。`
      : `下锚。停在 ${state.x},${state.y}。`;
    log.push(line);
  } else {
    const step = actionId.slice(5) as Dir;
    const [dx, dy] = DELTA[step];
    state.x += dx;
    state.y += dy;
    const landed = push(state.x, state.y, dir);
    state.x = landed.x;
    state.y = landed.y;
    if (landed.blocked) {
      state.swept += 1;
      const line = `潮把你顶在墙上。冲 ${state.swept}。`;
      log.push(line);
      state.timeline.push(line);
    } else if (onUrchin(state)) {
      state.swept += 1;
      const line = `潮把你推上海胆。冲 ${state.swept}。`;
      log.push(line);
      state.timeline.push(line);
    } else {
      log.push(`潮把你推到 ${state.x},${state.y}。`);
    }
  }
  claim(state, log);
  note(state, log[0] ?? '');
  state.tide += 1;
  if (state.got.length >= state.goals.length) {
    state.outcome = 'won';
    state.cause = '标都踩了';
    log.push(`礁盘结束：${state.cause}`);
  } else if (state.swept > state.sweepLimit) {
    state.outcome = 'lost';
    state.cause = '被冲走了';
    log.push(`礁盘结束：${state.cause}`);
  } else if (state.tide >= state.tideCap) {
    state.outcome = 'lost';
    state.cause = '潮退了';
    log.push(`礁盘结束：${state.cause}`);
  }
  state.rng = rng.serialize();
  return { log, events: [{ type: 'reef', action: actionId, swept: state.swept }] };
}

export function abort(state: ReefState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: ReefState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const body = state.got.length * 90 + state.anchors * 10 - state.swept * 70;
  const raw = state.outcome === 'won' ? body + 280 : Math.max(0, state.got.length * 30);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: ReefState) {
  return {
    title: '虾礁 · 礁盘结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '标', value: state.got.length },
      { label: '锚', value: state.anchors },
      { label: '冲', value: state.swept },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有踩到标'],
    lessons: [
      `本局踩了 ${state.got.length} 个标，被冲 ${state.swept} 次。`,
      '标只在潮推完之后、你还站着的那一格算数。海胆也要等潮推完才算。',
      '一次被冲比省下两只锚更贵。下锚可以压住脚下的海胆。',
    ],
    memoryPrompt:
      '把下一步潮往哪边、标和海胆在被推之后落在哪一格写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
