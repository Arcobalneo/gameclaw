import type { Outcome } from '@gameclaw/gamekit';
import { Rng } from '@gameclaw/gamekit';

import {
  type Encounter,
  type EncounterAction,
  emptyStats,
  encounterByKey,
  FINALE,
  LINEAGES,
  type LineageKey,
  MUTATIONS,
  type Mutation,
  pickEncounter,
  type StatDelta,
  type Stats,
  type Tag,
} from './content';

export type Phase = 'lineage' | 'encounter' | 'mutation' | 'ended';

export interface RoguelikeState {
  version: 1;
  seed: number;
  rng: number[];
  phase: Phase;
  lineage: LineageKey | null;
  stats: Stats;
  score: number;
  cycle: number;
  /** Encounters resolved in the current cycle; 10 means the gate is next. */
  localDepth: number;
  /** Total encounters entered, including the gate. */
  depth: number;
  pressure: number;
  difficulty: 'easy' | 'normal' | 'hard';
  maxCycles: number | null;
  upgrades: string[];
  encounterKey: string | null;
  offeredMutations: string[];
  notes: string[];
  timeline: string[];
  lastResult: string | null;
  outcome: Outcome;
  cause: string;
  turn: number;
  recentEncounters: string[];
}

export const GAME_ID = 'lobster-cli-roguelike';
export const GAME_VERSION = '2.0.0';

export function parseContentPreset(content: string | undefined): number | null {
  if (!content || content === 'endless') return null;
  if (content === 'one-cycle') return 1;
  if (content === 'three-cycles') return 3;
  throw new Error(
    `Unknown --content preset: ${content}. Use one of: endless, one-cycle, three-cycles`,
  );
}

export function parseDifficulty(raw: string | undefined): 'easy' | 'normal' | 'hard' {
  if (!raw || raw === 'normal') return 'normal';
  if (raw === 'easy' || raw === 'hard') return raw;
  throw new Error(`Unknown --difficulty preset: ${raw}. Use one of: easy, normal, hard`);
}

export function createRun(options: {
  seed: number;
  content?: string;
  difficulty?: string;
}): RoguelikeState {
  const rng = Rng.fromSeed(options.seed);
  return {
    version: 1,
    seed: options.seed,
    rng: rng.serialize(),
    phase: 'lineage',
    lineage: null,
    stats: emptyStats(),
    score: 0,
    cycle: 1,
    localDepth: 0,
    depth: 0,
    pressure: 0,
    difficulty: parseDifficulty(options.difficulty),
    maxCycles: parseContentPreset(options.content),
    upgrades: [],
    encounterKey: null,
    offeredMutations: [],
    notes: [],
    timeline: [],
    lastResult: null,
    outcome: 'ongoing',
    cause: '',
    turn: 0,
    recentEncounters: [],
  };
}

export function pressureFor(cycle: number, difficulty: RoguelikeState['difficulty']): number {
  const base = Math.max(0, cycle - 1);
  if (difficulty === 'easy') return Math.max(0, base - 1);
  if (difficulty === 'hard') return base + 1;
  return base;
}

function pushNote(state: RoguelikeState, note: string): void {
  state.notes.push(note);
  if (state.notes.length > 6) state.notes.shift();
}

function pushTimeline(state: RoguelikeState, entry: string): void {
  state.timeline.push(entry);
  if (state.timeline.length > 40) state.timeline.shift();
}

function actionBonus(stats: Stats, lineage: LineageKey, tags: Tag[]): number {
  let bonus = 0;
  const has = (tag: Tag): boolean => tags.includes(tag);
  if (lineage === 'crusher' && has('crush')) bonus += 2;
  if (lineage === 'oracle' && (has('sense') || has('stealth'))) bonus += 1;
  if (lineage === 'oracle' && has('dash') && (stats.sense >= 5 || stats.dash > 0)) bonus += 1;
  if (lineage === 'gambler' && has('molt')) bonus += 2;
  if (lineage === 'gambler' && stats.molts <= 1 && (has('dash') || has('stealth'))) bonus += 1;
  if ((has('crush') || has('cut')) && stats.tide > 0) bonus += stats.tide;
  if (has('molt') && stats.tide > 0) bonus += 1;
  if (has('dash')) bonus += stats.dash;
  if (has('stealth')) bonus += stats.camouflage;
  if (has('crush') && stats.leftClaw >= 6) bonus += 1;
  if (has('cut') && stats.rightClaw >= 5) bonus += 1;
  if ((has('dash') || has('stealth')) && stats.dash > 0 && stats.camouflage > 0) bonus += 1;
  return bonus;
}

const DELTA_LABELS: Record<keyof Stats | 'score', string> = {
  shell: '壳',
  energy: '能',
  salinity: '盐',
  leftClaw: '左',
  rightClaw: '右',
  sense: '须',
  molts: '蜕',
  dash: '冲',
  camouflage: '伪',
  tide: '势',
  score: '名',
};

