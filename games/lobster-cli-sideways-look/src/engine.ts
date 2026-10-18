/**
 * Sideways Look rules engine.
 *
 * One action = one CLI call. The engine owns case state, room movement, event
 * resolution and the three ways a run can end: escape with a verified record,
 * leave with the wrong record, or stop being able to look.
 */

import type { ActionResult, CreateOptions, GameEvent } from '@gameclaw/gamekit';
import { GameError, Rng } from '@gameclaw/gamekit';

import {
  CASES,
  type CaseConfig,
  caseById,
  type EventConfig,
  type EventTrigger,
  eventsFor,
  type RoomConfig,
  roomById,
} from './content';
import type { Ending, JournalEntry, LookState, Phenomenon } from './model';

export const GAME_ID = 'lobster-cli-sideways-look';
export const GAME_VERSION = '2.0.0';

export const MAX_FOCUS = 9;
export const MAX_NERVE = 10;
export const MAX_DREAD = 10;
export const INSPECT_FOCUS_COST = 1;
export const STARTING_FOCUS = 6;
export const STARTING_NERVE = 8;

const TIMELINE_LIMIT = 80;
const FINDING_LIMIT = 12;

type MeterKey = 'focus' | 'nerve' | 'dread' | 'evidence';

const METER_LABELS: Record<MeterKey, string> = {
  focus: '专注',
  nerve: '神经',
  dread: '恐惧',
  evidence: '证据',
};

const METER_KEYS = Object.keys(METER_LABELS) as MeterKey[];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function metersOf(state: LookState): Record<MeterKey, number> {
  return {
    focus: state.focus,
    nerve: state.nerve,
    dread: state.dread,
    evidence: state.evidence,
  };
}

function shiftOf(before: Record<MeterKey, number>, state: LookState): Record<MeterKey, number> {
  return {
    focus: state.focus - before.focus,
    nerve: state.nerve - before.nerve,
    dread: state.dread - before.dread,
    evidence: state.evidence - before.evidence,
  };
}

function describeShift(before: Record<MeterKey, number>, state: LookState): string {
  const shift = shiftOf(before, state);
  const parts: string[] = [];
  for (const key of METER_KEYS) {
    const value = shift[key];
    if (value === 0) continue;
    parts.push(`${METER_LABELS[key]}${value > 0 ? '+' : ''}${value}`);
  }
  return parts.length > 0 ? parts.join(' ') : '数值无变化';
}

function emptyState(seed: number): LookState {
  return {
    version: 1,
    seed,
    rng: [],
    phase: 'case-select',
    caseId: null,
    caseName: '',
    roomId: null,
    requiredEvidence: 0,
    turn: 0,
    focus: STARTING_FOCUS,
    nerve: STARTING_NERVE,
    dread: 0,
    evidence: 0,
    objectiveCollected: false,
    objectiveQuality: 'unknown',
    recordedClues: [],
    findings: [],
    currentPhenomenon: null,
    latestAscii: [],
    latestWitness: null,
    latestResult: '尚未选择副本。先 choose:<case-id>，或者用 new --content <case-id> 直接进入。',
    lastEventId: null,
    history: [],
    outcome: 'ongoing',
    ending: 'none',
    cause: '',
  };
}

function enterCase(state: LookState, caseConfig: CaseConfig): void {
  state.caseId = caseConfig.id;
  state.caseName = caseConfig.chineseName;
  state.roomId = caseConfig.startingRoom;
  state.requiredEvidence = caseConfig.requiredEvidence;
  state.phase = 'exploring';
  state.currentPhenomenon = null;
  state.latestAscii = [...caseConfig.defaultAscii];
  state.latestWitness = null;
  state.objectiveCollected = false;
  state.objectiveQuality = 'unknown';
  state.latestResult = `你横着走进${caseConfig.chineseName}。先 inspect，再决定要不要 record。`;
}

export function createRun(options: CreateOptions): LookState {
  const rng = Rng.fromSeed(options.seed);
  const state = emptyState(options.seed);
  state.rng = rng.serialize();

  if (options.content !== undefined) {
    const caseConfig = caseById(options.content);
    if (!caseConfig) {
      throw new GameError(
        'USAGE',
        `Unknown --content case: ${options.content}`,
        `Use one of: ${CASES.map((item) => item.id).join(', ')}`,
      );
    }
    enterCase(state, caseConfig);
  }
  return state;
}

