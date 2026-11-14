/**
 * 虾印 / Claw Stamp.
 *
 * A night ferry. Twelve passes, a public kind, and a fare. Edge fares pay more
 * and cost a strike if you stamp them. One pardon waives the fare. Listening
 * spends patience and only rewrites an edge when the detail says so.
 */

import {
  type ActionResult,
  type ActionView,
  illegalAction,
  Rng,
  type StatusView,
} from '@gameclaw/gamekit';
import { KIND_LABEL, type Kind, NAMES } from './content';

export type Outcome = 'ongoing' | 'won' | 'lost' | 'aborted';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Traveler {
  name: string;
  kind: Kind;
  fare: number;
}

export interface StampState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  total: number;
  quota: number;
  strikeLimit: number;
  index: number;
  traveler: Traveler | null;
  next: Traveler | null;
  deck: string[];
  patience: number;
  strikes: number;
  approvals: number;
  fares: number;
  catches: number;
  wrongs: number;
  pardons: number;
  streak: number;
  bestStreak: number;
  listens: number;
  timeline: string[];
  notes: string[];
  outcome: Outcome;
  cause: string;
}

const TOTAL = 12;

function rules(difficulty: Difficulty): { quota: number; patience: number; strikeLimit: number } {
  if (difficulty === 'easy') return { quota: 6, patience: 17, strikeLimit: 4 };
  if (difficulty === 'hard') return { quota: 8, patience: 13, strikeLimit: 2 };
  return { quota: 7, patience: 14, strikeLimit: 3 };
}

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function draw(rng: Rng, deck: string[]): Traveler {
  const roll = rng.int(1, 100);
  const kind: Kind = roll <= 45 ? 'clear' : roll <= 80 ? 'edge' : 'banned';
  const fare = kind === 'edge' ? rng.int(4, 7) : kind === 'clear' ? rng.int(2, 5) : rng.int(1, 3);
  const name = deck.shift() ?? '过客';
  return { name, kind, fare };
}

function note(state: StampState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

function bumpStreak(state: StampState): void {
  state.streak += 1;
  if (state.streak > state.bestStreak) state.bestStreak = state.streak;
}

function finishShift(state: StampState): void {
  if (state.approvals >= state.quota && state.strikes < state.strikeLimit) {
    state.outcome = 'won';
    state.cause = '船开走了';
  } else {
    state.outcome = 'lost';
    state.cause = '放行不够';
  }
}

function afterResolve(state: StampState, rng: Rng): void {
  state.index += 1;
  if (state.index >= state.total) {
    finishShift(state);
    state.traveler = null;
    state.next = null;
    return;
  }
  if (state.patience <= 0) {
    state.outcome = 'lost';
    state.cause = '耐心用尽';
    state.traveler = null;
    return;
  }
  if (state.strikes >= state.strikeLimit) {
    state.outcome = 'lost';
    state.cause = '记过满了';
    state.traveler = null;
    return;
  }
  state.traveler = state.next;
  state.next = draw(rng, state.deck);
}

export function createRun(options: { seed: number; difficulty?: string }): StampState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  const deck = rng.shuffle([...NAMES]);
  const traveler = draw(rng, deck);
  const next = draw(rng, deck);
  return {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    total: TOTAL,
    quota: rule.quota,
    strikeLimit: rule.strikeLimit,
    index: 0,
    traveler,
    next,
    deck,
    patience: rule.patience,
    strikes: 0,
    approvals: 0,
    fares: 0,
    catches: 0,
    wrongs: 0,
    pardons: 1,
    streak: 0,
    bestStreak: 0,
    listens: 0,
    timeline: [],
    notes: [],
    outcome: 'ongoing',
    cause: '夜渡进行中',
  };
}

function lineOf(traveler: Traveler): string {
  return `${traveler.name} · ${KIND_LABEL[traveler.kind]} · 船资 ${traveler.fare}`;
}

