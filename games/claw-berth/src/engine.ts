/**
 * 虾泊 / Claw Berth.
 *
 * A ship needs a berth at least as deep as its draft. Two hazards cannot sit
 * next to each other. Waiting loads cargo and spends the ship's patience.
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

export interface Ship {
  draft: number;
  hazard: boolean;
  value: number;
  patience: number;
}

export interface Docked {
  left: number;
  value: number;
  hazard: boolean;
}

export interface BerthState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  depths: number[];
  berths: (Docked | null)[];
  current: Ship;
  next: Ship;
  turn: number;
  turnCap: number;
  cargo: number;
  quota: number;
  tugs: number;
  angry: number;
  angryLimit: number;
  incidents: number;
  incidentLimit: number;
  sailed: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): {
  turnCap: number;
  quota: number;
  tugs: number;
  angryLimit: number;
  incidentLimit: number;
} {
  if (difficulty === 'easy')
    return { turnCap: 14, quota: 10, tugs: 3, angryLimit: 4, incidentLimit: 3 };
  if (difficulty === 'hard')
    return { turnCap: 12, quota: 18, tugs: 1, angryLimit: 2, incidentLimit: 1 };
  return { turnCap: 12, quota: 14, tugs: 2, angryLimit: 3, incidentLimit: 2 };
}

function drawShip(rng: Rng): Ship {
  return {
    draft: rng.int(1, 3),
    hazard: rng.int(1, 100) <= 50,
    value: rng.int(2, 5),
    patience: rng.int(3, 5),
  };
}

function note(state: BerthState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

function hazardTouch(state: BerthState, index: number): boolean {
  const here = state.berths[index];
  if (!here?.hazard) return false;
  return [index - 1, index + 1].some((other) => state.berths[other]?.hazard);
}

function wouldTouch(state: BerthState, index: number, hazard: boolean): boolean {
  if (!hazard) return false;
  return [index - 1, index + 1].some(
    (other) => other >= 0 && other < state.berths.length && state.berths[other]?.hazard,
  );
}

export function suggest(state: BerthState): string {
  let best = '';
  let bestDepth = -1;
  for (let i = 0; i < state.berths.length; i += 1) {
    if (state.berths[i]) continue;
    const depth = state.depths[i] ?? 0;
    const fits = state.current.draft <= depth;
    const tug = state.tugs > 0 && state.current.draft === depth + 1;
    if ((fits || tug) && !wouldTouch(state, i, state.current.hazard) && depth > bestDepth) {
      bestDepth = depth;
      best = fits ? `dock:${i}` : `tug:${i}`;
    }
  }
  if (best) return best;
  return 'wait';
}

export function createRun(options: { seed: number; difficulty?: string }): BerthState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  return {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    depths: [1, 2, 2, 3],
    berths: [null, null, null, null],
    current: drawShip(rng),
    next: drawShip(rng),
    turn: 0,
    turnCap: rule.turnCap,
    cargo: 0,
    quota: rule.quota,
    tugs: rule.tugs,
    angry: 0,
    angryLimit: rule.angryLimit,
    incidents: 0,
    incidentLimit: rule.incidentLimit,
    sailed: 0,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '泊位进行中',
  };
}

function shipLine(ship: Ship): string {
  return `吃水 ${ship.draft} · 货 ${ship.value} · 耐心 ${ship.patience}${ship.hazard ? ' · 危货' : ''}`;
}

export function statusOf(state: BerthState): StatusView {
  const ended = state.outcome !== 'ongoing';
  return {
    headline: ended
      ? `泊位结束 · ${state.cause}`
      : `第 ${state.turn}/${state.turnCap} 潮 · 货 ${state.cargo}/${state.quota} · 怒 ${state.angry}`,
    phase: ended ? '收尾' : '泊位',
    outcome: state.outcome,
    turn: state.turn,
    metrics: [
      { label: '货', value: `${state.cargo}/${state.quota}` },
      { label: '潮', value: `${state.turn}/${state.turnCap}` },
      { label: '拖', value: state.tugs },
      { label: '怒', value: `${state.angry}/${state.angryLimit}` },
      { label: '事', value: `${state.incidents}/${state.incidentLimit}` },
      { label: '开航', value: state.sailed },
    ],
    sections: [
      { title: '当前船', lines: [shipLine(state.current)] },
      { title: '下一艘', lines: [shipLine(state.next)] },
      {
        title: '泊位',
        lines: state.berths.map((berth, index) =>
          berth
            ? `${index + 1} 深 ${state.depths[index]} 装 ${berth.left}${berth.hazard ? ' 危' : ''}`
            : `${index + 1} 深 ${state.depths[index]} 空`,
        ),
      },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['港还是空的'] },
    ],
  };
}

export function actionsOf(state: BerthState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const actions: ActionView[] = [
    {
      id: 'wait',
      label: '等待',
      detail: '装卸减一拍。装完就开航。当前船的耐心也减一，到零就生气离开。',
      risk: state.current.patience <= 1 ? 'high' : 'medium',
    },
  ];
  for (let i = 0; i < state.berths.length; i += 1) {
    if (state.berths[i]) continue;
    const depth = state.depths[i] ?? 0;
    if (state.current.draft <= depth) {
      actions.push({
        id: `dock:${i}`,
        label: `靠 ${i + 1}`,
        detail: wouldTouch(state, i, state.current.hazard)
          ? '吃水够，但会和旁边的危货贴在一起。'
          : `吃水 ${state.current.draft} 不超过水深 ${depth}。`,
        risk: wouldTouch(state, i, state.current.hazard) ? 'high' : 'low',
      });
    } else if (state.tugs > 0 && state.current.draft === depth + 1) {
      actions.push({
        id: `tug:${i}`,
        label: `拖 ${i + 1}`,
        detail: '花一艘拖船，把深一档的船塞进这个泊位。',
        risk: 'medium',
        cost: '1 拖',
      });
    }
  }
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

function checkEnd(state: BerthState, log: string[]): void {
  if (state.outcome !== 'ongoing') return;
  if (state.cargo >= state.quota) {
    state.outcome = 'won';
    state.cause = '货装够了';
    log.push(`泊位结束：${state.cause}`);
    return;
  }
  if (state.incidents >= state.incidentLimit) {
    state.outcome = 'lost';
    state.cause = '危货贴在一起';
    log.push(`泊位结束：${state.cause}`);
    return;
  }
  if (state.angry >= state.angryLimit) {
    state.outcome = 'lost';
    state.cause = '船等怒了';
    log.push(`泊位结束：${state.cause}`);
    return;
  }
  if (state.turn >= state.turnCap) {
    state.outcome = 'lost';
    state.cause = '潮退了';
    log.push(`泊位结束：${state.cause}`);
  }
}

function arrive(state: BerthState, rng: Rng): void {
  state.current = state.next;
  state.next = drawShip(rng);
}

export function act(state: BerthState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  state.turn += 1;
  if (actionId.startsWith('dock:') || actionId.startsWith('tug:')) {
    const index = Number(actionId.slice(actionId.indexOf(':') + 1));
    if (actionId.startsWith('tug:')) state.tugs -= 1;
    state.berths[index] = { left: 4, value: state.current.value, hazard: state.current.hazard };
    if (hazardTouch(state, index)) state.incidents += 1;
    log.push(`船靠上 ${index + 1} 号泊位。`);
    arrive(state, rng);
  }
  for (let i = 0; i < state.berths.length; i += 1) {
    const berth = state.berths[i];
    if (!berth) continue;
    berth.left -= 1;
    if (berth.left <= 0) {
      state.cargo += berth.value;
      state.sailed += 1;
      state.berths[i] = null;
      log.push(`${i + 1} 号装完，货 +${berth.value}。`);
    }
  }
  if (actionId === 'wait') {
    state.current.patience -= 1;
    if (state.current.patience <= 0) {
      state.angry += 1;
      log.push('当前船等怒了，离开。');
      arrive(state, rng);
    } else log.push('装卸走了一拍。');
  }
  note(state, log[0] ?? '潮走了一拍。');
  checkEnd(state, log);
  state.rng = rng.serialize();
  return { log, events: [{ type: actionId, cargo: state.cargo, turn: state.turn }] };
}

export function abort(state: BerthState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: BerthState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const body = state.cargo * 12 + state.sailed * 15 - state.angry * 40 - state.incidents * 70;
  const raw = state.outcome === 'won' ? body + 320 : Math.max(0, state.cargo * 4);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: BerthState) {
  return {
    title: '虾泊 · 泊位结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '货', value: state.cargo },
      { label: '开航', value: state.sailed },
      { label: '怒', value: state.angry },
      { label: '事', value: state.incidents },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有开航'],
    lessons: [
      `本局货 ${state.cargo}，开航 ${state.sailed}，怒 ${state.angry}，危货事故 ${state.incidents}。`,
      '吃水不能超过水深。拖船只能多塞深一档。',
      '两艘危货挨着就算一次事故。等待会让当前船失去耐心。',
    ],
    memoryPrompt:
      '把哪条船吃水太深、危货有没有挨在一起写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