export function activeCase(state: LookState): CaseConfig {
  const caseConfig = caseById(state.caseId);
  if (!caseConfig) {
    throw new GameError('INTERNAL', 'The run has no active case.');
  }
  return caseConfig;
}

export function caseOf(state: LookState): CaseConfig | null {
  return caseById(state.caseId) ?? null;
}

export function activeRoom(state: LookState): RoomConfig {
  const caseConfig = activeCase(state);
  if (!state.roomId) throw new GameError('INTERNAL', 'The run has no active room.');
  return roomById(caseConfig, state.roomId);
}

export function roomOf(state: LookState): RoomConfig | null {
  const caseConfig = caseOf(state);
  if (!caseConfig || !state.roomId) return null;
  try {
    return roomById(caseConfig, state.roomId);
  } catch {
    return null;
  }
}

function phenomenonOf(event: EventConfig): Phenomenon {
  return {
    clueId: event.clueId,
    clueText: event.clueText,
    title: event.title,
    witness: event.witness,
    ascii: [...event.ascii],
  };
}

function syncObjective(state: LookState): void {
  if (!state.objectiveCollected) {
    state.objectiveQuality = 'unknown';
    return;
  }
  state.objectiveQuality = state.evidence >= state.requiredEvidence ? 'verified' : 'uncertain';
}

function applyEvent(state: LookState, event: EventConfig): void {
  state.focus = clamp(state.focus + event.focusDelta, 0, MAX_FOCUS);
  state.nerve = clamp(state.nerve + event.nerveDelta, 0, MAX_NERVE);
  state.dread = clamp(state.dread + event.dreadDelta, 0, MAX_DREAD);
  if (event.evidenceDelta !== 0) {
    state.evidence = Math.max(0, state.evidence + event.evidenceDelta);
    syncObjective(state);
  }
  state.latestAscii = [...event.ascii];
  state.latestWitness = event.witness;
  state.lastEventId = event.id;
}

function pushFinding(state: LookState, finding: string): void {
  if (!state.findings.includes(finding)) state.findings.push(finding);
  if (state.findings.length > FINDING_LIMIT) state.findings.shift();
}

function pushTimeline(state: LookState, action: string, result: string): void {
  const room = roomOf(state);
  const entry: JournalEntry = {
    turn: state.turn + 1,
    action,
    roomId: state.roomId ?? '',
    roomName: room?.name ?? '',
    result,
    focus: state.focus,
    nerve: state.nerve,
    dread: state.dread,
    evidence: state.evidence,
  };
  state.history.push(entry);
  if (state.history.length > TIMELINE_LIMIT) state.history.shift();
}

function endRun(state: LookState, outcome: 'won' | 'lost', ending: Ending, cause: string): void {
  state.outcome = outcome;
  state.ending = ending;
  state.cause = cause;
  state.phase = 'ended';
}

/** Applies the two hard failure conditions after every action. */
function settleIfSpent(state: LookState): string | null {
  if (state.outcome !== 'ongoing') return null;
  if (state.nerve <= 0) {
    endRun(
      state,
      'lost',
      'lost-nerve',
      '神经归零：你还在看，但已经没有人替你处理看见的东西。侧视面板合上之前，房间先一步结束了你。',
    );
    return state.cause;
  }
  if (state.dread >= MAX_DREAD) {
    endRun(
      state,
      'lost',
      'lost-dread',
      '恐惧封顶：侧视不再是观察，而是互相凝视。画面没有动，你却已经不在原来的位置。',
    );
    return state.cause;
  }
  return null;
}

function drawEvent(
  state: LookState,
  rng: Rng,
  trigger: EventTrigger,
  room: RoomConfig,
  preferFresh: boolean,
): EventConfig {
  if (!state.caseId) throw new GameError('INTERNAL', 'Cannot draw an event without a case.');
  const all = eventsFor(state.caseId).filter((event) => event.trigger === trigger);
  const scoped = all.filter((event) => event.roomTags.some((tag) => room.tags.includes(tag)));
  let pool = scoped.length > 0 ? scoped : all;
  if (pool.length === 0) {
    throw new GameError('INTERNAL', `No ${trigger} event exists for case ${state.caseId}.`);
  }
  if (preferFresh) {
    const fresh = pool.filter((event) => !state.recordedClues.includes(event.clueId));
    if (fresh.length > 0) pool = fresh;
  }
  if (state.lastEventId && pool.length > 1) {
    const withoutLast = pool.filter((event) => event.id !== state.lastEventId);
    if (withoutLast.length > 0) pool = withoutLast;
  }
  return rng.pick(pool);
}

