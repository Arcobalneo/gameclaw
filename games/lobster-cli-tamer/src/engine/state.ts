/**
 * Core state for 横着抓 / Lobster Sideways Catch.
 *
 * Everything here is plain JSON: no Map, no Set, no class instance, no Date.
 * The only live object is the serialised sfc32 RNG state (`rng: number[]`),
 * which every action restores and re-saves, so a seed plus an action sequence
 * always replays identically.
 */
import type { Outcome } from '@gameclaw/gamekit';
import { Rng } from '@gameclaw/gamekit';

import { makeCreature, SPECIES } from './species';
import { rollAffixSlots } from './workshop';

export const GAME_ID = 'lobster-cli-tamer';
export const GAME_VERSION = '2.0.0';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export function parseDifficulty(raw: string | undefined): Difficulty {
  if (!raw || raw === 'normal') return 'normal';
  if (raw === 'easy' || raw === 'hard') return raw;
  throw new Error(`Unknown --difficulty preset: ${raw}. Use one of: easy, normal, hard`);
}

/** `--content` selects the starter species. Defaults to the reef shrimp. */
export function parseContent(raw: string | undefined): string | null {
  if (!raw) return null;
  if (SPECIES.has(raw)) return raw;
  throw new Error(
    `Unknown --content starter species: ${raw}. Use a species id such as reef_shrimp.`,
  );
}

export type Phase =
  | 'menu'
  | 'zone'
  | 'subarea'
  | 'explore'
  | 'encounter'
  | 'catch'
  | 'battle'
  | 'skill'
  | 'party'
  | 'items'
  | 'items-cure'
  | 'workshop'
  | 'workshop-slot'
  | 'abyss-gate'
  | 'abyss'
  | 'ended';

export type StatusName = '中毒' | '麻痹' | '灼烧' | '冰封' | '困惑';

export const STATUSES: readonly StatusName[] = ['中毒', '麻痹', '灼烧', '冰封', '困惑'];

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  end: number;
}

export type StatKey = keyof Stats;

export interface AffixSlot {
  /** Empty string means the slot has not been rolled yet. */
  affixId: string;
  locked: boolean;
}

export interface Creature {
  uid: string;
  speciesId: string;
  nickname: string | null;
  level: number;
  exp: number;
  shiny: boolean;
  stats: Stats;
  hp: number;
  affixSlots: AffixSlot[];
  /** Up to four skill names, looked up by name in the skill data. */
  moves: string[];
  capturedZone: string;
  hasPlague: boolean;
  plagueFloors: number;
  /** Abyss taint; converts into plague at the configured threshold. */
  taint: number;
  dead: boolean;
}

export interface CombatantSide {
  stage: { atk: number; def: number; spd: number };
  shield: number;
  status: StatusName | null;
  /** 0 means the status lasts until the battle ends. */
  statusTurns: number;
  freezeSkip: boolean;
  /** affix id -> times triggered this battle */
  affixCounts: Record<string, number>;
}

export type BattleMode = 'wild' | 'abyss';

export type BattleResult = 'ongoing' | 'win' | 'lose' | 'fled' | 'caught' | 'retreat';

export interface BattleState {
  mode: BattleMode;
  enemy: Creature;
  enemySide: CombatantSide;
  playerIndex: number;
  playerSide: CombatantSide;
  round: number;
  log: string[];
  /** The wild moves first on the next turn (set by a failed baited capture). */
  enemyFirst: boolean;
  result: BattleResult;
  expGained: number;
}

export interface ExploreState {
  zoneId: string;
  subAreaId: string;
  steps: number;
  target: number;
}

export interface PendingSkill {
  partyIndex: number;
  uid: string;
  creatureName: string;
  offers: string[];
}

export interface MemorialEntry {
  uid: string;
  name: string;
  speciesId: string;
  level: number;
  shiny: boolean;
  cause: string;
  floor: number | null;
}

export interface TamerState {
  version: 1;
  seed: number;
  rng: number[];
  uidCounter: number;
  createdAt: string;
  difficulty: Difficulty;
  phase: Phase;
  playerName: string;
  party: (Creature | null)[];
  box: Creature[];
  memorial: MemorialEntry[];
  items: Record<string, number>;
  dexSeen: string[];
  dexCaught: string[];
  shinyCaught: string[];
  unlockedZones: string[];
  currentZone: string;
  currentSubArea: string;
  explore: ExploreState | null;
  wild: Creature | null;
  battle: BattleState | null;
  catchBait: boolean;
  pendingSkills: PendingSkill[];
  abyssActive: boolean;
  abyssFloor: number;
  deepestFloor: number;
  totalRuns: number;
  totalBattles: number;
  totalCaptures: number;
  totalDeaths: number;
  /** Consecutive non-capture-tool drops; three triggers a guaranteed net. */
  pity: number;
  selectedCreature: number | null;
  log: string[];
  timeline: string[];
  notes: string[];
  lastResult: string;
  cause: string;
  outcome: Outcome;
  turn: number;
}

export interface CreateStateOptions {
  seed: number;
  content?: string;
  difficulty?: string;
  now: string;
}

const PARTY_SIZE = 6;
const MAX_LOG = 12;
const MAX_TIMELINE = 40;
const MAX_NOTES = 6;

