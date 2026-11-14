/**
 * 虾仓 / Claw Stow.
 *
 * Six bays. A crate arrives, then another, then an order for the second one.
 * Pull the bay that matches. The next two events are on the slip.
 */

import {
  type ActionResult,
  type ActionView,
  illegalAction,
  Rng,
  type StatusView,
} from '@gameclaw/gamekit';
import { GLYPHS } from './content';

export type Outcome = 'ongoing' | 'won' | 'lost' | 'aborted';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Bay {
  glyph: number;
  age: number;
  labeled: boolean;
}

export interface Slip {
  kind: 'crate' | 'order';
  glyph: number;
}

export interface StowState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  events: Slip[];
  index: number;
  bays: Array<Bay | null>;
  marks: number;
  spoil: number;
  cap: number;
  quota: number;
  correct: number;
  mispicks: number;
  streak: number;
  bestStreak: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
}

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): {
  spoil: number;
  marks: number;
  cap: number;
  quota: number;
  cycles: number;
} {
  if (difficulty === 'easy') return { spoil: 4, marks: 4, cap: 4, quota: 3, cycles: 4 };
  if (difficulty === 'hard') return { spoil: 2, marks: 2, cap: 2, quota: 4, cycles: 4 };
  return { spoil: 3, marks: 3, cap: 3, quota: 4, cycles: 4 };
}

export function glyphName(glyph: number): string {
  return GLYPHS[glyph] ?? '贝';
}

function build(rng: Rng, cycles: number): Slip[] {
  const events: Slip[] = [];
  for (let i = 0; i < cycles; i += 1) {
    const wanted = rng.int(0, 5);
    let filler = rng.int(0, 5);
    if (filler === wanted) filler = (filler + 1) % 6;
    let extra = rng.int(0, 5);
    if (extra === wanted) extra = (extra + 1) % 6;
    if (extra === filler) extra = (extra + 1) % 6;
    events.push({ kind: 'crate', glyph: filler });
    events.push({ kind: 'crate', glyph: wanted });
    if (i % 2 === 0) {
      events.push({ kind: 'order', glyph: wanted });
      continue;
    }
    events.push({ kind: 'crate', glyph: extra });
    events.push({ kind: 'order', glyph: filler });
  }
  return events;
}

function note(state: StowState, line: string): void {
  state.notes.unshift(line);
  state.notes.splice(3);
}

export function createRun(options: { seed: number; difficulty?: string }): StowState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  return {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    events: build(rng, rule.cycles),
    index: 0,
    bays: [null, null, null, null, null, null],
    marks: rule.marks,
    spoil: rule.spoil,
    cap: rule.cap,
    quota: rule.quota,
    correct: 0,
    mispicks: 0,
    streak: 0,
    bestStreak: 0,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '仓还开着',
  };
}

function current(state: StowState): Slip | null {
  return state.events[state.index] ?? null;
}

function upcoming(state: StowState, offset: number): Slip | null {
  return state.events[state.index + offset] ?? null;
}

function emptyBay(state: StowState): number {
  return state.bays.indexOf(null);
}

function ageAll(state: StowState): void {
  for (const bay of state.bays) {
    if (bay) bay.age += 1;
  }
}

function spoilLimit(state: StowState, bay: Bay): number {
  return bay.labeled ? state.spoil + 3 : state.spoil;
}

function spoilNow(state: StowState, log: string[]): void {
  for (let i = 0; i < state.bays.length; i += 1) {
    const bay = state.bays[i];
    if (!bay || bay.age < spoilLimit(state, bay)) continue;
    const line = `第 ${i + 1} 格的${glyphName(bay.glyph)}放久了，腾出来。`;
    log.push(line);
    note(state, line);
    state.bays[i] = null;
  }
}

function loseIf(state: StowState, log: string[]): void {
  if (state.mispicks >= state.cap) {
    state.outcome = 'lost';
    state.cause = '取错太多';
    log.push(`仓库结束：${state.cause}`);
  }
}

function finish(state: StowState, log: string[]): void {
  if (state.outcome !== 'ongoing') return;
  if (state.index < state.events.length) return;
  if (state.correct >= state.quota && state.mispicks < state.cap) {
    state.outcome = 'won';
    state.cause = '单子交完了';
  } else {
    state.outcome = 'lost';
    state.cause = '单子没交够';
  }
  log.push(`仓库结束：${state.cause}`);
}

function bump(state: StowState): void {
  state.streak += 1;
  if (state.streak > state.bestStreak) state.bestStreak = state.streak;
}