export function statusOf(state: StampState): StatusView {
  const ended = state.outcome !== 'ongoing';
  const traveler = state.traveler;
  const upcoming = state.next;
  return {
    headline: ended
      ? `夜渡结束 · ${state.cause}`
      : `夜渡 ${state.index + 1}/${state.total} · 放行 ${state.approvals}/${state.quota} · 记过 ${state.strikes}`,
    phase: ended ? '收尾' : '夜渡',
    outcome: state.outcome,
    turn: state.index,
    metrics: [
      { label: '耐心', value: state.patience },
      { label: '记过', value: `${state.strikes}/${state.strikeLimit}` },
      { label: '放行', value: `${state.approvals}/${state.quota}` },
      { label: '船资', value: state.fares },
      { label: '拦截', value: state.catches },
      { label: '连段', value: state.streak },
      { label: '特赦', value: state.pardons },
    ],
    sections: [
      { title: '当前', lines: [traveler ? lineOf(traveler) : '无人'] },
      { title: '下一位', lines: [upcoming ? lineOf(upcoming) : '无人'] },
      {
        title: '本班',
        lines: [`已处理 ${state.index} 位`, `误判 ${state.wrongs}`, `细看 ${state.listens} 次`],
      },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['还没有动作'] },
    ],
  };
}

function stampDetail(kind: Kind, fare: number): string {
  if (kind === 'clear') return `盖章。合法，船资 ${fare}，不记过。`;
  if (kind === 'edge') return `盖章。擦边，船资 ${fare}，记过 +1，连段中断。`;
  return '盖章。禁行，记过 +1，没有船资。';
}

function refuseDetail(kind: Kind): string {
  if (kind === 'clear') return '拒签。对方合法，记过 +1。';
  if (kind === 'edge') return '拒签。擦边放走，不记过，连段中断。';
  return '拒签。禁行拦截，连段 +1。';
}

function listenDetail(kind: Kind): string {
  if (kind === 'edge') return '细看。擦边会改成合法，花 2 耐心，人还在窗口。';
  if (kind === 'clear') return '细看。本来就合法，花 2 耐心，没有变化。';
  return '细看。禁行不会变，花 2 耐心。';
}

export function suggest(state: StampState): string {
  const traveler = state.traveler;
  if (!traveler || state.outcome !== 'ongoing') return 'stamp';
  if (traveler.kind === 'clear') return 'stamp';
  if (traveler.kind === 'banned') return 'refuse';
  const need = state.approvals < state.quota;
  const danger = state.strikes >= state.strikeLimit - 1;
  if (need && state.pardons > 0) return 'pardon';
  if (need && !danger) return 'stamp';
  if (need && danger && state.patience >= 3) return 'listen';
  return 'refuse';
}

