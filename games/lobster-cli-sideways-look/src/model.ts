import type { Outcome } from '@gameclaw/gamekit';

/** Where the run is: picking a case, walking through one, or finished. */
export type Phase = 'case-select' | 'exploring' | 'ended';

/**
 * `Outcome` is the shared win/loss vocabulary. `Ending` keeps the finer story
 * so a wrong-record extraction can be told apart from a collapse.
 */
export type Ending =
  | 'none'
  | 'escaped'
  | 'wrong-record'
  | 'lost-nerve'
  | 'lost-dread'
  | 'aborted';

export type ObjectiveQuality = 'unknown' | 'uncertain' | 'verified';

/** A named observation produced by an event and recordable by the player. */
export interface Phenomenon {
  clueId: string;
  clueText: string;
  title: string;
  witness: string;
  ascii: string[];
}

/** One resolved turn, kept for the timeline and the settlement report. */
export interface JournalEntry {
  turn: number;
  action: string;
  roomId: string;
  roomName: string;
  result: string;
  focus: number;
  nerve: number;
  dread: number;
  evidence: number;
}

/**
 * The whole run. Everything here is plain JSON; `rng` is the four-word sfc32
 * state restored before every action so a seed and an action list replay.
 */
export interface LookState {
  version: 1;
  seed: number;
  rng: number[];
  phase: Phase;
  caseId: string | null;
  caseName: string;
  roomId: string | null;
  requiredEvidence: number;
  turn: number;
  focus: number;
  nerve: number;
  dread: number;
  evidence: number;
  objectiveCollected: boolean;
  objectiveQuality: ObjectiveQuality;
  recordedClues: string[];
  findings: string[];
  currentPhenomenon: Phenomenon | null;
  latestAscii: string[];
  latestWitness: string | null;
  latestResult: string;
  lastEventId: string | null;
  history: JournalEntry[];
  outcome: Outcome;
  ending: Ending;
  cause: string;
}
