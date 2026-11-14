/**
 * 虾灯 / Claw Lamp.
 *
 * Posts on a dark shoal light pools they can see. Two lanterns that see each
 * other cannot both stand. Tide is short, so picking a post back up is expensive.
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

export interface Post {
  covers: number[];
  sees: number[];
  x: number;
  y: number;
}

interface StageDef {
  pools: number;
  stock: number;
  tide: number;
  posts: Post[];
}

export interface LampState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  stage: number;
  stages: number;
  pools: number;
  posts: Post[];
  placed: boolean[];
  stock: number;
  tide: number;
  lifts: number;
  saved: number;
  cleared: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

const A: StageDef[] = [
  {
    pools: 4,
    stock: 2,
    tide: 4,
    posts: [
      { covers: [0], sees: [1, 2], x: 1, y: 1 },
      { covers: [0, 1, 2], sees: [0], x: 3, y: 2 },
      { covers: [3], sees: [0], x: 5, y: 3 },
      { covers: [1], sees: [1], x: 2, y: 4 },
    ],
  },
  {
    pools: 5,
    stock: 3,
    tide: 5,
    posts: [
      { covers: [0], sees: [1, 2, 3], x: 0, y: 2 },
      { covers: [0, 1], sees: [0], x: 2, y: 1 },
      { covers: [2, 3], sees: [0], x: 4, y: 1 },
      { covers: [4], sees: [0], x: 5, y: 3 },
      { covers: [1], sees: [1], x: 1, y: 4 },
    ],
  },
  {
    pools: 4,
    stock: 2,
    tide: 4,
    posts: [
      { covers: [0], sees: [1, 2], x: 2, y: 0 },
      { covers: [0, 1, 2], sees: [0], x: 4, y: 2 },
      { covers: [3], sees: [0], x: 1, y: 3 },
      { covers: [2], sees: [4], x: 5, y: 4 },
      { covers: [1], sees: [1], x: 0, y: 1 },
    ],
  },
  {
    pools: 6,
    stock: 3,
    tide: 5,
    posts: [
      { covers: [0], sees: [1, 2, 3], x: 3, y: 0 },
      { covers: [0, 1], sees: [0], x: 1, y: 2 },
      { covers: [2, 3], sees: [0], x: 3, y: 2 },
      { covers: [4, 5], sees: [0], x: 5, y: 2 },
      { covers: [1], sees: [5], x: 0, y: 4 },
      { covers: [2], sees: [1], x: 4, y: 4 },
    ],
  },
];

const B: StageDef[] = A.map((stage) => ({
  ...stage,
  posts: stage.posts.map((post) => ({
    covers: post.covers[0] === 0 && post.covers.length === 1 ? [0] : [...post.covers],
    sees: [...post.sees],
    x: (post.x + 2) % 6,
    y: post.y,
  })),
}));

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): { stages: number; tide: number; stock: number } {
  if (difficulty === 'easy') return { stages: 3, tide: 2, stock: 1 };
  if (difficulty === 'hard') return { stages: 4, tide: -1, stock: 0 };
  return { stages: 4, tide: 0, stock: 0 };
}

function clonePosts(posts: Post[]): Post[] {
  return posts.map((post) => ({
    covers: [...post.covers],
    sees: [...post.sees],
    x: post.x,
    y: post.y,
  }));
}

export function litSet(state: LampState): Set<number> {
  const lit = new Set<number>();
  state.posts.forEach((post, index) => {
    if (!state.placed[index]) return;
    for (const pool of post.covers) lit.add(pool);
  });
  return lit;
}

export function allLit(state: LampState): boolean {
  const lit = litSet(state);
  for (let i = 0; i < state.pools; i += 1) if (!lit.has(i)) return false;
  return state.pools > 0;
}

export function canPlace(state: LampState, index: number): boolean {
  const post = state.posts[index];
  if (!post || state.placed[index] || state.stock <= 0 || state.tide <= 0) return false;
  return !post.sees.some((other) => state.placed[other] === true);
}

function freshCount(state: LampState, index: number): number {
  const lit = litSet(state);
  const post = state.posts[index];
  if (!post) return 0;
  return post.covers.filter((pool) => !lit.has(pool)).length;
}

export function suggest(state: LampState): string {
  if (allLit(state)) return 'seal';
  let best = -1;
  let bestNew = 0;
  for (let i = 0; i < state.posts.length; i += 1) {
    if (!canPlace(state, i)) continue;
    const added = freshCount(state, i);
    if (added > bestNew) {
      bestNew = added;
      best = i;
    }
  }
  if (best >= 0 && bestNew > 0) return `place:${best}`;
  const lift = state.placed.findIndex((on) => on);
  if (lift >= 0 && state.tide > 0) return `lift:${lift}`;
  return 'seal';
}

function note(state: LampState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

function load(state: LampState, rng: Rng): void {
  const rule = rules(state.difficulty);
  const variant = rng.int(0, 1) === 0 ? A : B;
  const def = variant[state.stage - 1] ?? A[0];
  if (!def) return;
  state.posts = clonePosts(def.posts);
  state.pools = def.pools;
  state.placed = def.posts.map(() => false);
  state.stock = Math.max(1, def.stock + rule.stock);
  state.tide = Math.max(1, def.tide + rule.tide);
}

export function createRun(options: { seed: number; difficulty?: string }): LampState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  const state: LampState = {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    stage: 1,
    stages: rule.stages,
    pools: 0,
    posts: [],
    placed: [],
    stock: 0,
    tide: 0,
    lifts: 0,
    saved: 0,
    cleared: 0,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '浅滩还黑着',
  };
  load(state, rng);
  state.rng = rng.serialize();
  return state;
}

function postLine(state: LampState, index: number): string {
  const post = state.posts[index];
  if (!post) return '无';
  const flag = state.placed[index] ? '已立' : '空着';
  return `第 ${index + 1} 根 ${flag}，能照 ${post.covers.map((pool) => pool + 1).join('/')}`;
}

export function statusOf(state: LampState): StatusView {
  const ended = state.outcome !== 'ongoing';
  const lit = litSet(state).size;
  return {
    headline: ended
      ? `浅滩结束 · ${state.cause}`
      : `第 ${state.stage}/${state.stages} 段 · 水洼 ${lit}/${state.pools} · 潮 ${state.tide}`,
    phase: ended ? '收尾' : '浅滩',
    outcome: state.outcome,
    turn: state.stage,
    metrics: [
      { label: '段', value: `${state.stage}/${state.stages}` },
      { label: '水洼', value: `${lit}/${state.pools}` },
      { label: '灯笼', value: state.stock },
      { label: '潮', value: state.tide },
      { label: '挪灯', value: state.lifts },
      { label: '省下', value: state.saved },
    ],
    sections: [
      { title: '柱', lines: state.posts.map((_, index) => postLine(state, index)) },
      {
        title: '视线',
        lines: ['两根能互相看见的柱不能同时立着。收起灯笼要花一潮，并记一次挪灯。'],
      },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['还没有立灯'] },
    ],
  };
}

export function actionsOf(state: LampState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const actions: ActionView[] = [];
  for (let i = 0; i < state.posts.length; i += 1) {
    if (!canPlace(state, i)) continue;
    const added = freshCount(state, i);
    actions.push({
      id: `place:${i}`,
      label: `立 ${i + 1}`,
      detail: `把灯笼立在第 ${i + 1} 根。新照亮 ${added} 个水洼。`,
      risk: added > 0 ? 'low' : 'high',
      cost: '1 潮',
    });
  }
  for (let i = 0; i < state.posts.length; i += 1) {
    if (!state.placed[i] || state.tide <= 0) continue;
    actions.push({
      id: `lift:${i}`,
      label: `收 ${i + 1}`,
      detail: `收起第 ${i + 1} 根。灯笼回来，记一次挪灯。`,
      risk: 'high',
      cost: '1 潮',
    });
  }
  if (allLit(state)) {
    actions.push({
      id: 'seal',
      label: '封滩',
      detail: `水洼都亮了。封这一段，省下的 ${state.stock} 只灯笼记进分数。`,
      risk: 'low',
    });
  }
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

function fail(state: LampState, log: string[]): void {
  state.outcome = 'lost';
  state.cause = '潮水灭了灯';
  log.push(`浅滩结束：${state.cause}`);
}

export function act(state: LampState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  if (actionId === 'seal') {
    state.saved += state.stock;
    state.cleared += 1;
    const line = `第 ${state.stage} 段封上了。省下灯笼 ${state.stock}。`;
    log.push(line);
    note(state, line);
    state.timeline.push(line);
    if (state.stage >= state.stages) {
      state.outcome = 'won';
      state.cause = '浅滩都亮了';
      log.push(`浅滩结束：${state.cause}`);
    } else {
      state.stage += 1;
      load(state, rng);
    }
  } else if (actionId.startsWith('lift:')) {
    const index = Number(actionId.slice(5));
    const was = state.placed[index];
    if (was) state.placed[index] = false;
    state.stock += 1;
    state.lifts += 1;
    state.tide -= 1;
    const line = `收起第 ${index + 1} 根。灯笼 ${state.stock}，挪灯 ${state.lifts}。`;
    log.push(line);
    note(state, line);
    if (state.tide <= 0 && !allLit(state)) fail(state, log);
  } else {
    const index = Number(actionId.slice(6));
    const added = freshCount(state, index);
    const slot = state.placed[index];
    if (slot === false) state.placed[index] = true;
    state.stock -= 1;
    state.tide -= 1;
    const line = `立灯 ${index + 1}，新照亮 ${added}，灯笼 ${state.stock}，潮 ${state.tide}。`;
    log.push(line);
    note(state, line);
    if (state.tide <= 0 && !allLit(state)) fail(state, log);
  }
  state.rng = rng.serialize();
  return { log, events: [{ type: actionId.startsWith('place:') ? 'place' : actionId }] };
}

export function abort(state: LampState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: LampState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const body = state.cleared * 100 + state.saved * 8 - state.lifts * 18;
  const raw = state.outcome === 'won' ? body + 360 : Math.floor(Math.max(0, body) / 3);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: LampState) {
  return {
    title: '虾灯 · 浅滩结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '段', value: state.cleared },
      { label: '省下', value: state.saved },
      { label: '挪灯', value: state.lifts },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有封上一段'],
    lessons: [
      `本局封上 ${state.cleared} 段，省下 ${state.saved} 只灯笼，挪灯 ${state.lifts} 次。`,
      '能互相看见的两根柱不能同时立。先立照亮水洼最多的那根。',
      '潮不够把立错的灯都收回来。一次挪灯比两只省下的灯笼更贵。',
    ],
    memoryPrompt:
      '把本局哪一根柱挡住了真正照亮水洼的位置写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