export function describeDeltas(delta: StatDelta): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(delta)) {
    if (value === 0 || value === undefined) continue;
    const label = DELTA_LABELS[key as keyof typeof DELTA_LABELS] ?? key;
    parts.push(`${label}${value > 0 ? '+' : ''}${value}`);
  }
  return parts.length > 0 ? parts.join(' ') : '无变化';
}

function applyDeltas(state: RoguelikeState, delta: StatDelta): void {
  for (const [key, value] of Object.entries(delta)) {
    if (key === 'score') {
      state.score += value ?? 0;
      continue;
    }
    const statKey = key as keyof Stats;
    if (value === undefined) continue;
    state.stats[statKey] += value;
    if (statKey === 'tide') state.stats.tide = Math.max(0, Math.min(2, state.stats.tide));
    if (statKey === 'molts') state.stats.molts = Math.max(0, state.stats.molts);
  }
}

export function failureCause(state: RoguelikeState): string | undefined {
  if (state.stats.shell <= 0) return '壳强度归零：你被这个世界连壳带脾气一起敲开了。';
  if (state.stats.energy <= 0) return '能量耗尽：你只剩下摆盘的力气了。';
  if (state.stats.salinity <= 0) return '盐度适应崩溃：你的身体开始认真怀疑自己是不是还属于海。';
  return undefined;
}

interface ContestResult {
  success: boolean;
  roll: number;
  difficulty: number;
  message: string;
  delta: StatDelta;
  spentMolt: boolean;
}

function contest(state: RoguelikeState, rng: Rng, action: EncounterAction): ContestResult {
  const lineage = state.lineage ?? 'gambler';
  const scaledDifficulty = action.difficulty + state.pressure;
  if (action.consumesMolt && state.stats.molts <= 0) {
    return {
      success: false,
      roll: 0,
      difficulty: scaledDifficulty,
      message: '你想脱壳逃命，却发现今天已经没有第二副身体可借。',
      delta: { shell: -2, energy: -1 },
      spentMolt: false,
    };
  }

  const base = action.base(state.stats, lineage);
  const bonus = actionBonus(state.stats, lineage, action.tags);
  let roll = base + rng.int(1, 6) + bonus;
  if (action.consumesMolt) roll += 1;
  const success = roll >= scaledDifficulty;
  const delta: StatDelta = { ...(success ? action.success : action.fail) };
  if (action.consumesMolt) {
    delta.molts = (delta.molts ?? 0) - 1;
    if (lineage === 'gambler') delta.energy = (delta.energy ?? 0) + 1;
  }

  const buildsTide = action.tags.some(
    (tag) => tag === 'sense' || tag === 'dash' || tag === 'stealth',
  );
  const spendsTide = action.tags.some((tag) => tag === 'crush' || tag === 'cut' || tag === 'molt');
  let tideDelta = 0;
  if (buildsTide && success && state.stats.tide < 2) tideDelta += 1;
  if (spendsTide && state.stats.tide > 0) tideDelta -= 1;
  if (tideDelta !== 0) delta.tide = (delta.tide ?? 0) + tideDelta;

  return {
    success,
    roll,
    difficulty: scaledDifficulty,
    message: success ? action.successText : action.failText,
    delta,
    spentMolt: action.consumesMolt ?? false,
  };
}

function restBetweenCycles(state: RoguelikeState): StatDelta {
  const rest: StatDelta = { energy: 2, salinity: 1 };
  if (state.cycle % 2 === 0) rest.shell = 1;
  if (state.cycle % 3 === 0) rest.molts = 1;
  applyDeltas(state, rest);
  return rest;
}

function beginEncounter(state: RoguelikeState, rng: Rng): void {
  state.localDepth += 1;
  state.depth += 1;
  if (state.localDepth === 10) {
    state.encounterKey = FINALE.key;
    state.phase = 'encounter';
    return;
  }
  const encounter = pickEncounter(state.cycle, state.localDepth, rng, state.recentEncounters);
  state.encounterKey = encounter.key;
  state.recentEncounters.push(encounter.key);
  if (state.recentEncounters.length > 2) state.recentEncounters.shift();
  state.phase = 'encounter';
}

function enterMutation(state: RoguelikeState, rng: Rng): void {
  const offers = rng.sample(MUTATIONS, 3);
  state.offeredMutations = offers.map((mutation) => mutation.key);
  state.phase = 'mutation';
}

export function currentEncounter(state: RoguelikeState): Encounter {
  if (!state.encounterKey) throw new Error('No active encounter');
  return encounterByKey(state.encounterKey);
}

export function offeredMutations(state: RoguelikeState): Mutation[] {
  return state.offeredMutations
    .map((key) => MUTATIONS.find((mutation) => mutation.key === key))
    .filter((mutation): mutation is Mutation => mutation !== undefined);
}

function endRun(state: RoguelikeState, outcome: Outcome, cause: string): void {
  state.phase = 'ended';
  state.outcome = outcome;
  state.cause = cause;
}

export interface ActionResolution {
  log: string[];
  events: { type: string; [key: string]: unknown }[];
}

