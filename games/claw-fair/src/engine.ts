/**
 * 虾市 / Claw Fair.
 *
 * Today's customer and yesterday's price are public. Hold, raise by one, or
 * cut down to what they can pay. A refused raise does not move yesterday.
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

export interface FairState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  day: number;
  days: number;
  purse: number;
  yesterday: number;
  stock: number;
  coins: number;
  quota: number;
  served: number;
  walkaways: number;
  walkLimit: number;
  margin: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): {
  days: number;
  quota: number;
  walkLimit: number;
  stock: number;
} {
  if (difficulty === 'easy') return { days: 7, quota: 14, walkLimit: 3, stock: 4 };
  if (difficulty === 'hard') return { days: 6, quota: 22, walkLimit: 2, stock: 2 };
  return { days: 6, quota: 18, walkLimit: 2, stock: 3 };
}

function note(state: FairState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

function arrive(state: FairState, rng: Rng): void {
  state.purse = rng.int(3, 7);
}

function finish(state: FairState, log: string[]): void {
  if (state.walkaways >= state.walkLimit) {
    state.outcome = 'lost';
    state.cause = '客人走了';
    log.push(`市集结束：${state.cause}`);
    return;
  }
  if (state.coins >= state.quota) {
    state.outcome = 'won';
    state.cause = '钱够了';
    log.push(`市集结束：${state.cause}`);
    return;
  }
  if (state.day > state.days) {
    state.outcome = 'lost';
    state.cause = '市散了';
    log.push(`市集结束：${state.cause}`);
  }
}

export function suggest(state: FairState): string {
  if (state.stock <= 0) return 'restock';
  if (state.purse < state.yesterday) return 'cut';
  if (state.purse >= state.yesterday + 1) return 'raise';
  return 'hold';
}

export function createRun(options: { seed: number; difficulty?: string }): FairState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  const state: FairState = {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    day: 1,
    days: rule.days,
    purse: 4,
    yesterday: 4,
    stock: rule.stock,
    coins: 0,
    quota: rule.quota,
    served: 0,
    walkaways: 0,
    walkLimit: rule.walkLimit,
    margin: 0,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '',
  };
  arrive(state, rng);
  state.rng = rng.serialize();
  return state;
}

export function statusOf(state: FairState): StatusView {
  return {
    headline:
      state.outcome === 'ongoing'
        ? `第 ${state.day}/${state.days} 天 · 昨 ${state.yesterday} · 袋 ${state.purse} · 钱 ${state.coins}/${state.quota}`
        : `市集结束 · ${state.cause}`,
    phase: state.outcome === 'ongoing' ? '市集' : '收尾',
    outcome: state.outcome,
    turn: state.day,
    metrics: [
      { label: '钱', value: `${state.coins}/${state.quota}` },
      { label: '昨', value: state.yesterday },
      { label: '袋', value: state.purse },
      { label: '货', value: state.stock },
      { label: '走', value: `${state.walkaways}/${state.walkLimit}` },
    ],
    sections: [{ title: '记录', lines: state.notes.length ? [...state.notes] : ['还没开市'] }],
  };
}

export function actionsOf(state: FairState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const actions: ActionView[] = [
    {
      id: 'restock',
      label: '进货',
      detail: '这一天不卖。货加二。客人不算走。',
      risk: state.stock > 0 ? 'medium' : 'low',
    },
  ];
  if (state.stock > 0) {
    const holdOk = state.yesterday <= state.purse;
    actions.push({
      id: 'hold',
      label: '照昨',
      detail: holdOk
        ? `按昨天的 ${state.yesterday} 卖。客人付得起。`
        : `昨天是 ${state.yesterday}，客人只有 ${state.purse}。会走。`,
      risk: holdOk ? 'low' : 'high',
    });
    const raised = state.yesterday + 1;
    const raiseOk = raised <= state.purse;
    actions.push({
      id: 'raise',
      label: '加一',
      detail: raiseOk
        ? `卖到 ${raised}。客人记得昨天，只肯再加一，这次付得起。`
        : `卖到 ${raised}。客人只有 ${state.purse}。会走，昨天的价钱不变。`,
      risk: raiseOk ? 'low' : 'high',
    });
    if (state.purse < state.yesterday) {
      actions.push({
        id: 'cut',
        label: '降到袋',
        detail: `降到客人袋里的 ${state.purse}。能卖掉，明天就从这里再涨。`,
        risk: 'medium',
      });
    }
  }
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

export function act(state: FairState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  if (actionId === 'restock') {
    state.stock += 2;
    log.push(`进了货。货 ${state.stock}。`);
  } else {
    const price =
      actionId === 'raise'
        ? state.yesterday + 1
        : actionId === 'cut'
          ? state.purse
          : state.yesterday;
    const ok = price <= state.purse && price <= state.yesterday + 1;
    if (!ok || state.stock <= 0) {
      state.walkaways += 1;
      const line = `客人走了。走 ${state.walkaways}。`;
      log.push(line);
      state.timeline.push(line);
    } else {
      state.stock -= 1;
      state.coins += price;
      state.margin += Math.max(0, price - 2);
      state.served += 1;
      state.yesterday = price;
      const line = `卖出 ${price}。钱 ${state.coins}。`;
      log.push(line);
      state.timeline.push(line);
    }
  }
  note(state, log[0] ?? '');
  state.day += 1;
  if (state.outcome === 'ongoing' && state.day <= state.days) arrive(state, rng);
  finish(state, log);
  state.rng = rng.serialize();
  return { log, events: [{ type: 'fair', action: actionId, coins: state.coins }] };
}

export function abort(state: FairState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: FairState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const body = state.margin * 8 + state.served * 20 - state.walkaways * 50;
  const raw = state.outcome === 'won' ? body + 280 : Math.max(0, state.served * 8);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: FairState) {
  return {
    title: '虾市 · 市集结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '钱', value: state.coins },
      { label: '卖', value: state.served },
      { label: '走', value: state.walkaways },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有成交'],
    lessons: [
      `本局卖了 ${state.served} 笔，走了 ${state.walkaways} 位。`,
      '客人记得昨天。加价一次只能加一，而且不能超过袋子。',
      '走掉的人不改昨天的价钱。一次走掉比两笔薄利更贵。',
    ],
    memoryPrompt:
      '把客人袋子比昨天高还是低、你是加价还是降价写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