export function actionsOf(state: StampState): ActionView[] {
  if (state.outcome !== 'ongoing' || !state.traveler) return [];
  const traveler = state.traveler;
  const actions: ActionView[] = [
    {
      id: 'stamp',
      label: '盖章',
      detail: stampDetail(traveler.kind, traveler.fare),
      risk: traveler.kind === 'clear' ? 'low' : 'high',
      cost: '1 耐心',
    },
    {
      id: 'refuse',
      label: '拒签',
      detail: refuseDetail(traveler.kind),
      risk: traveler.kind === 'banned' ? 'low' : traveler.kind === 'edge' ? 'medium' : 'high',
      cost: '1 耐心',
    },
  ];
  if (traveler.kind === 'edge' && state.pardons > 0) {
    actions.push({
      id: 'pardon',
      label: '特赦',
      detail: `特赦。擦边改作放行，船资 ${traveler.fare} 不算，不记过。`,
      risk: 'low',
      cost: '1 耐心',
    });
  }
  if (state.patience >= 2) {
    actions.push({
      id: 'listen',
      label: '细看',
      detail: listenDetail(traveler.kind),
      risk: traveler.kind === 'edge' ? 'medium' : 'high',
      cost: '2 耐心',
    });
  }
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

function spend(state: StampState, cost: number): void {
  state.patience -= cost;
}

export function act(state: StampState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing' || !state.traveler) {
    throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  }
  const legal = actionsOf(state).some((action) => action.id === actionId);
  if (!legal) throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  const rng = Rng.restore(state.rng);
  const traveler = state.traveler;
  const events: ActionResult['events'] = [];
  const log: string[] = [];

  if (actionId === 'listen') {
    spend(state, 2);
    state.listens += 1;
    const before = traveler.kind;
    if (traveler.kind === 'edge') traveler.kind = 'clear';
    const line = `细看 ${traveler.name}（${KIND_LABEL[before]}），现在是${KIND_LABEL[traveler.kind]}，耐心 ${state.patience}。`;
    log.push(line);
    note(state, line);
    events.push({ type: 'listen', name: traveler.name, before, after: traveler.kind });
    if (state.patience <= 0 && state.outcome === 'ongoing') {
      state.outcome = 'lost';
      state.cause = '耐心用尽';
      log.push('本班结束：耐心用尽');
    }
    state.rng = rng.serialize();
    return { log, events };
  }

  spend(state, 1);
  if (actionId === 'stamp') {
    if (traveler.kind === 'clear') {
      state.approvals += 1;
      state.fares += traveler.fare;
      bumpStreak(state);
    } else if (traveler.kind === 'edge') {
      state.approvals += 1;
      state.fares += traveler.fare;
      state.strikes += 1;
      state.streak = 0;
    } else {
      state.strikes += 1;
      state.wrongs += 1;
      state.streak = 0;
    }
    const line = `盖章 ${traveler.name}（${KIND_LABEL[traveler.kind]}），船资 ${traveler.kind === 'banned' ? 0 : traveler.fare}，记过 ${state.strikes}，连段 ${state.streak}。`;
    log.push(line);
    note(state, line);
    state.timeline.push(`第 ${state.index + 1} 位 ${traveler.name}：盖章`);
    events.push({
      type: 'stamp',
      kind: traveler.kind,
      fare: traveler.fare,
      strikes: state.strikes,
    });
  } else if (actionId === 'refuse') {
    if (traveler.kind === 'banned') {
      state.catches += 1;
      bumpStreak(state);
    } else if (traveler.kind === 'clear') {
      state.strikes += 1;
      state.wrongs += 1;
      state.streak = 0;
    } else {
      state.streak = 0;
    }
    const line = `拒签 ${traveler.name}（${KIND_LABEL[traveler.kind]}），记过 ${state.strikes}，连段 ${state.streak}。`;
    log.push(line);
    note(state, line);
    state.timeline.push(`第 ${state.index + 1} 位 ${traveler.name}：拒签`);
    events.push({ type: 'refuse', kind: traveler.kind, strikes: state.strikes });
  } else {
    state.pardons -= 1;
    state.approvals += 1;
    bumpStreak(state);
    const line = `特赦 ${traveler.name}，船资 0，记过 ${state.strikes}，连段 ${state.streak}。`;
    log.push(line);
    note(state, line);
    state.timeline.push(`第 ${state.index + 1} 位 ${traveler.name}：特赦`);
    events.push({ type: 'pardon', name: traveler.name, fare: traveler.fare });
  }

  afterResolve(state, rng);
  if (state.outcome !== 'ongoing') log.push(`本班结束：${state.cause}`);
  state.rng = rng.serialize();
  return { log, events };
}

export function abort(state: StampState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: StampState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const base =
    state.fares * 12 +
    state.catches * 35 +
    state.bestStreak * 22 -
    state.strikes * 80 -
    state.wrongs * 40;
  const raw = state.outcome === 'won' ? base + 420 + state.patience * 8 : Math.floor(base / 3);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: StampState) {
  return {
    title: '虾印 · 夜渡结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '放行', value: state.approvals },
      { label: '拦截', value: state.catches },
      { label: '记过', value: state.strikes },
      { label: '船资', value: state.fares },
      { label: '连段', value: state.bestStreak },
      { label: '误判', value: state.wrongs },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有旅客离窗'],
    lessons: [
      `本局放行 ${state.approvals}，拦截 ${state.catches}，记过 ${state.strikes}，误判 ${state.wrongs}。`,
      `擦边船资更高。盖擦边会记过。特赦剩余 ${state.pardons}。细看 ${state.listens} 次。`,
      `最好连段 ${state.bestStreak}。合法盖章、禁行拒签和特赦才延续连段。`,
    ],
    memoryPrompt:
      '把本局的放行、拦截、记过、误判、特赦和细看次数写进你自己的 memory。擦边的船资更高，但是盖章会记过。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