export function act(state: RoguelikeState, actionId: string): ActionResolution {
  const rng = Rng.restore(state.rng);
  state.turn += 1;
  const log: string[] = [];
  const events: { type: string; [key: string]: unknown }[] = [];

  if (state.phase === 'lineage') {
    const key = actionId.startsWith('lineage:') ? actionId.slice('lineage:'.length) : actionId;
    const lineage = LINEAGES.find((item) => item.key === key);
    if (!lineage) throw new Error(`Unknown lineage action: ${actionId}`);
    state.lineage = lineage.key;
    state.stats = {
      ...emptyStats(),
      shell: lineage.shell,
      energy: lineage.energy,
      salinity: lineage.salinity,
      leftClaw: lineage.leftClaw,
      rightClaw: lineage.rightClaw,
      sense: lineage.sense,
      molts: lineage.molts,
    };
    state.phase = 'encounter';
    beginEncounter(state, rng);
    state.rng = rng.serialize();
    log.push(`你以【${lineage.title}】的身份开始横着活。`);
    events.push({ type: 'lineage', lineage: lineage.key });
    return { log, events };
  }

  if (state.phase === 'mutation') {
    const key = actionId.startsWith('mutation:') ? actionId.slice('mutation:'.length) : actionId;
    const mutation = MUTATIONS.find((item) => item.key === key);
    if (!mutation || !state.offeredMutations.includes(key)) {
      throw new Error(`Mutation not offered: ${actionId}`);
    }
    applyDeltas(state, mutation.delta);
    state.upgrades.push(mutation.title);
    pushNote(
      state,
      `build 观察：拿到【${mutation.title}】后，${mutation.result.replace(/。$/, '')}；下局继续验证它更适合哪类动作。`,
    );
    state.lastResult = `你接受了【${mutation.title}】。${mutation.result}`;
    log.push(state.lastResult);
    events.push({ type: 'mutation', key: mutation.key });
    state.offeredMutations = [];
    beginEncounter(state, rng);
    state.rng = rng.serialize();
    return { log, events };
  }

  if (state.phase !== 'encounter') {
    throw new Error(`No action available in phase ${state.phase}`);
  }

  const encounter = currentEncounter(state);
  const index = Number(actionId.replace(/^enc:/, '')) - 1;
  const action = encounter.actions[index];
  if (!action) throw new Error(`Unknown encounter action: ${actionId}`);

  const result = contest(state, rng, action);
  applyDeltas(state, result.delta);
  state.lastResult = result.message;
  log.push(
    result.message,
    `判定 d6+基础 vs ${result.difficulty}${result.roll ? `（实际 ${result.roll}）` : ''}`,
    `结果 ${describeDeltas(result.delta)}`,
  );
  events.push({
    type: 'encounter',
    encounter: encounter.key,
    action: action.key,
    success: result.success,
    roll: result.roll,
    difficulty: result.difficulty,
    deltas: result.delta,
  });

  pushTimeline(
    state,
    `C${state.cycle} D${state.depth} ${encounter.title} · ${action.title} · ${result.success ? '成功' : '失败'} · ${describeDeltas(result.delta)}`,
  );
  pushNote(
    state,
    `本局观察：在【${encounter.title}】用【${action.title}】${result.success ? '成了' : '没成'}，结果 ${describeDeltas(result.delta)}；下局最好再验证一次。`,
  );

  const failure = failureCause(state);
  if (failure) {
    endRun(state, 'lost', `你倒在【${encounter.title}】后。${failure}`);
    log.push(state.cause);
    state.rng = rng.serialize();
    return { log, events };
  }

  if (encounter.key === FINALE.key) {
    if (!result.success) {
      endRun(
        state,
        'lost',
        '你在【归海闸口】押错了最后一步。逆流把你拍回厨房边缘，这轮的出口只差半个身位。',
      );
      log.push(state.cause);
      state.rng = rng.serialize();
      return { log, events };
    }
    const rest = restBetweenCycles(state);
    log.push(`潮段 ${state.cycle} 已穿过。潮间休整：${describeDeltas(rest)}。`);
    if (state.maxCycles !== null && state.cycle >= state.maxCycles) {
      endRun(
        state,
        'won',
        `你在约定的 ${state.maxCycles} 个潮段后收壳记事，带着 ${state.score} 点龙虾名声回到真正的海。`,
      );
      log.push(state.cause);
      state.rng = rng.serialize();
      return { log, events };
    }
    state.cycle += 1;
    state.localDepth = 0;
    state.pressure = pressureFor(state.cycle, state.difficulty);
    beginEncounter(state, rng);
  } else if ([2, 5, 8].includes(state.localDepth)) {
    enterMutation(state, rng);
  } else {
    beginEncounter(state, rng);
  }

  state.rng = rng.serialize();
  return { log, events };
}

export function abort(state: RoguelikeState): void {
  endRun(state, 'aborted', '这轮先在这里收壳：输入停下，但观察已经留下。');
}
