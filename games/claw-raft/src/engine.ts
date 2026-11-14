/**
 * 虾筏 / Claw Raft.
 *
 * One crate, three holds, and a gust you can already see. The heavy side
 * dumps. Shifting spends a hand and leaves the crate on the dock.
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
export type Side = 'port' | 'mid' | 'starboard';

export interface Crate {
  w: number;
  pref: Side;
}

interface Holds {
  port: number;
  mid: number;
  starboard: number;
}

export interface RaftState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  crates: Crate[];
  index: number;
  holds: Holds;
  gust: number;
  hands: number;
  nextGust: number;
  dumps: number;
  calm: number;
  quota: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

const PREF: Side[] = ['port', 'mid', 'starboard'];
const PREF_LABEL: Record<Side, string> = {
  port: '左舷',
  mid: '中舱',
  starboard: '右舷',
};

export function sideLabel(side: Side): string {
  return PREF_LABEL[side];
}

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): { quota: number; hands: number } {
  if (difficulty === 'easy') return { quota: 8, hands: 4 };
  if (difficulty === 'hard') return { quota: 14, hands: 2 };
  return { quota: 11, hands: 3 };
}

function makeCrates(rng: Rng): Crate[] {
  const crates: Crate[] = [];
  for (let i = 0; i < 8; i += 1) {
    const w = i < 3 ? rng.int(1, 2) : rng.int(2, 3);
    const pref = PREF[rng.int(0, 2)] ?? 'mid';
    crates.push({ w, pref });
  }
  return crates;
}

function pressure(holds: Holds, gust: number): number {
  return holds.port - holds.starboard + gust;
}

function clone(holds: Holds): Holds {
  return { port: holds.port, mid: holds.mid, starboard: holds.starboard };
}

export function aboard(holds: Holds): number {
  return holds.port + holds.mid + holds.starboard;
}

/** Resolve the gust. Returns what the raft did. Mutates the copy. */
export function settle(holds: Holds, gust: number): 'calm' | 'dump' | 'capsize' | 'steady' {
  const signed = pressure(holds, gust);
  const abs = Math.abs(signed);
  if (abs >= 5) return 'capsize';
  if (abs >= 2) {
    const side: Side = signed > 0 ? 'port' : 'starboard';
    const loss = Math.min(2, holds[side]);
    holds[side] -= loss;
    return loss > 0 ? 'dump' : 'steady';
  }
  if (abs <= 1) return 'calm';
  return 'steady';
}

function note(state: RaftState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

export function createRun(options: { seed: number; difficulty?: string }): RaftState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  return {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    crates: makeCrates(rng),
    index: 0,
    holds: { port: 0, mid: 0, starboard: 0 },
    gust: rng.int(-2, 2),
    hands: rule.hands,
    nextGust: rng.int(-2, 2),
    dumps: 0,
    calm: 0,
    quota: rule.quota,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '筏还在浪上',
  };
}

function crateOf(state: RaftState): Crate | null {
  return state.crates[state.index] ?? null;
}

function forecast(state: RaftState, side: Side): 'calm' | 'dump' | 'capsize' | 'steady' | 'full' {
  const crate = crateOf(state);
  if (!crate) return 'steady';
  if (side === 'mid' && state.holds.mid + crate.w > 4) return 'full';
  const next = clone(state.holds);
  next[side] += crate.w;
  return settle(next, state.gust);
}

function heavier(holds: Holds): Side | null {
  if (holds.port === 0 && holds.starboard === 0) return null;
  if (holds.port === holds.starboard) return holds.port > 0 ? 'port' : null;
  return holds.port > holds.starboard ? 'port' : 'starboard';
}

export function suggest(state: RaftState): string {
  const crate = crateOf(state);
  if (!crate) return 'port';
  const sides: Side[] = ['port', 'mid', 'starboard'];
  let best: Side = 'mid';
  let bestScore = -9999;
  for (const side of sides) {
    const kind = forecast(state, side);
    if (kind === 'full') continue;
    let score = 0;
    if (kind === 'capsize') score = -500;
    else if (kind === 'dump') score = -80;
    else score = 40;
    if (kind === 'calm') score += 25;
    if (side === crate.pref) score += 14;
    else if (side !== 'mid') score -= 12;
    const lean = side === 'mid' || side === crate.pref ? 0 : side === 'port' ? 1 : -1;
    const upcoming = Math.max(-3, Math.min(3, state.nextGust + lean));
    score -= Math.abs(upcoming) * 3;
    const next = clone(state.holds);
    next[side] += crate.w;
    const signed = Math.abs(pressure(next, state.gust));
    score -= signed;
    if (score > bestScore) {
      bestScore = score;
      best = side;
    }
  }
  const heavy = heavier(state.holds);
  if (bestScore < 40 && heavy && state.hands > 0 && state.holds.mid < 4 && state.holds[heavy] > 0) {
    return 'shift';
  }
  return best;
}

export function gustWord(gust: number): string {
  if (gust <= -2) return '大风向左';
  if (gust < 0) return '向左';
  if (gust >= 2) return '大风向右';
  if (gust > 0) return '向右';
  return '正中';
}

function leanOf(side: Side, crate: Crate): number {
  if (side === 'mid' || side === crate.pref) return 0;
  return side === 'port' ? 2 : -2;
}

function word(kind: string): string {
  if (kind === 'calm') return '会平稳';
  if (kind === 'dump') return '重的一侧会落水';
  if (kind === 'capsize') return '筏会翻';
  if (kind === 'full') return '中舱已经满了';
  return '还能稳住';
}