function finishAction(
  state: LookState,
  rng: Rng,
  log: string[],
  events: GameEvent[],
): ActionResult {
  state.turn += 1;
  state.rng = rng.serialize();
  return { log, events };
}

function illegal(actionId: string, hint = 'Run `actions` to list the legal ids.'): never {
  throw new GameError('ILLEGAL_ACTION', `Illegal action for the current state: ${actionId}`, hint);
}

function chooseCase(state: LookState, rng: Rng, actionId: string): ActionResult {
  const caseId = actionId.slice('choose:'.length);
  const caseConfig = caseById(caseId);
  if (!caseConfig) {
    throw illegal(
      actionId,
      `Case ids: ${CASES.map((item) => item.id).join(', ')}. Example: choose:sealed-tide-station`,
    );
  }
  enterCase(state, caseConfig);
  const result = state.latestResult;
  pushTimeline(state, actionId, result);
  const log = [
    result,
    `目标：记录至少 ${caseConfig.requiredEvidence} 条证据，取得档案，再从出口撤离。`,
    ...caseConfig.rooms
      .filter((room) => room.isEntry === true)
      .map((room) => `入口：${room.name}。`),
  ];
  return finishAction(state, rng, log, [{ type: 'case', case: caseConfig.id }]);
}

function inspectTarget(state: LookState, rng: Rng, actionId: string): ActionResult {
  const targetId = actionId.slice('inspect:'.length);
  const room = activeRoom(state);
  const target = room.inspectTargets.find((item) => item.id === targetId);
  if (!target) {
    throw illegal(
      actionId,
      `Inspect targets here: ${room.inspectTargets.map((item) => item.id).join(', ')}`,
    );
  }

  const before = metersOf(state);
  state.focus = clamp(state.focus - INSPECT_FOCUS_COST, 0, MAX_FOCUS);
  const fatigued = state.focus === 0;
  const event = drawEvent(state, rng, 'inspect', room, true);
  applyEvent(state, event);
  if (fatigued) state.dread = clamp(state.dread + 1, 0, MAX_DREAD);

  state.currentPhenomenon = phenomenonOf(event);
  pushFinding(state, event.title);
  const shift = describeShift(before, state);
  const result = `你侧眼检查 ${target.label}。${event.flavor} 现象被命名为「${event.title}」。`;
  state.latestResult = result;
  const log = [
    result,
    `目击：${event.witness}`,
    `数值：${shift}${fatigued ? '（专注耗尽，额外恐惧+1）' : ''}`,
  ];

  const collapse = settleIfSpent(state);
  if (collapse) log.push(`本局结束：${collapse}`);
  pushTimeline(state, actionId, result);
  return finishAction(state, rng, log, [
    {
      type: 'inspect',
      target: target.id,
      event: event.id,
      clueId: event.clueId,
      severity: event.severity,
      shift: shiftOf(before, state),
    },
  ]);
}

function moveRoom(state: LookState, rng: Rng, actionId: string): ActionResult {
  const targetId = actionId.slice('move:'.length);
  const from = activeRoom(state);
  if (!from.exits.includes(targetId)) {
    throw illegal(actionId, `Exits here: ${from.exits.join(', ')}`);
  }
  const before = metersOf(state);
  state.roomId = targetId;
  const target = activeRoom(state);
  const event = drawEvent(state, rng, 'move', target, false);
  applyEvent(state, event);
  state.currentPhenomenon = null;

  const shift = describeShift(before, state);
  const result = `你横着移向 ${target.name}。${event.flavor}`;
  state.latestResult = result;
  const log = [result, `目击：${event.witness}`, `数值：${shift}`];

  const collapse = settleIfSpent(state);
  if (collapse) log.push(`本局结束：${collapse}`);
  pushTimeline(state, actionId, result);
  return finishAction(state, rng, log, [
    {
      type: 'move',
      from: from.id,
      to: target.id,
      event: event.id,
      severity: event.severity,
      shift: shiftOf(before, state),
    },
  ]);
}

