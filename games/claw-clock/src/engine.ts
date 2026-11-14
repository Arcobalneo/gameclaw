/**
 * 虾钟 / Claw Clock.
 *
 * Eight cells on a ring. You rotate them, then the hand eats whatever it
 * lands on. Foes are the point. Gems and your own cell are not.
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
export type Token = 'empty' | 'you' | 'foe' | 'gem';

export interface ClockState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  ringIndex: number;
  rings: number;
  ring: Token[];
  hand: number;
  steps: number;
  stepCap: number;
  kills: number;
  shattered: number;
  wounds: number;
  woundLimit: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

const TOKEN_LABEL: Record<Token, string> = {
  empty: '空',
  you: '你',
  foe: '敌',
  gem: '珠',
};

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): { rings: number; stepCap: number; woundLimit: number } {
  if (difficulty === 'easy') return { rings: 3, stepCap: 14, woundLimit: 3 };
  if (difficulty === 'hard') return { rings: 5, stepCap: 10, woundLimit: 2 };
  return { rings: 4, stepCap: 12, woundLimit: 2 };
}

function makeRing(rng: Rng): { ring: Token[]; hand: number } {
  const ring = rng.shuffle([
    'you',
    'foe',
    'foe',
    'gem',
    'gem',
    'empty',
    'empty',
    'empty',
  ] as Token[]);
  let hand = rng.int(0, 7);
  if (ring[hand] === 'you') hand = (hand + 1) % 8;
  return { ring, hand };
}

function note(state: ClockState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

function youAt(ring: readonly Token[]): number {
  return ring.indexOf('you');
}

function rotate(ring: readonly Token[], dir: 1 | -1): Token[] {
  const next = ring.slice() as Token[];
  for (let i = 0; i < 8; i += 1) next[(i + dir + 8) % 8] = ring[i] ?? 'empty';
  return next;
}

function resolveHand(state: ClockState, log: string[]): void {
  state.hand = (state.hand + 1) % 8;
  state.steps += 1;
  const token = state.ring[state.hand] ?? 'empty';
  if (token === 'you') {
    state.wounds += 1;
    const line = `指针击中了你。伤 ${state.wounds}。`;
    log.push(line);
    note(state, line);
    if (state.wounds >= state.woundLimit) {
      state.outcome = 'lost';
      state.cause = '被指针打中';
      log.push(`钟面结束：${state.cause}`);
    }
  } else if (token === 'foe') {
    state.ring[state.hand] = 'empty';
    state.kills += 1;
    const line = '指针吃掉了敌。';
    log.push(line);
    note(state, line);
  } else if (token === 'gem') {
    state.ring[state.hand] = 'empty';
    state.shattered += 1;
    const line = '指针打碎了珠。';
    log.push(line);
    note(state, line);
  } else {
    log.push('指针扫过空格。');
  }
  if (state.outcome !== 'ongoing') return;
  if (!state.ring.includes('foe')) {
    const line = `第 ${state.ringIndex} 圈清空。`;
    log.push(line);
    note(state, line);
    state.timeline.push(line);
    if (state.ringIndex >= state.rings) {
      state.outcome = 'won';
      state.cause = '钟面清空';
      log.push(`钟面结束：${state.cause}`);
      return;
    }
    return;
  }
  if (state.steps >= state.stepCap) {
    state.outcome = 'lost';
    state.cause = '钟面停了';
    log.push(`钟面结束：${state.cause}`);
  }
}

function apply(state: ClockState, actionId: string, rng: Rng | null, log: string[]): void {
  if (actionId === 'rotate:1') {
    state.ring = rotate(state.ring, 1);
    log.push('顺时针转了一格。');
  } else if (actionId === 'rotate:-1') {
    state.ring = rotate(state.ring, -1);
    log.push('逆时针转了一格。');
  } else {
    const at = youAt(state.ring);
    const other = (at + 4) % 8;
    const next = state.ring.slice() as Token[];
    next[at] = state.ring[other] ?? 'empty';
    next[other] = 'you';
    state.ring = next;
    log.push('和对面换了位。');
  }
  resolveHand(state, log);
  if (state.outcome === 'ongoing' && !state.ring.includes('foe')) {
    if (!rng) {
      state.outcome = 'won';
      state.cause = '钟面清空';
      return;
    }
    state.ringIndex += 1;
    const made = makeRing(rng);
    state.ring = made.ring;
    state.hand = made.hand;
    state.steps = 0;
  }
}

function clone(state: ClockState): ClockState {
  return structuredClone(state);
}

function worth(state: ClockState, startRing: number): number {
  if (state.outcome === 'lost') return -800;
  if (state.outcome === 'won' || state.ringIndex !== startRing) return 600;
  const foes = state.ring.filter((token) => token === 'foe').length;
  return state.kills * 20 - state.shattered * 25 - state.wounds * 80 - foes * 15;
}

export function suggest(state: ClockState): string {
  const options = ['rotate:1', 'rotate:-1', 'cross'];
  let best = 'rotate:1';
  let bestScore = -Infinity;
  const visit = (current: ClockState, depth: number, first: string): void => {
    if (depth === 0 || current.outcome !== 'ongoing' || current.ringIndex !== state.ringIndex) {
      const score = worth(current, state.ringIndex);
      if (score > bestScore) {
        bestScore = score;
        best = first;
      }
      return;
    }
    for (const id of options) {
      const next = clone(current);
      apply(next, id, null, []);
      visit(next, depth - 1, first);
    }
  };
  for (const id of options) {
    const next = clone(state);
    apply(next, id, null, []);
    visit(next, 4, id);
  }
  return best;
}

export function createRun(options: { seed: number; difficulty?: string }): ClockState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  const first = makeRing(rng);
  return {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    ringIndex: 1,
    rings: rule.rings,
    ring: first.ring,
    hand: first.hand,
    steps: 0,
    stepCap: rule.stepCap,
    kills: 0,
    shattered: 0,
    wounds: 0,
    woundLimit: rule.woundLimit,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '钟面进行中',
  };
}

export function ringText(ring: readonly Token[]): string {
  return ring.map((token) => TOKEN_LABEL[token]).join(' · ');
}

export function statusOf(state: ClockState): StatusView {
  const ended = state.outcome !== 'ongoing';
  const next = state.ring[(state.hand + 1) % 8] ?? 'empty';
  return {
    headline: ended
      ? `钟面结束 · ${state.cause}`
      : `第 ${state.ringIndex}/${state.rings} 圈 · 指针 ${state.hand + 1} · 伤 ${state.wounds}`,
    phase: ended ? '收尾' : '钟面',
    outcome: state.outcome,
    turn: state.ringIndex,
    metrics: [
      { label: '圈', value: `${state.ringIndex}/${state.rings}` },
      { label: '指针', value: state.hand + 1 },
      { label: '击破', value: state.kills },
      { label: '碎珠', value: state.shattered },
      { label: '伤', value: `${state.wounds}/${state.woundLimit}` },
      { label: '步', value: `${state.steps}/${state.stepCap}` },
    ],
    sections: [
      { title: '环', lines: [ringText(state.ring)] },
      { title: '下一格', lines: [`指针下一步吃到${TOKEN_LABEL[next]}`] },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['指针还没动'] },
    ],
  };
}

export function actionsOf(state: ClockState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const next = (state.hand + 1) % 8;
  const actions: ActionView[] = [
    {
      id: 'rotate:1',
      label: '顺转',
      detail: '整环顺时针转一格，然后指针前进。',
      risk: state.ring[(next + 7) % 8] === 'you' ? 'high' : 'medium',
    },
    {
      id: 'rotate:-1',
      label: '逆转',
      detail: '整环逆时针转一格，然后指针前进。',
      risk: state.ring[(next + 1) % 8] === 'you' ? 'high' : 'medium',
    },
    {
      id: 'cross',
      label: '对换',
      detail: '和环上对面的一格交换，然后指针前进。',
      risk: 'medium',
    },
  ];
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

export function act(state: ClockState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  apply(state, actionId, rng, log);
  state.rng = rng.serialize();
  return {
    log,
    events: [{ type: 'tick', hand: state.hand, wounds: state.wounds, kills: state.kills }],
  };
}

export function abort(state: ClockState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: ClockState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const cleared = state.outcome === 'won' ? state.rings : state.ringIndex - 1;
  const body = cleared * 100 + state.kills * 12 - state.shattered * 28 - state.wounds * 80;
  const raw = state.outcome === 'won' ? body + 340 : Math.max(0, cleared * 40);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: ClockState) {
  const cleared = state.outcome === 'won' ? state.rings : Math.max(0, state.ringIndex - 1);
  return {
    title: '虾钟 · 钟面结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '圈', value: cleared },
      { label: '击破', value: state.kills },
      { label: '碎珠', value: state.shattered },
      { label: '伤', value: state.wounds },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有清空一圈'],
    lessons: [
      `本局清空 ${cleared} 圈，击破 ${state.kills}，碎珠 ${state.shattered}，受伤 ${state.wounds}。`,
      '先转环，指针再吃下一格。敌该送到指针前面，珠和你自己不该送。',
      '对换能把你从指针前面挪走，也会把对面的东西换过来。',
    ],
    memoryPrompt:
      '把本局指针从哪一格开始、珠是不是被吃掉写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