export function statusOf(state: RaftState): StatusView {
  const ended = state.outcome !== 'ongoing';
  const crate = crateOf(state);
  const now = gustWord(state.gust);
  const next = gustWord(state.nextGust);
  const upcoming = state.crates[state.index + 1];
  return {
    headline: ended
      ? `夜渡结束 · ${state.cause}`
      : `第 ${state.index + 1}/8 箱 · 货重 ${aboard(state.holds)}/${state.quota} · 阵风 ${now}`,
    phase: ended ? '收尾' : '夜筏',
    outcome: state.outcome,
    turn: state.index,
    metrics: [
      { label: '货重', value: `${aboard(state.holds)}/${state.quota}` },
      { label: '左舷', value: state.holds.port },
      { label: '中舱', value: state.holds.mid },
      { label: '右舷', value: state.holds.starboard },
      { label: '落水', value: state.dumps },
      { label: '手', value: state.hands },
    ],
    sections: [
      {
        title: '这一箱',
        lines: [
          crate ? `重量 ${crate.w}，想放${PREF_LABEL[crate.pref]}` : '没有下一箱',
          `阵风 ${now}`,
          `下一阵 ${next}`,
          upcoming ? `下一箱重量 ${upcoming.w}，想放${PREF_LABEL[upcoming.pref]}` : '没有下一箱',
        ],
      },
      {
        title: '舱',
        lines: [
          `左舷 ${state.holds.port}`,
          `中舱 ${state.holds.mid}/4`,
          `右舷 ${state.holds.starboard}`,
        ],
      },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['还没有装舱'] },
    ],
  };
}

export function actionsOf(state: RaftState): ActionView[] {
  if (state.outcome !== 'ongoing' || !crateOf(state)) return [];
  const actions: ActionView[] = [];
  for (const side of PREF) {
    const kind = forecast(state, side);
    if (kind === 'full') continue;
    const crate = crateOf(state);
    const pref =
      !crate || side === 'mid'
        ? `中舱不吃左右的风，这一箱想放${crate ? PREF_LABEL[crate.pref] : '中舱'}`
        : side === crate.pref
          ? '放在它想去的一侧，下一阵风不额外偏'
          : `这一箱想放${PREF_LABEL[crate.pref]}，放这里下一阵风再偏 2`;
    actions.push({
      id: side,
      label: PREF_LABEL[side],
      detail: `把这一箱放进${PREF_LABEL[side]}。${word(kind)}。${pref}`,
      risk: kind === 'capsize' || kind === 'dump' ? 'high' : 'low',
    });
  }
  const heavy = heavier(state.holds);
  if (heavy && state.hands > 0 && state.holds.mid < 4 && state.holds[heavy] > 0) {
    actions.push({
      id: 'shift',
      label: '挪一成',
      detail: `把${PREF_LABEL[heavy]}的一成货挪进中舱。这一箱还在码头，花 1 只手。`,
      risk: 'medium',
      cost: '1 只手',
    });
  }
  return actions;
}

function finish(state: RaftState, log: string[]): void {
  if (state.index < state.crates.length) return;
  const weight = aboard(state.holds);
  if (weight >= state.quota) {
    state.outcome = 'won';
    state.cause = '筏靠岸了';
  } else {
    state.outcome = 'lost';
    state.cause = '货不够';
  }
  log.push(`夜渡结束：${state.cause}`);
}

export function act(state: RaftState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing' || !crateOf(state)) {
    throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  }
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  const events: ActionResult['events'] = [];
  if (actionId === 'shift') {
    const heavy = heavier(state.holds);
    if (heavy) {
      state.holds[heavy] -= 1;
      state.holds.mid += 1;
      state.hands -= 1;
    }
    const line = `挪了一成进中舱。手还剩 ${state.hands}。`;
    log.push(line);
    note(state, line);
    events.push({ type: 'shift', hands: state.hands });
  } else {
    const side = actionId as Side;
    const crate = crateOf(state);
    if (!crate) throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
    state.holds[side] += crate.w;
    const kind = settle(state.holds, state.gust);
    if (kind === 'dump') state.dumps += 1;
    if (kind === 'calm') state.calm += 1;
    const line = `第 ${state.index + 1} 箱放进${PREF_LABEL[side]}，阵风之后${word(kind)}。货重 ${aboard(state.holds)}。`;
    log.push(line);
    note(state, line);
    state.timeline.push(`第 ${state.index + 1} 箱 ${PREF_LABEL[side]}`);
    events.push({ type: 'stash', side, kind, weight: aboard(state.holds) });
    if (kind === 'capsize') {
      state.outcome = 'lost';
      state.cause = '筏翻了';
      log.push(`夜渡结束：${state.cause}`);
    } else {
      state.index += 1;
      state.gust = Math.max(-3, Math.min(3, state.nextGust + leanOf(side, crate)));
      state.nextGust = rng.int(-2, 2);
      finish(state, log);
    }
  }
  state.rng = rng.serialize();
  return { log, events };
}

export function abort(state: RaftState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: RaftState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const body = aboard(state.holds) * 25 + state.calm * 20 - state.dumps * 60;
  const raw = state.outcome === 'won' ? body + 380 : Math.floor(Math.max(0, body) / 3);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: RaftState) {
  return {
    title: '虾筏 · 夜渡结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '货重', value: aboard(state.holds) },
      { label: '平稳', value: state.calm },
      { label: '落水', value: state.dumps },
      { label: '手', value: state.hands },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有装上一箱'],
    lessons: [
      `本局靠岸时货重 ${aboard(state.holds)}，平稳 ${state.calm} 次，落水 ${state.dumps} 次。`,
      '阵风和下一阵都能看见。把箱子放进它不想去的一侧，下一阵风会再偏 2。',
      '中舱不进左右倾侧，但只能装 4 成。挪一成要花一只手，箱子还停在码头。',
    ],
    memoryPrompt:
      '把本局哪一阵风把重的一侧掀下水写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
