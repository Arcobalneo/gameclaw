export type Outcome = 'ongoing' | 'escaped' | 'wrong-record' | 'lost';

export type ActionKind = 'inspect' | 'move' | 'interact' | 'record' | 'brace' | 'extract';

export interface ActionOption {
  id: string;
  kind: ActionKind;
  label: string;
  risk: string;
  target?: string;
}

export interface RoomConfig {
  id: string;
  name: string;
  tags: string[];
  panels: string[];
  inspectTargets: { id: string; label: string; focusCost?: number }[];
  interactables: { id: string; label: string; effect: 'objective' | 'stabilize' | 'reveal' }[];
  exits: string[];
  isEntry?: boolean;
  isExit?: boolean;
  objective?: boolean;
}

export interface CaseConfig {
  id: string;
  name: string;
  chineseName: string;
  summary: string;
  requiredEvidence: number;
  startingRoom: string;
  rooms: RoomConfig[];
  defaultAscii: string[];
}

export interface EventConfig {
  id: string;
  caseId: string;
  title: string;
  trigger: ActionKind | 'status';
  roomTags: string[];
  severity: number;
  flavor: string;
  witness: string;
  focusDelta: number;
  nerveDelta: number;
  dreadDelta: number;
  evidenceDelta: number;
  clueId: string;
  clueText: string;
  ascii: string[];
  tags: string[];
}

export interface CurrentPhenomenon {
  clueId: string;
  clueText: string;
  title: string;
  witness: string;
  ascii: string[];
}

export interface JournalEntry {
  turn: number;
  action: string;
  roomId: string;
  roomName: string;
  result: string;
  dread: number;
  nerve: number;
  evidence: number;
  witness?: string;
}

export interface GameState {
  version: number;
  slot: number;
  runId: string;
  seed: number;
  rngState: number[];
  caseId: string;
  caseName: string;
  roomId: string;
  turn: number;
  focus: number;
  nerve: number;
  dread: number;
  evidence: number;
  objectiveCollected: boolean;
  objectiveQuality: 'unknown' | 'uncertain' | 'verified';
  recordedClues: string[];
  findings: string[];
  currentPhenomenon?: CurrentPhenomenon;
  latestAscii: string[];
  latestWitness?: string;
  latestResult?: string;
  history: JournalEntry[];
  outcome: Outcome;
  observer?: { port?: number; pid?: number };
}

export interface SaveSummary {
  slot: number;
  exists: boolean;
  caseName?: string;
  turn?: number;
  outcome?: Outcome;
  dread?: number;
  evidence?: number;
}