export function nextUid(state: Pick<TamerState, 'seed' | 'uidCounter'>): string {
  state.uidCounter += 1;
  return `lct-${state.seed.toString(36)}-${state.uidCounter.toString(36)}`;
}

export function createState(options: CreateStateOptions): TamerState {
  const difficulty = parseDifficulty(options.difficulty);
  const starterId = parseContent(options.content) ?? 'reef_shrimp';
  const rng = Rng.fromSeed(options.seed);
  const state: TamerState = {
    version: 1,
    seed: options.seed,
    rng: rng.serialize(),
    uidCounter: 0,
    createdAt: options.now,
    difficulty,
    phase: 'menu',
    playerName: '甲录师',
    party: Array.from({ length: PARTY_SIZE }, () => null),
    box: [],
    memorial: [],
    items: { net_basic: 5, potion_minor: 3, cure_plague: 1, jihe_core: 3 },
    dexSeen: [],
    dexCaught: [],
    shinyCaught: [],
    unlockedZones: ['reef_zone'],
    currentZone: 'reef_zone',
    currentSubArea: 'reef_surface',
    explore: null,
    wild: null,
    battle: null,
    catchBait: false,
    pendingSkills: [],
    abyssActive: false,
    abyssFloor: 0,
    deepestFloor: 0,
    totalRuns: 0,
    totalBattles: 0,
    totalCaptures: 0,
    totalDeaths: 0,
    pity: 0,
    selectedCreature: null,
    log: [],
    timeline: [],
    notes: [],
    lastResult: '',
    cause: '',
    outcome: 'ongoing',
    turn: 0,
  };

  const starterRng = rng;
  const affixSlots = rollAffixSlots(starterRng, affixSlotCount(starterId, false), false);
  const starter = makeCreature(starterId, 5, {
    uid: nextUid(state),
    shiny: false,
    affixSlots,
  });
  starter.moves = starter.moves.slice(0, 4);
  state.party[0] = starter;
  state.dexSeen.push(starterId);
  state.dexCaught.push(starterId);
  state.rng = rng.serialize();
  note(state, `你在潮礁区领到了 Lv5 的${starter.speciesId}，甲录师生涯开始。`);
  timeline(state, '领到起始虾米');
  return state;
}

export function affixSlotCount(speciesId: string, shiny: boolean): number {
  const species = SPECIES.get(speciesId);
  if (!species) return 0;
  return species.affix_slots + (shiny ? 1 : 0);
}

export function pushLog(state: TamerState, lines: readonly string[]): void {
  for (const line of lines) {
    if (!line) continue;
    state.log.push(line.length > 220 ? `${line.slice(0, 219)}…` : line);
  }
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

export function note(state: TamerState, text: string): void {
  // Repeated events (wild wipes, identical lessons) should not flood the recap.
  if (state.notes[state.notes.length - 1] === text) return;
  state.notes.push(text);
  if (state.notes.length > MAX_NOTES) state.notes.splice(0, state.notes.length - MAX_NOTES);
}

export function timeline(state: TamerState, text: string): void {
  state.timeline.push(`T${state.turn + 1} ${text}`);
  if (state.timeline.length > MAX_TIMELINE)
    state.timeline.splice(0, state.timeline.length - MAX_TIMELINE);
}

export function partyIndices(state: TamerState): number[] {
  const out: number[] = [];
  state.party.forEach((creature, index) => {
    if (creature) out.push(index);
  });
  return out;
}

export function alivePartyIndices(state: TamerState): number[] {
  const out: number[] = [];
  state.party.forEach((creature, index) => {
    if (creature && !creature.dead && creature.hp > 0) out.push(index);
  });
  return out;
}

export function hasAliveParty(state: TamerState): boolean {
  return alivePartyIndices(state).length > 0;
}

export function firstAliveIndex(state: TamerState): number {
  const indices = alivePartyIndices(state);
  return indices[0] ?? -1;
}

export function maxPartyLevel(state: TamerState): number {
  let level = 0;
  for (const creature of state.party) {
    if (creature && !creature.dead) level = Math.max(level, creature.level);
  }
  for (const creature of state.box) level = Math.max(level, creature.level);
  return level || 5;
}

export function creatureByUid(state: TamerState, uid: string): Creature | null {
  for (const creature of state.party) if (creature?.uid === uid) return creature;
  for (const creature of state.box) if (creature.uid === uid) return creature;
  return null;
}

export function maxHp(creature: Creature): number {
  return Math.max(1, creature.stats.hp);
}

export function hpRatio(creature: Creature): number {
  return Math.max(0, Math.min(1, creature.hp / maxHp(creature)));
}

export function addUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

export function clearEncounter(state: TamerState): void {
  state.wild = null;
  state.battle = null;
  state.catchBait = false;
}

/** Where to return after a queued level-up choice is resolved. */
export function returnPhase(state: TamerState): Phase {
  if (state.outcome !== 'ongoing') return 'ended';
  if (state.abyssActive) return 'abyss';
  if (state.explore) return 'explore';
  return 'menu';
}

export function emptySide(): CombatantSide {
  return {
    stage: { atk: 1, def: 1, spd: 1 },
    shield: 0,
    status: null,
    statusTurns: 0,
    freezeSkip: false,
    affixCounts: {},
  };
}
