import ROT from 'rot-js';
import type { ActionKind, ActionOption, CaseConfig, CurrentPhenomenon, EventConfig, GameState, RoomConfig } from './model.js';
import { getCaseConfig, getCaseEvents } from './content.js';

function nowRunId(caseId: string): string {
  return `${caseId}-${Date.now().toString(36)}`;
}

function choice<T>(items: T[]): T {
  return items[Math.floor(ROT.RNG.getUniform() * items.length)];
}

export function createState(slot: number, caseId: string, seed: number): GameState {
  const caseConfig = getCaseConfig(caseId);
  ROT.RNG.setSeed(seed);
  const state: GameState = {
    version: 1,
    slot,
    runId: nowRunId(caseId),
    seed,
    rngState: ROT.RNG.getState() as number[],
    caseId,
    caseName: caseConfig.chineseName,
    roomId: caseConfig.startingRoom,
    turn: 0,
    focus: 6,
    nerve: 8,
    dread: 0,
    evidence: 0,
    objectiveCollected: false,
    objectiveQuality: 'unknown',
    recordedClues: [],
    findings: [],
    latestAscii: caseConfig.defaultAscii,
    history: [],
    outcome: 'ongoing'
  };
  return state;
}

export function getRoom(caseConfig: CaseConfig, roomId: string): RoomConfig {
  const room = caseConfig.rooms.find((item) => item.id === roomId);
  if (!room) throw new Error(`Unknown room ${roomId} in case ${caseConfig.id}`);
  return room;
}

function eventPool(caseId: string, trigger: ActionKind, room: RoomConfig): EventConfig[] {
  const base = getCaseEvents(caseId).filter(
    (event) => event.trigger === trigger && event.roomTags.some((tag) => room.tags.includes(tag))
  );
  if (base.length > 0) return base;
  // Fallback: any event for this trigger (room has no tagged events yet)
  return getCaseEvents(caseId).filter((event) => event.trigger === trigger);
}

function applyDeltas(state: GameState, event: EventConfig, clueVisible = true): CurrentPhenomenon | undefined {
  state.focus = Math.max(0, Math.min(9, state.focus + event.focusDelta));
  state.nerve = Math.max(0, Math.min(10, state.nerve + event.nerveDelta));
  state.dread = Math.max(0, Math.min(10, state.dread + event.dreadDelta));
  state.evidence = Math.max(0, state.evidence + event.evidenceDelta);
  state.latestAscii = event.ascii;
  state.latestWitness = event.witness;
  if (clueVisible) {
    return {
      clueId: event.clueId,
      clueText: event.clueText,
      title: event.title,
      witness: event.witness,
      ascii: event.ascii
    };
  }
  return undefined;
}

function collapseIfNeeded(state: GameState): void {
  if (state.nerve <= 0 || state.dread >= 10) {
    state.outcome = 'lost';
    state.latestResult = state.nerve <= 0 ? 'You finally looked too long. Something in the panels finished the job.' : 'Dread hit the ceiling; the whole side-view locked into one impossible stare.';
  }
}

export function computeActions(state: GameState): ActionOption[] {
  const caseConfig = getCaseConfig(state.caseId);
  const room = getRoom(caseConfig, state.roomId);
  const actions: ActionOption[] = [];
  for (const target of room.inspectTargets.slice(0, 2)) {
    actions.push({ id: `inspect:${target.id}`, kind: 'inspect', target: target.id, label: `Inspect ${target.label}`, risk: 'information for pressure' });
  }
  for (const exit of room.exits) {
    const nextRoom = getRoom(caseConfig, exit);
    actions.push({ id: `move:${exit}`, kind: 'move', target: exit, label: `Move to ${nextRoom.name}`, risk: 'reposition; room state may worsen' });
  }
  for (const interactable of room.interactables) {
    if (interactable.effect === 'objective' && state.objectiveCollected) continue;
    actions.push({ id: `interact:${interactable.id}`, kind: 'interact', target: interactable.id, label: `Interact ${interactable.label}`, risk: interactable.effect === 'objective' ? 'grab before you know enough and you may leave with the wrong record' : 'stabilize the room, but lose initiative' });
  }
  if (state.currentPhenomenon && !state.recordedClues.includes(state.currentPhenomenon.clueId)) {
    actions.push({ id: 'record:current', kind: 'record', label: `Record ${state.currentPhenomenon.title}`, risk: 'safe if you named it correctly' });
  }
  actions.push({ id: 'brace', kind: 'brace', label: 'Brace and breathe', risk: 'recover composure, spend tempo' });
  if (room.isExit) {
    actions.push({ id: 'extract', kind: 'extract', label: 'Attempt extraction', risk: 'leave now with whatever truth you currently hold' });
  }
  return actions;
}