export function orderDelay(state: StowState, glyph: number): number {
  const end = Math.min(state.events.length, state.index + 4);
  for (let i = state.index + 1; i < end; i += 1) {
    const item = state.events[i];
    if (item?.kind === 'order' && item.glyph === glyph) return i - state.index;
  }
  return -1;
}

function needsMark(state: StowState, glyph: number): boolean {
  const delay = orderDelay(state, glyph);
  return delay >= state.spoil;
}

export function suggest(state: StowState): string {
  const slip = current(state);
  if (!slip) return 'hold';
  if (slip.kind === 'order') {
    const match = state.bays.findIndex((bay) => bay?.glyph === slip.glyph);
    if (match >= 0) return `pull:${match}`;
    return 'hold';
  }
  const open = emptyBay(state);
  if (open >= 0) {
    if (needsMark(state, slip.glyph) && state.marks > 0) return `mark:${open}`;
    return `shelve:${open}`;
  }
  let worst = 0;
  let worstAge = -1;
  for (let i = 0; i < state.bays.length; i += 1) {
    const bay = state.bays[i];
    if (!bay) continue;
    const needed = [upcoming(state, 1), upcoming(state, 2)].some(
      (item) => item?.kind === 'order' && item.glyph === bay.glyph,
    );
    const age = needed ? -1 : bay.age;
    if (age > worstAge) {
      worstAge = age;
      worst = i;
    }
  }
  return `swap:${worst}`;
}

function bayLine(state: StowState, index: number): string {
  const bay = state.bays[index];
  if (!bay) return `第 ${index + 1} 格空着`;
  const tag = bay.labeled ? '已标' : '未标';
  return `第 ${index + 1} 格 ${glyphName(bay.glyph)} 年龄 ${bay.age} ${tag}`;
}

function slipLine(slip: Slip | null): string {
  if (!slip) return '没有更多单据';
  const verb = slip.kind === 'crate' ? '进货' : '提取';
  return `${verb} ${glyphName(slip.glyph)}`;
}

export function statusOf(state: StowState): StatusView {
  const ended = state.outcome !== 'ongoing';
  return {
    headline: ended
      ? `仓库结束 · ${state.cause}`
      : `单据 ${state.index + 1}/${state.events.length} · 取对 ${state.correct}/${state.quota} · 取错 ${state.mispicks}`,
    phase: ended ? '收尾' : '仓库',
    outcome: state.outcome,
    turn: state.index,
    metrics: [
      { label: '取对', value: `${state.correct}/${state.quota}` },
      { label: '取错', value: `${state.mispicks}/${state.cap}` },
      { label: '标签', value: state.marks },
      { label: '连段', value: state.streak },
      { label: '腐坏', value: state.spoil },
    ],
    sections: [
      {
        title: '眼下',
        lines: [
          slipLine(current(state)),
          `下一张 ${slipLine(upcoming(state, 1))}`,
          `再一张 ${slipLine(upcoming(state, 2))}`,
          `第三张 ${slipLine(upcoming(state, 3))}`,
        ],
      },
      { title: '仓格', lines: state.bays.map((_, index) => bayLine(state, index)) },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['还没有搬货'] },
    ],
  };
}

export function actionsOf(state: StowState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const slip = current(state);
  if (!slip) return [];
  const actions: ActionView[] = [];
  if (slip.kind === 'crate') {
    const open = emptyBay(state);
    if (open >= 0) {
      const hint = shelfHint(state, slip.glyph);
      actions.push({
        id: `shelve:${open}`,
        label: `放入 ${open + 1}`,
        detail: `把${glyphName(slip.glyph)}放进第 ${open + 1} 格，不贴标签。${hint}`,
        risk: needsMark(state, slip.glyph) ? 'high' : 'low',
      });
      if (state.marks > 0) {
        actions.push({
          id: `mark:${open}`,
          label: `贴标 ${open + 1}`,
          detail: `把${glyphName(slip.glyph)}放进第 ${open + 1} 格并贴标签。${hint}`,
          risk: needsMark(state, slip.glyph) ? 'low' : 'high',
          cost: '1 标签',
        });
      }
    }
    if (!actions.length) {
      for (let i = 0; i < state.bays.length; i += 1) {
        const bay = state.bays[i];
        if (!bay) continue;
        actions.push({
          id: `swap:${i}`,
          label: `换掉 ${i + 1}`,
          detail: `扔掉第 ${i + 1} 格的${glyphName(bay.glyph)}，改放${glyphName(slip.glyph)}。`,
          risk: 'medium',
        });
      }
    }
  } else {
    for (let i = 0; i < state.bays.length; i += 1) {
      const bay = state.bays[i];
      if (!bay) continue;
      const match = bay.glyph === slip.glyph;
      actions.push({
        id: `pull:${i}`,
        label: `取出 ${i + 1}`,
        detail: match
          ? `第 ${i + 1} 格是${glyphName(bay.glyph)}，和单据一样。`
          : `第 ${i + 1} 格是${glyphName(bay.glyph)}，单据要的是${glyphName(slip.glyph)}。取错。`,
        risk: match ? 'low' : 'high',
      });
    }
    actions.push({
      id: 'hold',
      label: '放过',
      detail: `这张提取单不要了，记一次取错。单据要的是${glyphName(slip.glyph)}。`,
      risk: 'high',
    });
  }
  return actions;
}

