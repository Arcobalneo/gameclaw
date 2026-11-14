/**
 * 虾镜 / Claw Glass.
 *
 * Three mirrors and one moonbeam. Turning a mirror spends a beat and lets the
 * cloud advance. Fire only pays when the beam reaches the shrine.
 */

import {
  type ActionResult,
  type ActionView,
  illegalAction,
  Rng,
  type StatusView,
} from '@gameclaw/gamekit';
import { TILT_LABEL } from './content';

export type Outcome = 'ongoing' | 'won' | 'lost' | 'aborted';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Dir = 0 | 1 | 2 | 3;

export interface Cell {
  x: number;
  y: number;
}

export interface Mirror {
  x: number;
  y: number;
  tilt: 0 | 1;
}

interface StageDef {
  moon: Cell & { dir: Dir };
  shrine: Cell;
  mirrors: Mirror[];
  rocks: Cell[];
  clouds: Cell[];
  beats: number;
}

export interface GlassState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  stage: number;
  stages: number;
  moon: Cell & { dir: Dir };
  shrine: Cell;
  mirrors: Mirror[];
  rocks: Cell[];
  clouds: Cell[];
  cloud: number;
  beats: number;
  beatMax: number;
  lit: number;
  faults: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

const STAGES: StageDef[] = [
  {
    moon: { x: 0, y: 2, dir: 1 },
    shrine: { x: 6, y: 2 },
    mirrors: [
      { x: 2, y: 0, tilt: 0 },
      { x: 5, y: 0, tilt: 1 },
      { x: 1, y: 4, tilt: 0 },
    ],
    rocks: [],
    clouds: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 1 },
    ],
    beats: 5,
  },
  {
    moon: { x: 0, y: 0, dir: 1 },
    shrine: { x: 5, y: 3 },
    mirrors: [
      { x: 5, y: 0, tilt: 1 },
      { x: 0, y: 3, tilt: 0 },
      { x: 1, y: 4, tilt: 0 },
    ],
    rocks: [{ x: 6, y: 0 }],
    clouds: [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ],
    beats: 6,
  },
  {
    moon: { x: 0, y: 2, dir: 1 },
    shrine: { x: 6, y: 0 },
    mirrors: [
      { x: 6, y: 2, tilt: 0 },
      { x: 1, y: 4, tilt: 0 },
      { x: 2, y: 4, tilt: 1 },
    ],
    rocks: [],
    clouds: [
      { x: 0, y: 4 },
      { x: 1, y: 4 },
      { x: 2, y: 4 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 3 },
      { x: 6, y: 2 },
    ],
    beats: 5,
  },
  {
    moon: { x: 0, y: 1, dir: 1 },
    shrine: { x: 6, y: 0 },
    mirrors: [
      { x: 3, y: 1, tilt: 0 },
      { x: 3, y: 0, tilt: 0 },
      { x: 1, y: 4, tilt: 0 },
    ],
    rocks: [],
    clouds: [
      { x: 6, y: 4 },
      { x: 6, y: 3 },
      { x: 6, y: 2 },
      { x: 6, y: 1 },
      { x: 6, y: 0 },
    ],
    beats: 5,
  },
];

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): { stages: number; beats: number } {
  if (difficulty === 'easy') return { stages: 3, beats: 2 };
  if (difficulty === 'hard') return { stages: 4, beats: -1 };
  return { stages: 4, beats: 0 };
}

function bounce(tilt: 0 | 1, dir: Dir): Dir {
  if (tilt === 0) return ([3, 2, 1, 0] as const)[dir] ?? 0;
  return ([1, 0, 3, 2] as const)[dir] ?? 0;
}

