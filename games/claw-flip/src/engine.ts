/**
 * 虾拨 / Claw Flip.
 *
 * One switch turns every plate into a gap and every gap into a plate.
 * Stones never change. A scarce hop is how you cross a stone.
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
export type Tile = 'plate' | 'gap' | 'stone';

export interface FlipState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  stage: number;
  stages: number;
  tiles: Tile[];
  flipped: boolean;
  pos: number;
  springs: number;
  springMax: number;
  flips: number;
  wounds: number;
  woundLimit: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

const TILE_LABEL: Record<Tile, string> = { plate: '板', gap: '空', stone: '石' };

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): { stages: number; springs: number; woundLimit: number } {
  if (difficulty === 'easy') return { stages: 3, springs: 3, woundLimit: 4 };
  if (difficulty === 'hard') return { stages: 5, springs: 1, woundLimit: 2 };
  return { stages: 4, springs: 2, woundLimit: 3 };
}

function makeStage(rng: Rng): Tile[] {
  const tiles: Tile[] = [];
  let kind: Tile = rng.pick(['plate', 'gap']);
  while (tiles.length < 8) {
    const run = rng.int(2, 3);
    for (let i = 0; i < run && tiles.length < 8; i += 1) tiles.push(kind);
    kind = kind === 'plate' ? 'gap' : 'plate';
  }
  tiles[0] = 'plate';
  tiles[rng.int(2, 7)] = 'stone';
  return tiles;
}

export function isSafe(tile: Tile | undefined, flipped: boolean): boolean {
  if (!tile || tile === 'stone') return false;
  return tile === 'plate' ? !flipped : flipped;
}

function note(state: FlipState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

function stonesAhead(state: FlipState): number {
  let n = 0;
  for (let i = state.pos + 1; i < state.tiles.length; i += 1)
    if (state.tiles[i] === 'stone') n += 1;
  return n;
}

export function suggest(state: FlipState): string {
  const next = state.tiles[state.pos + 1];
  const land = state.pos + 2;
  const landing = land >= state.tiles.length ? undefined : state.tiles[land];
  const hopOk = state.springs > 0 && (land >= state.tiles.length || isSafe(landing, state.flipped));
  if (next && isSafe(next, state.flipped)) return 'step';
  if (next === 'stone' && hopOk) return 'hop';
  if (hopOk && state.springs > stonesAhead(state)) return 'hop';
  return 'flip';
}

export function createRun(options: { seed: number; difficulty?: string }): FlipState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  return {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    stage: 1,
    stages: rule.stages,
    tiles: makeStage(rng),
    flipped: false,
    pos: -1,
    springs: rule.springs,
    springMax: rule.springs,
    flips: 0,
    wounds: 0,
    woundLimit: rule.woundLimit,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '拨桥进行中',
  };
}

function clearStage(state: FlipState, rng: Rng, log: string[]): void {
  const line = `第 ${state.stage} 段过去了。`;
  log.push(line);
  note(state, line);
  state.timeline.push(line);
  if (state.stage >= state.stages) {
    state.outcome = 'won';
    state.cause = '桥拨完了';
    log.push(`拨桥结束：${state.cause}`);
    return;
  }
  state.stage += 1;
  state.tiles = makeStage(rng);
  state.flipped = false;
  state.pos = -1;
  state.springs = state.springMax;
}

function wound(state: FlipState, log: string[]): void {
  state.wounds += 1;
  const line = `踩伤，停在原地。伤 ${state.wounds}。`;
  log.push(line);
  note(state, line);
  if (state.wounds >= state.woundLimit) {
    state.outcome = 'lost';
    state.cause = '伤太重';
    log.push(`拨桥结束：${state.cause}`);
  }
}

export function statusOf(state: FlipState): StatusView {
  const ended = state.outcome !== 'ongoing';
  const next = state.tiles[state.pos + 1];
  return {
    headline: ended
      ? `拨桥结束 · ${state.cause}`
      : `第 ${state.stage}/${state.stages} 段 · ${state.flipped ? '反位' : '正位'} · 簧 ${state.springs}`,
    phase: ended ? '收尾' : '拨桥',
    outcome: state.outcome,
    turn: state.stage,
    metrics: [
      { label: '段', value: `${state.stage}/${state.stages}` },
      { label: '开关', value: state.flipped ? '反位' : '正位' },
      { label: '簧', value: state.springs },
      { label: '拨动', value: state.flips },
      { label: '伤', value: `${state.wounds}/${state.woundLimit}` },
      { label: '位置', value: state.pos + 1 },
    ],
    sections: [
      {
        title: '下一格',
        lines: [
          next
            ? `${TILE_LABEL[next]}，${isSafe(next, state.flipped) ? '可走' : '不可走'}`
            : '这段已经走完',
        ],
      },
      {
        title: '桥',
        lines: [state.tiles.map((tile) => TILE_LABEL[tile]).join(' · ')],
      },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['开关还是正位'] },
    ],
  };
}

export function actionsOf(state: FlipState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const next = state.tiles[state.pos + 1];
  const landIndex = state.pos + 2;
  const landing = landIndex >= state.tiles.length ? undefined : state.tiles[landIndex];
  const actions: ActionView[] = [
    {
      id: 'flip',
      label: '拨动',
      detail: state.flipped
        ? '拨回正位。板可走，空不可走。石头不变。'
        : '拨到反位。空可走，板不可走。石头不变。',
      risk: 'medium',
    },
    {
      id: 'step',
      label: '迈步',
      detail: isSafe(next, state.flipped) ? '下一格可走。' : '下一格不可走，迈步会受伤并停住。',
      risk: isSafe(next, state.flipped) ? 'low' : 'high',
    },
  ];
  if (
    state.springs > 0 &&
    next &&
    (landIndex >= state.tiles.length || isSafe(landing, state.flipped))
  ) {
    actions.push({
      id: 'hop',
      label: '跳过',
      detail:
        landIndex >= state.tiles.length
          ? '跳过下一格，直接离开这段。'
          : '跳过下一格，落在可走的那一格。花 1 簧。',
      risk: 'low',
      cost: '1 簧',
    });
  }
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

export function act(state: FlipState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  if (actionId === 'flip') {
    state.flipped = !state.flipped;
    state.flips += 1;
    const line = state.flipped ? '拨到反位。' : '拨回正位。';
    log.push(line);
    note(state, line);
  } else if (actionId === 'hop') {
    state.springs -= 1;
    state.pos += 2;
    const line = `跳过一格，落在第 ${Math.min(state.pos + 1, state.tiles.length)} 格。簧 ${state.springs}。`;
    log.push(line);
    note(state, line);
    if (state.pos >= state.tiles.length - 1) clearStage(state, rng, log);
  } else if (isSafe(state.tiles[state.pos + 1], state.flipped)) {
    state.pos += 1;
    const line = `迈上第 ${state.pos + 1} 格。`;
    log.push(line);
    note(state, line);
    if (state.pos >= state.tiles.length - 1) clearStage(state, rng, log);
  } else {
    wound(state, log);
  }
  state.rng = rng.serialize();
  return { log, events: [{ type: actionId, flipped: state.flipped, pos: state.pos }] };
}

export function abort(state: FlipState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: FlipState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const cleared = state.outcome === 'won' ? state.stages : state.stage - 1;
  const body = cleared * 100 + state.springs * 20 - state.wounds * 80 - state.flips * 6;
  const raw = state.outcome === 'won' ? body + 320 : Math.max(0, cleared * 40);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: FlipState) {
  const cleared = state.outcome === 'won' ? state.stages : Math.max(0, state.stage - 1);
  return {
    title: '虾拨 · 拨桥结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '段', value: cleared },
      { label: '拨动', value: state.flips },
      { label: '伤', value: state.wounds },
      { label: '簧', value: state.springs },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有走完一段'],
    lessons: [
      `本局走完 ${cleared} 段，拨了 ${state.flips} 次，受伤 ${state.wounds}。`,
      '拨动让所有板变空、所有空变板。石头两边都不安全，只能跳。',
      `簧还剩 ${state.springs}。簧要留给石头，不要拿去跳普通的空。`,
    ],
    memoryPrompt:
      '把本局石头在第几格、正位和反位哪一段更长写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
