/**
 * 虾灯 / Claw Lamp.
 *
 * Posts on a dark shoal light pools they can see. Two lanterns that see each
 * other cannot both stand. The widest post is usually the one that blocks
 * the seal. Tide is too short to plant it and still recover.
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
  /** Rotates which authored shoal is first, so seeds do not open on the same puzzle. */
  shift: number;
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

/** Where each pool sits on the shoal. Shared with the scene. */
export const POOL_CELLS: Array<[number, number]> = [
  [1, 1],
  [3, 0],
  [5, 2],
  [4, 4],
  [2, 3],
  [0, 2],
];

const A: StageDef[] = [
  {
    pools: 4,
    stock: 2,
    tide: 3,
    posts: [
      { covers: [0, 1, 2], sees: [3], x: 3, y: 1 },
      { covers: [0, 1], sees: [], x: 1, y: 2 },
      { covers: [1], sees: [], x: 4, y: 0 },
      { covers: [2, 3], sees: [0], x: 4, y: 3 },
      { covers: [0], sees: [], x: 0, y: 3 },
    ],
  },
  {
    pools: 5,
    stock: 2,
    tide: 3,
    posts: [
      { covers: [0, 1, 2], sees: [1, 2], x: 2, y: 1 },
      { covers: [0, 3], sees: [], x: 1, y: 3 },
      { covers: [1, 2, 4], sees: [], x: 4, y: 2 },
      { covers: [4], sees: [0], x: 5, y: 0 },
      { covers: [2], sees: [], x: 3, y: 4 },
    ],
  },
  {
    pools: 4,
    stock: 2,
    tide: 3,
    posts: [
      { covers: [0, 1, 2], sees: [2], x: 2, y: 0 },
      { covers: [0, 1], sees: [], x: 0, y: 2 },
      { covers: [2, 3], sees: [0], x: 5, y: 2 },
      { covers: [1], sees: [], x: 1, y: 4 },
      { covers: [0], sees: [1], x: 3, y: 3 },
    ],
  },
  {
    pools: 6,
    stock: 3,
    tide: 5,
    posts: [
      { covers: [0, 1, 2, 3], sees: [4], x: 3, y: 1 },
      { covers: [0, 1], sees: [], x: 1, y: 0 },
      { covers: [2, 3], sees: [], x: 2, y: 3 },
      { covers: [4], sees: [0], x: 5, y: 2 },
      { covers: [3, 4, 5], sees: [0], x: 4, y: 4 },
      { covers: [5], sees: [1], x: 0, y: 4 },
    ],
  },
];