function interactWith(state: LookState, rng: Rng, actionId: string): ActionResult {
  const targetId = actionId.slice('interact:'.length);
  const room = activeRoom(state);
  const item = room.interactables.find((entry) => entry.id === targetId);
  if (!item) {
    throw illegal(
      actionId,
      `Interactables here: ${room.interactables.map((entry) => entry.id).join(', ')}`,
    );
  }
  const before = metersOf(state);
  const events: GameEvent[] = [];

  if (item.effect === 'objective') {
    if (state.objectiveCollected) {
      throw illegal(actionId, 'The objective is already in your grip.');
    }
    state.objectiveCollected = true;
    syncObjective(state);
    state.dread = clamp(state.dread + 2, 0, MAX_DREAD);
    const shift = describeShift(before, state);
    const result =
      state.objectiveQuality === 'verified'
        ? `你取走目标档案（${item.label}）。证据够了，这份档案对得上你看见的东西。`
        : `你取走目标档案（${item.label}）。它还只是 uncertain：证据 ${state.evidence}/${state.requiredEvidence}，不够让档案承认你。`;
    state.latestResult = result;
    const log = [result, `数值：${shift}`];
    const collapse = settleIfSpent(state);
    if (collapse) log.push(`本局结束：${collapse}`);
    pushTimeline(state, actionId, result);
    return finishAction(state, rng, log, [
      {
        type: 'interact',
        target: item.id,
        effect: item.effect,
        quality: state.objectiveQuality,
        shift: shiftOf(before, state),
      },
    ]);
  }

  const event = drawEvent(state, rng, 'interact', room, item.effect === 'reveal');
  applyEvent(state, event);
  events.push({
    type: 'interact',
    target: item.id,
    effect: item.effect,
    event: event.id,
    severity: event.severity,
  });

  let result = `你操作「${item.label}」。${event.flavor}`;
  if (item.effect === 'stabilize') {
    state.focus = clamp(state.focus + 1, 0, MAX_FOCUS);
    state.nerve = clamp(state.nerve + 1, 0, MAX_NERVE);
    state.dread = clamp(state.dread - 1, 0, MAX_DREAD);
    result += ' 房间稳了一点。';
  } else {
    state.currentPhenomenon = phenomenonOf(event);
    pushFinding(state, event.title);
    result += ` 它把「${event.title}」暴露在你面前，现在可以 record。`;
  }

  const shift = describeShift(before, state);
  state.latestResult = result;
  const log = [result, `目击：${event.witness}`, `数值：${shift}`];
  const collapse = settleIfSpent(state);
  if (collapse) log.push(`本局结束：${collapse}`);
  pushTimeline(state, actionId, result);
  return finishAction(state, rng, log, events);
}

function recordPhenomenon(state: LookState, rng: Rng, actionId: string): ActionResult {
  const phenomenon = state.currentPhenomenon;
  if (!phenomenon) {
    throw illegal(actionId, 'Inspect a target first; there is no named phenomenon to record.');
  }
  if (state.recordedClues.includes(phenomenon.clueId)) {
    throw illegal(actionId, 'This clue is already in the archive.');
  }
  const before = metersOf(state);
  state.recordedClues.push(phenomenon.clueId);
  state.evidence += 1;
  syncObjective(state);
  pushFinding(state, phenomenon.title);

  const shift = describeShift(before, state);
  const result = `你把「${phenomenon.title}」写进档案。证据 ${state.evidence}/${state.requiredEvidence}。`;
  state.latestResult = result;
  const log = [
    result,
    state.objectiveCollected
      ? state.objectiveQuality === 'verified'
        ? '目标记录已经 verified，可以寻找出口。'
        : '目标记录仍是 uncertain：继续 inspect + record，直到证据达标。'
      : state.evidence >= state.requiredEvidence
        ? '证据已经够了：去取得目标档案，然后从出口撤离。'
        : `还需要 ${Math.max(0, state.requiredEvidence - state.evidence)} 条证据才能验证目标。`,
    `数值：${shift}`,
  ];
  pushTimeline(state, actionId, result);
  return finishAction(state, rng, log, [
    {
      type: 'record',
      clueId: phenomenon.clueId,
      evidence: state.evidence,
      required: state.requiredEvidence,
      quality: state.objectiveQuality,
    },
  ]);
}