function renderViewLines(caseConfig: CaseConfig, room: RoomConfig, state: GameState): string[] {
  const clue = state.currentPhenomenon;
  return [...room.panels, '---', ...(clue ? clue.ascii : caseConfig.defaultAscii)];
}

export function getSnapshot(state: GameState): { caseConfig: CaseConfig; actions: ActionOption[]; viewLines: string[] } {
  const caseConfig = getCaseConfig(state.caseId);
  const room = getRoom(caseConfig, state.roomId);
  return { caseConfig, actions: computeActions(state), viewLines: renderViewLines(caseConfig, room, state) };
}

export function applyAction(state: GameState, actionId: string): GameState {
  if (state.outcome !== 'ongoing') {
    throw new Error(`Run already ended with outcome=${state.outcome}. Use recap/ascii or start a new run.`);
  }
  ROT.RNG.setState(state.rngState as any);
  const caseConfig = getCaseConfig(state.caseId);
  const room = getRoom(caseConfig, state.roomId);
  const actions = computeActions(state);
  const action = actions.find((item) => item.id === actionId);
  if (!action) {
    throw new Error(`Illegal action for current state: ${actionId}`);
  }
  state.turn += 1;
  let result = '';
  if (action.kind === 'inspect') {
    const event = choice(eventPool(state.caseId, 'inspect', room));
    state.currentPhenomenon = applyDeltas(state, event, true);
    result = `${event.flavor} You focus on ${action.target} and the case offers a name: ${event.title}.`;
    state.findings.push(event.title);
  } else if (action.kind === 'move') {
    state.roomId = action.target!;
    const nextRoom = getRoom(caseConfig, state.roomId);
    const event = choice(eventPool(state.caseId, 'move', nextRoom));
    applyDeltas(state, event, false);
    state.currentPhenomenon = undefined;
    result = `${event.flavor} You slide into ${nextRoom.name} and realize the geometry stayed behind just long enough to be wrong.`;
  } else if (action.kind === 'interact') {
    const interactable = room.interactables.find((item) => item.id === action.target);
    if (interactable?.effect === 'objective') {
      state.objectiveCollected = true;
      state.objectiveQuality = state.evidence >= caseConfig.requiredEvidence ? 'verified' : 'uncertain';
      state.dread = Math.min(10, state.dread + 2);
      result = state.objectiveQuality === 'verified'
        ? 'You take the right folder, because enough of the station has already confessed itself to you.'
        : 'You take a folder too early. It feels right only because the wrong one was ready for your hand.';
    } else {
      const event = choice(eventPool(state.caseId, 'interact', room));
      applyDeltas(state, event, false);
      result = `${event.flavor} The room reacts to being touched.`;
    }
  } else if (action.kind === 'record') {
    if (!state.currentPhenomenon) {
      throw new Error('No current phenomenon to record.');
    }
    state.recordedClues.push(state.currentPhenomenon.clueId);
    state.evidence += 1;
    state.latestAscii = state.currentPhenomenon.ascii;
    state.latestWitness = state.currentPhenomenon.witness;
    result = `You record ${state.currentPhenomenon.title}. Writing it down hurts less than staring at it.`;
  } else if (action.kind === 'brace') {
    state.focus = Math.min(9, state.focus + 2);
    state.nerve = Math.min(10, state.nerve + 1);
    state.dread = Math.max(0, state.dread - 1);
    result = 'You stop treating the side-view like a dare. Breathing buys you one more clean decision.';
  } else if (action.kind === 'extract') {
    if (!state.objectiveCollected) {
      state.dread = Math.min(10, state.dread + 1);
      result = 'You find the exit, but the station will not let you leave empty-handed.';
    } else if (state.objectiveQuality === 'verified') {
      state.outcome = 'escaped';
      result = 'You leave with the right record and enough notes to explain what the station tried to hide.';
    } else {
      state.outcome = 'wrong-record';
      result = 'You escape, but the folder in your grip is almost certainly the one the station wanted you to carry out.';
    }
  }
  state.latestResult = result;
  state.history.push({
    turn: state.turn,
    action: action.id,
    roomId: state.roomId,
    roomName: getRoom(caseConfig, state.roomId).name,
    result,
    dread: state.dread,
    nerve: state.nerve,
    evidence: state.evidence,
    witness: state.latestWitness
  });
  collapseIfNeeded(state);
  state.rngState = ROT.RNG.getState() as number[];
  return state;
}