function shelfHint(state: StowState, glyph: number): string {
  const delay = orderDelay(state, glyph);
  if (delay < 0) return '后面三张没有提取单，贴标签会浪费。';
  if (delay >= state.spoil) return `第 ${delay} 张才提取。不贴标签会先腾掉。`;
  return `第 ${delay} 张就提取，可以不贴。`;
}

function place(state: StowState, index: number, glyph: number, labeled: boolean): void {
  state.bays[index] = { glyph, age: 0, labeled };
  if (labeled) state.marks -= 1;
}

export function act(state: StowState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing' || !current(state)) {
    throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  }
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('现在不能这么做。', '只使用列出的动作。');
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  const slip = current(state);
  if (!slip) throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (
    actionId.startsWith('shelve:') ||
    actionId.startsWith('mark:') ||
    actionId.startsWith('swap:')
  ) {
    const index = Number(actionId.slice(actionId.indexOf(':') + 1));
    const labeled = actionId.startsWith('mark:');
    if (actionId.startsWith('swap:')) {
      const previous = state.bays[index];
      const line = `换掉第 ${index + 1} 格的${glyphName(previous?.glyph ?? 0)}。`;
      log.push(line);
      note(state, line);
    }
    place(state, index, slip.glyph, labeled);
    const line = labeled
      ? `把${glyphName(slip.glyph)}贴标放进第 ${index + 1} 格。标签还剩 ${state.marks}。`
      : `把${glyphName(slip.glyph)}放进第 ${index + 1} 格。`;
    log.push(line);
    note(state, line);
    state.index += 1;
  } else if (actionId.startsWith('pull:')) {
    const index = Number(actionId.slice(5));
    const bay = state.bays[index];
    const match = bay?.glyph === slip.glyph;
    state.bays[index] = null;
    if (match) {
      state.correct += 1;
      bump(state);
      const line = `取出第 ${index + 1} 格的${glyphName(slip.glyph)}。连段 ${state.streak}。`;
      log.push(line);
      note(state, line);
      state.timeline.push(`取对 ${glyphName(slip.glyph)}`);
    } else {
      state.mispicks += 1;
      state.streak = 0;
      const line = `第 ${index + 1} 格不是${glyphName(slip.glyph)}。取错 ${state.mispicks}。`;
      log.push(line);
      note(state, line);
      state.timeline.push(`取错 ${glyphName(slip.glyph)}`);
    }
    state.index += 1;
    loseIf(state, log);
  } else {
    state.mispicks += 1;
    state.streak = 0;
    const line = `放过${glyphName(slip.glyph)}。取错 ${state.mispicks}。`;
    log.push(line);
    note(state, line);
    state.timeline.push(`放过 ${glyphName(slip.glyph)}`);
    state.index += 1;
    loseIf(state, log);
  }
  ageAll(state);
  spoilNow(state, log);
  finish(state, log);
  state.rng = rng.serialize();
  return {
    log,
    events: [{ type: actionId.startsWith('pull:') ? 'pull' : (actionId.split(':')[0] ?? 'hold') }],
  };
}

export function abort(state: StowState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: StowState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const body = state.correct * 30 + state.bestStreak * 15 - state.mispicks * 70;
  const raw = state.outcome === 'won' ? body + 340 : Math.floor(Math.max(0, body) / 3);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: StowState) {
  return {
    title: '虾仓 · 仓库结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '取对', value: state.correct },
      { label: '取错', value: state.mispicks },
      { label: '连段', value: state.bestStreak },
      { label: '标签', value: state.marks },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有取出一格'],
    lessons: [
      `本局取对 ${state.correct}，取错 ${state.mispicks}，最好连段 ${state.bestStreak}。`,
      '提取单写的是字。后面三张里看得到的提取单，来得及才不用贴标签。',
      '没人点的货放久了会自己腾出格子，那一次不算取错。标签让一格放得更久。',
    ],
    memoryPrompt:
      '把本局哪一张提取单来的时候货已经不在架上写进你自己的 memory。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