const B: StageDef[] = A.map((stage) => ({
  ...stage,
  posts: stage.posts.map((post) => ({
    covers: [...post.covers],
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

function blocksUnlit(state: LampState, index: number): boolean {
  const post = state.posts[index];
  if (!post) return false;
  const lit = litSet(state);
  const mine = new Set(post.covers);
  return post.sees.some((other) => {
    const blocked = state.posts[other];
    if (!blocked || state.placed[other]) return false;
    return blocked.covers.some((pool) => !mine.has(pool) && !lit.has(pool));
  });
}

function freshCount(state: LampState, index: number): number {
  const lit = litSet(state);
  const post = state.posts[index];
  if (!post) return 0;
  return post.covers.filter((pool) => !lit.has(pool)).length;
}

interface Sim {
  placed: boolean[];
  stock: number;
  tide: number;
}

function litSim(state: LampState, sim: Sim): boolean {
  const lit = new Set<number>();
  state.posts.forEach((post, index) => {
    if (!sim.placed[index]) return;
    for (const pool of post.covers) lit.add(pool);
  });
  for (let i = 0; i < state.pools; i += 1) if (!lit.has(i)) return false;
  return state.pools > 0;
}

function placeable(state: LampState, sim: Sim, index: number): boolean {
  const post = state.posts[index];
  if (!post || sim.placed[index] || sim.stock <= 0 || sim.tide <= 0) return false;
  return !post.sees.some((other) => sim.placed[other] === true);
}

function solvable(state: LampState, sim: Sim, seen: Set<string>): boolean {
  const key = `${sim.placed.map((on) => (on ? '1' : '0')).join('')}|${sim.tide}|${sim.stock}`;
  if (seen.has(key)) return false;
  seen.add(key);
  if (litSim(state, sim)) return true;
  if (sim.tide <= 0) return false;
  for (let i = 0; i < state.posts.length; i += 1) {
    if (!placeable(state, sim, i)) continue;
    sim.placed[i] = true;
    sim.stock -= 1;
    sim.tide -= 1;
    if (solvable(state, sim, seen)) {
      sim.placed[i] = false;
      sim.stock += 1;
      sim.tide += 1;
      return true;
    }
    sim.placed[i] = false;
    sim.stock += 1;
    sim.tide += 1;
  }
  for (let i = 0; i < sim.placed.length; i += 1) {
    if (!sim.placed[i]) continue;
    sim.placed[i] = false;
    sim.stock += 1;
    sim.tide -= 1;
    if (solvable(state, sim, seen)) {
      sim.placed[i] = true;
      sim.stock -= 1;
      sim.tide += 1;
      return true;
    }
    sim.placed[i] = true;
    sim.stock -= 1;
    sim.tide += 1;
  }
  return false;
}

export function suggest(state: LampState): string {
  if (allLit(state)) return 'seal';
  const base = (): Sim => ({ placed: [...state.placed], stock: state.stock, tide: state.tide });
  for (let i = 0; i < state.posts.length; i += 1) {
    const sim = base();
    if (!placeable(state, sim, i)) continue;
    sim.placed[i] = true;
    sim.stock -= 1;
    sim.tide -= 1;
    if (solvable(state, sim, new Set())) return `place:${i}`;
  }
  for (let i = 0; i < state.placed.length; i += 1) {
    if (!state.placed[i] || state.tide <= 0) continue;
    const sim = base();
    sim.placed[i] = false;
    sim.stock += 1;
    sim.tide -= 1;
    if (solvable(state, sim, new Set())) return `lift:${i}`;
  }
  const fallback = state.posts.findIndex((_, index) => canPlace(state, index));
  return fallback >= 0 ? `place:${fallback}` : 'seal';
}

function note(state: LampState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

function load(state: LampState, rng: Rng): void {
  const rule = rules(state.difficulty);
  const variant = rng.int(0, 1) === 0 ? A : B;
  const index = (state.stage - 1 + state.shift) % variant.length;
  const def = variant[index] ?? A[0];
  if (!def) return;
  state.posts = clonePosts(def.posts);
  state.pools = def.pools;
  state.placed = def.posts.map(() => false);
  state.stock = Math.max(1, def.stock + rule.stock);
  const late = state.stage >= 3 ? 1 : 0;
  const floor = state.stage >= 3 ? 2 : 1;
  state.tide = Math.max(floor, def.tide + rule.tide - late);
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
    shift: rng.int(0, 3),
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
  const blocks = post.sees.length ? post.sees.map((other) => other + 1).join(', ') : '无';
  return `第 ${index + 1} 根 ${flag}，能照 ${post.covers.map((pool) => pool + 1).join('/')}，挡住 ${blocks}`;
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
        lines: ['两根能互相看见的柱不能同时立着。照得最广的那根常常挡住封滩的柱。'],
      },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['还没有立灯'] },
    ],
  };
}

function blockWord(post: Post | undefined): string {
  if (!post || post.sees.length === 0) return '无';
  return post.sees.map((index) => index + 1).join(', ');
}

export function actionsOf(state: LampState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const actions: ActionView[] = [];
  for (let i = 0; i < state.posts.length; i += 1) {
    if (!canPlace(state, i)) continue;
    const added = freshCount(state, i);
    const fresh = added === 1 ? '新照亮一个水洼' : `新照亮 ${added} 个水洼`;
    const danger = added === 0 || blocksUnlit(state, i);
    actions.push({
      id: `place:${i}`,
      label: `立 ${i + 1}`,
      detail: `把灯笼立在第 ${i + 1} 根。${fresh}。挡住 ${blockWord(state.posts[i])}。`,
      risk: danger ? 'high' : 'low',
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
  return actions;
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
  return { log, events: [{ type: actionId, tide: state.tide, stock: state.stock }] };
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
      '照得最广的那根常常挡住真正能封滩的柱。先看它挡住谁。',
      '潮不够把立错的灯收回来再重立。一次挪灯比两只省下的灯笼更贵。',
    ],
    memoryPrompt:
      '把本局哪一根柱挡住了真正照亮水洼的位置写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