function brace(state: LookState, rng: Rng, actionId: string): ActionResult {
  const before = metersOf(state);
  state.focus = clamp(state.focus + 2, 0, MAX_FOCUS);
  state.nerve = clamp(state.nerve + 1, 0, MAX_NERVE);
  state.dread = clamp(state.dread - 1, 0, MAX_DREAD);
  const shift = describeShift(before, state);
  const result = '你停下动作，把侧视面板当成一扇需要呼吸的窗，而不是一场挑战。';
  state.latestResult = result;
  const log = [result, `数值：${shift}`, '本次不触发事件表。'];
  pushTimeline(state, actionId, result);
  return finishAction(state, rng, log, [{ type: 'brace', shift: shiftOf(before, state) }]);
}

function extract(state: LookState, rng: Rng, actionId: string): ActionResult {
  const room = activeRoom(state);
  if (!room.isExit) {
    throw illegal(actionId, 'Extraction is only possible from an exit room.');
  }
  const before = metersOf(state);
  const events: GameEvent[] = [];

  if (!state.objectiveCollected) {
    state.dread = clamp(state.dread + 1, 0, MAX_DREAD);
    const shift = describeShift(before, state);
    const result = '你推了推出门。门没有动：它要一份档案，不是你的决心。';
    state.latestResult = result;
    const log = [result, `数值：${shift}`];
    const collapse = settleIfSpent(state);
    if (collapse) log.push(`本局结束：${collapse}`);
    pushTimeline(state, actionId, result);
    events.push({ type: 'extract', result: 'blocked', shift: shiftOf(before, state) });
    return finishAction(state, rng, log, events);
  }

  syncObjective(state);
  if (state.objectiveQuality === 'verified') {
    const cause = `你在证据 ${state.evidence}/${state.requiredEvidence} 时带着 verified 档案走出${state.caseName}。这份记录对得上你看见过的东西。`;
    endRun(state, 'won', 'escaped', cause);
  } else {
    const cause = `你走出了${state.caseName}，但档案对不上证据（${state.evidence}/${state.requiredEvidence}）。你带出去的是错误记录：它能通过门，却解释不了门后面发生过什么。`;
    endRun(state, 'lost', 'wrong-record', cause);
  }
  state.latestResult = state.cause;
  const log = [state.cause];
  pushTimeline(state, actionId, state.cause);
  events.push({
    type: 'extract',
    result: state.ending,
    evidence: state.evidence,
    required: state.requiredEvidence,
  });
  return finishAction(state, rng, log, events);
}

export function act(state: LookState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing' || state.phase === 'ended') {
    throw new GameError(
      'GAME_OVER',
      `This run already ended with outcome=${state.outcome}.`,
      'Run `recap` for the settlement, or `new --force` to start a new run.',
    );
  }
  const rng = Rng.restore(state.rng);

  if (state.phase === 'case-select') {
    if (!actionId.startsWith('choose:')) {
      throw illegal(
        actionId,
        `Pick a case first. Case ids: ${CASES.map((item) => item.id).join(', ')}`,
      );
    }
    return chooseCase(state, rng, actionId);
  }

  if (actionId === 'record') return recordPhenomenon(state, rng, actionId);
  if (actionId === 'brace') return brace(state, rng, actionId);
  if (actionId === 'extract') return extract(state, rng, actionId);
  if (actionId.startsWith('inspect:')) return inspectTarget(state, rng, actionId);
  if (actionId.startsWith('move:')) return moveRoom(state, rng, actionId);
  if (actionId.startsWith('interact:')) return interactWith(state, rng, actionId);
  throw illegal(actionId);
}

export function abort(state: LookState): void {
  if (state.outcome !== 'ongoing') return;
  state.turn += 1;
  const where = state.caseId ? `${state.caseName} · ${state.roomId ?? '未知房间'}` : '尚未进入副本';
  state.cause = `这轮先在这里收壳（${where}）：输入停下，但观察已经留下。`;
  state.latestResult = state.cause;
  state.ending = 'aborted';
  state.outcome = 'aborted';
  state.phase = 'ended';
}