function same(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export type BeamEnd = 'shrine' | 'cloud' | 'miss';

export function beamPoints(state: GlassState): Cell[] {
  const points: Cell[] = [{ x: state.moon.x, y: state.moon.y }];
  let x = state.moon.x;
  let y = state.moon.y;
  let dir = state.moon.dir;
  const seen = new Set<string>();
  for (let i = 0; i < 16; i += 1) {
    x += DX[dir] ?? 0;
    y += DY[dir] ?? 0;
    if (x < 0 || y < 0 || x > 6 || y > 4) break;
    const key = `${x},${y},${dir}`;
    if (seen.has(key)) break;
    seen.add(key);
    points.push({ x, y });
    const cloud = state.clouds[state.cloud];
    if (cloud && same(cloud, { x, y })) break;
    if (state.rocks.some((rock) => same(rock, { x, y }))) break;
    if (same(state.shrine, { x, y })) break;
    const mirror = state.mirrors.find((item) => item.x === x && item.y === y);
    if (mirror) dir = bounce(mirror.tilt, dir);
  }
  return points;
}

export function beamEnd(state: GlassState): BeamEnd {
  const points = beamPoints(state);
  const last = points[points.length - 1];
  if (!last) return 'miss';
  if (same(last, state.shrine)) return 'shrine';
  const cloud = state.clouds[state.cloud];
  if (cloud && same(last, cloud)) return 'cloud';
  return 'miss';
}

function swallowed(state: GlassState, cloud = state.cloud): boolean {
  const cell = state.clouds[cloud];
  if (!cell) return true;
  return same(cell, state.shrine);
}

function endWord(end: BeamEnd): string {
  if (end === 'shrine') return '照到神龛';
  if (end === 'cloud') return '撞上云';
  return '落空';
}

interface Node {
  tilts: Array<0 | 1>;
  cloud: number;
  beats: number;
  first: string;
}

function snapshot(state: GlassState): Node {
  return {
    tilts: state.mirrors.map((mirror) => mirror.tilt),
    cloud: state.cloud,
    beats: state.beats,
    first: '',
  };
}

function withNode(state: GlassState, node: Node): GlassState {
  return {
    ...state,
    cloud: node.cloud,
    beats: node.beats,
    mirrors: state.mirrors.map((mirror, index) => ({
      ...mirror,
      tilt: node.tilts[index] ?? mirror.tilt,
    })),
  };
}

export function suggest(state: GlassState): string {
  const start = snapshot(state);
  const queue: Node[] = [start];
  const seen = new Set<string>();
  let guard = 0;
  while (queue.length && guard < 400) {
    const node = queue.shift();
    guard += 1;
    if (!node) break;
    const key = `${node.tilts.join('')}|${node.cloud}|${node.beats}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const view = withNode(state, node);
    if (swallowed(view)) continue;
    if (beamEnd(view) === 'shrine') return node.first || 'fire';
    if (node.beats <= 0) continue;
    const options = ['fire', 'turn:0', 'turn:1', 'turn:2', 'wait'];
    for (const action of options) {
      const next = applySearch(state, node, action);
      if (!next) continue;
      queue.push(next);
    }
  }
  return 'wait';
}

function applySearch(state: GlassState, node: Node, action: string): Node | null {
  const tilts = [...node.tilts] as Array<0 | 1>;
  let cloud = node.cloud;
  let beats = node.beats;
  if (action === 'fire') {
    const view = withNode(state, node);
    if (beamEnd(view) === 'shrine') return { tilts, cloud, beats, first: node.first || action };
    cloud += 1;
    beats -= 1;
  } else if (action.startsWith('turn:')) {
    const index = Number(action.slice(5));
    if (fogged(withNode(state, node), index)) return null;
    const tilt = tilts[index] ?? 0;
    tilts[index] = tilt === 0 ? 1 : 0;
    cloud += 1;
    beats -= 1;
  } else {
    cloud += 1;
    beats -= 1;
  }
  if (beats < 0) return null;
  const nextState = withNode(state, { tilts, cloud, beats, first: '' });
  if (swallowed(nextState)) return null;
  if (action === 'fire' && beamEnd(withNode(state, node)) === 'shrine') {
    return { tilts, cloud: node.cloud, beats: node.beats, first: node.first || 'fire' };
  }
  return { tilts, cloud, beats, first: node.first || action };
}

function note(state: GlassState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

function flipStage(def: StageDef): StageDef {
  const fx = (x: number) => 6 - x;
  const fdir = (dir: Dir): Dir => (dir === 1 ? 3 : dir === 3 ? 1 : dir);
  return {
    moon: { x: fx(def.moon.x), y: def.moon.y, dir: fdir(def.moon.dir) },
    shrine: { x: fx(def.shrine.x), y: def.shrine.y },
    mirrors: def.mirrors.map((mirror) => ({
      x: fx(mirror.x),
      y: mirror.y,
      tilt: mirror.tilt === 0 ? 1 : 0,
    })),
    rocks: def.rocks.map((rock) => ({ x: fx(rock.x), y: rock.y })),
    clouds: def.clouds.map((cloud) => ({ x: fx(cloud.x), y: cloud.y })),
    beats: def.beats,
  };
}

export function fogged(state: GlassState, index: number): boolean {
  const cloud = state.clouds[state.cloud];
  const mirror = state.mirrors[index];
  if (!cloud || !mirror) return false;
  return cloud.x === mirror.x && cloud.y === mirror.y;
}

function load(state: GlassState, rng: Rng): void {
  const rule = rules(state.difficulty);
  const raw = STAGES[state.stage - 1] ?? STAGES[0];
  const def = raw && rng.int(0, 1) === 1 ? flipStage(raw) : raw;
  if (!def) return;
  state.moon = { ...def.moon };
  state.shrine = { ...def.shrine };
  state.mirrors = def.mirrors.map((mirror) => ({ ...mirror }));
  state.rocks = def.rocks.map((rock) => ({ ...rock }));
  state.clouds = def.clouds.map((cloud) => ({ ...cloud }));
  state.cloud = rng.int(0, 1);
  if (swallowed(state)) state.cloud = 0;
  state.beatMax = Math.max(3, def.beats + rule.beats);
  state.beats = state.beatMax;
}

export function createRun(options: { seed: number; difficulty?: string }): GlassState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  const state: GlassState = {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    stage: 1,
    stages: rule.stages,
    moon: { x: 0, y: 0, dir: 1 },
    shrine: { x: 0, y: 0 },
    mirrors: [],
    rocks: [],
    clouds: [],
    cloud: 0,
    beats: 0,
    beatMax: 0,
    lit: 0,
    faults: 0,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '月光束还没到',
  };
  load(state, rng);
  state.rng = rng.serialize();
  return state;
}

function advanceCloud(state: GlassState, log: string[]): boolean {
  state.cloud += 1;
  state.beats -= 1;
  const covered = swallowed(state);
  if (covered || (state.beats <= 0 && beamEnd(state) !== 'shrine')) {
    state.outcome = 'lost';
    state.cause = covered ? '云盖住了神龛' : '节拍用尽';
    log.push(`月庭结束：${state.cause}`);
    return true;
  }
  return false;
}

export function statusOf(state: GlassState): StatusView {
  const ended = state.outcome !== 'ongoing';
  const cloud = state.clouds[state.cloud];
  return {
    headline: ended
      ? `月庭结束 · ${state.cause}`
      : `第 ${state.stage}/${state.stages} 庭 · 节拍 ${state.beats} · 光束${endWord(beamEnd(state))}`,
    phase: ended ? '收尾' : '月庭',
    outcome: state.outcome,
    turn: state.stage,
    metrics: [
      { label: '庭', value: `${state.stage}/${state.stages}` },
      { label: '节拍', value: state.beats },
      { label: '点亮', value: state.lit },
      { label: '错照', value: state.faults },
      { label: '云', value: cloud ? `${cloud.x},${cloud.y}` : '到了' },
    ],
    sections: [
      {
        title: '镜子',
        lines: state.mirrors.map(
          (mirror, index) =>
            `第 ${index + 1} 面 ${TILT_LABEL[mirror.tilt]}，在 ${mirror.x},${mirror.y}${fogged(state, index) ? '，被云挡住' : ''}`,
        ),
      },
      {
        title: '光束',
        lines: [`现在${endWord(beamEnd(state))}`, `神龛在 ${state.shrine.x},${state.shrine.y}`],
      },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['还没有转镜'] },
    ],
  };
}

function afterTurn(state: GlassState, index: number): string {
  const copy: GlassState = {
    ...state,
    mirrors: state.mirrors.map((mirror, i) =>
      i === index ? { ...mirror, tilt: mirror.tilt === 0 ? 1 : 0 } : { ...mirror },
    ),
    cloud: state.cloud + 1,
  };
  if (swallowed(copy)) return '云会盖住神龛';
  return endWord(beamEnd(copy));
}

export function actionsOf(state: GlassState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  if (state.beats <= 0) {
    if (beamEnd(state) !== 'shrine') return [];
    return [
      {
        id: 'fire',
        label: '放光',
        detail: '现在放光会照到神龛。',
        risk: 'low',
      },
    ];
  }
  const actions: ActionView[] = [];
  for (let index = 0; index < state.mirrors.length; index += 1) {
    if (fogged(state, index)) continue;
    actions.push({
      id: `turn:${index}`,
      label: `转 ${index + 1}`,
      detail: `转动第 ${index + 1} 面镜子。云走一步之后，光束${afterTurn(state, index)}。`,
      risk: 'medium',
      cost: '1 节拍',
    });
  }
  const end = beamEnd(state);
  actions.push({
    id: 'fire',
    label: '放光',
    detail: end === 'shrine' ? '现在放光会照到神龛。' : `现在放光会${endWord(end)}，并记一次错照。`,
    risk: end === 'shrine' ? 'low' : 'high',
    cost: '1 节拍',
  });
  actions.push({
    id: 'wait',
    label: '等云',
    detail: '镜子不动，只让云走一步。',
    risk: 'medium',
    cost: '1 节拍',
  });
  return actions;
}

function clearStage(state: GlassState, rng: Rng, log: string[]): void {
  state.lit += 1;
  const line = `第 ${state.stage} 座神龛亮了。`;
  log.push(line);
  note(state, line);
  state.timeline.push(line);
  if (state.stage >= state.stages) {
    state.outcome = 'won';
    state.cause = '月庭都亮了';
    log.push(`月庭结束：${state.cause}`);
    return;
  }
  state.stage += 1;
  load(state, rng);
}

export function act(state: GlassState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  if (actionId === 'fire') {
    if (beamEnd(state) === 'shrine') {
      const line = '光束照到神龛。';
      log.push(line);
      note(state, line);
      clearStage(state, rng, log);
    } else {
      state.faults += 1;
      const line = `光束${endWord(beamEnd(state))}。错照 ${state.faults}。`;
      log.push(line);
      note(state, line);
      advanceCloud(state, log);
    }
  } else if (actionId.startsWith('turn:')) {
    const index = Number(actionId.slice(5));
    const mirror = state.mirrors[index];
    if (mirror) mirror.tilt = mirror.tilt === 0 ? 1 : 0;
    const line = `转动第 ${index + 1} 面，现在是${mirror ? TILT_LABEL[mirror.tilt] : '反斜'}。`;
    log.push(line);
    note(state, line);
    advanceCloud(state, log);
  } else {
    const line = '等云走了一步。';
    log.push(line);
    note(state, line);
    advanceCloud(state, log);
  }
  state.rng = rng.serialize();
  return {
    log,
    events: [
      { type: actionId === 'fire' ? 'fire' : actionId.startsWith('turn:') ? 'turn' : 'wait' },
    ],
  };
}

export function abort(state: GlassState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: GlassState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const body = state.lit * 80 - state.faults * 180;
  const raw = state.outcome === 'won' ? body + 320 : Math.floor(Math.max(0, body) / 3);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: GlassState) {
  return {
    title: '虾镜 · 月庭结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '点亮', value: state.lit },
      { label: '错照', value: state.faults },
      { label: '节拍', value: state.beats },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有点亮一座'],
    lessons: [
      `本局点亮 ${state.lit} 座，错照 ${state.faults} 次。`,
      '反斜和正斜把光折向不同的方向。状态里写着现在的光束会落到哪里。',
      '没照到就放光，记一次错照。一次错照比两座神龛更贵。',
    ],
    memoryPrompt:
      '把本局哪一面镜子要转成正斜还是反斜才照到神龛写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
