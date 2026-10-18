import type { ActionView, GameEvent, Outcome, Risk } from '@gameclaw/gamekit';
import { GameError, Rng } from '@gameclaw/gamekit';

import {
  COMPLICATION_PACKAGES,
  FACILITIES,
  type FacilityFrame,
  manhattan,
  OBJECTIVE_PACKAGES,
  type Pos,
  PROFILES,
  type Profile,
  type ProfileKey,
  pickMission,
  SECURITY_PACKAGES,
  samePos,
  type Terrain,
  type WatcherSpec,
} from './content';

export const GAME_ID = 'lobster-cli-heist';
export const GAME_VERSION = '2.0.0';

export type Phase = 'setup' | 'infiltrate' | 'extraction' | 'ended';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Direction = 'n' | 's' | 'e' | 'w';

const DIRECTIONS: Direction[] = ['n', 's', 'e', 'w'];
const DIRECTION_LABELS: Record<Direction, string> = {
  n: '北移',
  s: '南移',
  e: '东移',
  w: '西移',
};
const ROW_NAMES = ['上', '下'];
const COLUMNS = 7;

export interface MissionRef {
  facility: string;
  security: string;
  objective: string;
  complication: string;
  trueSite: Pos;
}

export interface NoiseMarker {
  pos: Pos;
  intensity: number;
  source: string;
}

export interface SmokeCloud {
  pos: Pos;
  turns: number;
}

export interface HeistState {
  version: 1;
  seed: number;
  /** sfc32 state. Kept in the save so a replay never drifts. */
  rng: number[];
  phase: Phase;
  outcome: Outcome;
  cause: string;
  profile: ProfileKey | null;
  mission: MissionRef;
  difficulty: Difficulty;
  exposureLimit: number;
  turn: number;
  position: Pos;
  exposure: number;
  exposurePeak: number;
  alert: number;
  quietTurns: number;
  carrying: boolean;
  objectiveKnown: boolean;
  objectiveTaken: boolean;
  inspected: Pos[];
  cacheOpened: boolean;
  consoleUsed: boolean;
  exitUnjammed: boolean;
  lockdown: number | null;
  gear: number;
  smoke: SmokeCloud[];
  noise: NoiseMarker | null;
  cameraDown: number;
  sensorsDown: number;
  /** Noise reduction carried into the immediately next move / dash. */
  timedMove: number;
  responderCountdown: number | null;
  responderPos: Pos | null;
  patrolIndex: number;
  patrolDir: number;
  patrolStun: number;
  watcherFacing: 'left' | 'right' | null;
  cameraPhase: number;
  cacheReward: string | null;
  carryNoiseDiscount: number;
  extractionBuffer: number;
  runnerQuietReady: boolean;
  dashGuard: boolean;
  score: number;
  lastAction: string;
  lastResult: string[];
  timeline: string[];
}

export interface CreateRunOptions {
  seed: number;
  content?: string;
  difficulty?: string;
}

export interface Resolution {
  log: string[];
  events: GameEvent[];
}

export interface ExposureForecast {
  gain: number;
  caught: boolean;
  sources: string[];
}

export function parseDifficulty(raw: string | undefined): Difficulty {
  if (!raw || raw === 'normal') return 'normal';
  if (raw === 'easy' || raw === 'hard') return raw;
  throw new GameError(
    'USAGE',
    `Unknown --difficulty preset: ${raw}`,
    'Use one of: easy, normal, hard',
  );
}

function exposureLimitFor(difficulty: Difficulty): number {
  if (difficulty === 'easy') return 10;
  if (difficulty === 'hard') return 8;
  return 9;
}

function windowBonusFor(difficulty: Difficulty): number {
  if (difficulty === 'easy') return 1;
  if (difficulty === 'hard') return -1;
  return 0;
}

export function createRun(options: CreateRunOptions): HeistState {
  const difficulty = parseDifficulty(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const mission = pickMission(rng, options.content);
  const patrolIndex = rng.int(0, mission.security.patroller.path.length - 1);
  const cameraPhase = mission.security.camera
    ? rng.int(0, mission.security.camera.patterns.length - 1)
    : 0;
  return {
    version: 1,
    seed: options.seed,
    rng: rng.serialize(),
    phase: 'setup',
    outcome: 'ongoing',
    cause: '',
    profile: null,
    mission: {
      facility: mission.facility.key,
      security: mission.security.key,
      objective: mission.objective.key,
      complication: mission.complication.key,
      trueSite: mission.trueSite,
    },
    difficulty,
    exposureLimit: exposureLimitFor(difficulty),
    turn: 0,
    position: mission.facility.entry,
    exposure: 0,
    exposurePeak: 0,
    alert: 0,
    quietTurns: 0,
    carrying: false,
    objectiveKnown: false,
    objectiveTaken: false,
    inspected: [],
    cacheOpened: false,
    consoleUsed: false,
    exitUnjammed: false,
    lockdown: null,
    gear: 0,
    smoke: [],
    noise: null,
    cameraDown: 0,
    sensorsDown: 0,
    timedMove: 0,
    responderCountdown: mission.security.responderDelay,
    responderPos: null,
    patrolIndex,
    patrolDir: 1,
    patrolStun: 0,
    watcherFacing: mission.security.watcher?.facing ?? null,
    cameraPhase,
    cacheReward: null,
    carryNoiseDiscount: 0,
    extractionBuffer: 0,
    runnerQuietReady: false,
    dashGuard: false,
    score: 0,
    lastAction: '',
    lastResult: [],
    timeline: [],
  };
}

// ---------------------------------------------------------------------------
// Mission / location helpers
// ---------------------------------------------------------------------------

export function missionOf(state: HeistState) {
  const facility = FACILITIES.find((item) => item.key === state.mission.facility);
  const security = SECURITY_PACKAGES.find((item) => item.key === state.mission.security);
  const objective = OBJECTIVE_PACKAGES.find((item) => item.key === state.mission.objective);
  const complication = COMPLICATION_PACKAGES.find(
    (item) => item.key === state.mission.complication,
  );
  if (!facility || !security || !objective || !complication) {
    throw new GameError('STATE_CORRUPT', 'The saved mission no longer matches this game version.');
  }
  return { facility, security, objective, complication, trueSite: state.mission.trueSite };
}

export function profileOf(state: HeistState): Profile | null {
  if (!state.profile) return null;
  return PROFILES.find((item) => item.key === state.profile) ?? null;
}

function terrainAt(facility: FacilityFrame, pos: Pos): Terrain {
  return facility.terrain[pos[0]]?.[pos[1]] ?? 'open';
}

function inBounds(pos: Pos): boolean {
  return pos[0] >= 0 && pos[0] < 2 && pos[1] >= 0 && pos[1] < COLUMNS;
}

export function positionLabel(pos: Pos): string {
  return `${ROW_NAMES[pos[0]] ?? '?'}${pos[1] + 1}`;
}

type Feature = 'entry' | 'exit' | 'console' | 'cache' | 'candidate' | 'vent';

const FEATURE_LABELS: Record<Feature, string> = {
  entry: '入水缝',
  exit: '撤离快门',
  console: '终端',
  cache: '侧缓存',
  candidate: '候选货格',
  vent: '通风口',
};

export function featureAt(state: HeistState, pos: Pos): Feature | null {
  const { facility } = missionOf(state);
  if (samePos(pos, facility.entry)) return 'entry';
  if (samePos(pos, facility.exit)) return 'exit';
  if (samePos(pos, facility.console)) return 'console';
  if (samePos(pos, facility.cache)) return 'cache';
  if (facility.candidates.some((site) => samePos(site, pos))) return 'candidate';
  if (facility.vents.some((site) => samePos(site, pos))) return 'vent';
  return null;
}

export function positionTitle(state: HeistState, pos: Pos): string {
  const { facility } = missionOf(state);
  const feature = featureAt(state, pos);
  if (feature) return `${positionLabel(pos)} ${FEATURE_LABELS[feature]}`;
  const terrain = terrainAt(facility, pos);
  const terrainName = terrain === 'cover' ? '掩体格' : terrain === 'shadow' ? '暗格' : '开阔格';
  return `${positionLabel(pos)} ${terrainName}`;
}

function isInspected(state: HeistState, pos: Pos): boolean {
  return state.inspected.some((site) => samePos(site, pos));
}

function candidateMark(state: HeistState, pos: Pos): string {
  const { trueSite } = missionOf(state);
  if (samePos(pos, trueSite) && (state.objectiveKnown || isInspected(state, pos))) return 'O';
  if (isInspected(state, pos) && !samePos(pos, trueSite)) return 'E';
  return '?';
}

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

export function steamActive(state: HeistState): boolean {
  const { complication } = missionOf(state);
  return complication.mode === 'steam' && state.turn > 0 && state.turn % 3 === 0;
}

export function watchersOf(state: HeistState): WatcherSpec[] {
  const { security, complication } = missionOf(state);
  const watchers: WatcherSpec[] = [];
  if (security.watcher) {
    watchers.push({
      ...security.watcher,
      facing: state.watcherFacing ?? security.watcher.facing,
    });
  }
  if (complication.mode === 'extra_watcher') {
    watchers.push({ title: '临时加班员', position: [0, 3], facing: 'right', range: 3 });
  }
  return watchers;
}

export function cameraCells(state: HeistState): Pos[] {
  const { security } = missionOf(state);
  if (!security.camera || state.cameraDown > 0) return [];
  return security.camera.patterns[state.cameraPhase] ?? [];
}

export function sensorCells(state: HeistState): Pos[] {
  const { security } = missionOf(state);
  if (state.sensorsDown > 0) return [];
  return security.sensors;
}

export function patrollerPosition(state: HeistState): Pos {
  const { security } = missionOf(state);
  return security.patroller.path[state.patrolIndex] ?? security.patroller.path[0]!;
}

export function nextPatrolPosition(state: HeistState): Pos {
  const { security } = missionOf(state);
  const path = security.patroller.path;
  if (path.length <= 1) return path[0]!;
  let index = state.patrolIndex + state.patrolDir;
  if (index >= path.length || index < 0) index = state.patrolIndex - state.patrolDir;
  return path[Math.max(0, Math.min(path.length - 1, index))]!;
}

function responderSpawnPending(state: HeistState): boolean {
  return (
    state.responderPos === null &&
    (state.carrying || state.alert >= 2) &&
    (state.responderCountdown ?? 0) <= 0
  );
}

function occupiedThreatPositions(state: HeistState): Pos[] {
  const positions: Pos[] = [patrollerPosition(state)];
  if (state.responderPos) positions.push(state.responderPos);
  if (responderSpawnPending(state)) positions.push(missionOf(state).facility.responderEntry);
  return positions;
}

function smokeAt(state: HeistState, pos: Pos): boolean {
  return state.smoke.some((cloud) => samePos(cloud.pos, pos) && cloud.turns > 0);
}

export function concealmentAt(state: HeistState, pos: Pos): number {
  const { facility } = missionOf(state);
  if (smokeAt(state, pos)) return 3;
  if (steamActive(state) && samePos(pos, facility.steamCell)) return 2;
  const terrain = terrainAt(facility, pos);
  return terrain === 'shadow' || terrain === 'cover' ? 1 : 0;
}

function watcherSees(watcher: WatcherSpec, pos: Pos): boolean {
  if (pos[0] !== watcher.position[0]) return false;
  const delta = pos[1] - watcher.position[1];
  if (watcher.facing === 'left' && delta >= 0) return false;
  if (watcher.facing === 'right' && delta <= 0) return false;
  return Math.abs(delta) <= watcher.range;
}

function detectionGain(alertBonus: number, concealment: number, guard: number): number {
  return Math.max(0, 1 + alertBonus - concealment - guard);
}

/**
 * Forecast how much exposure standing at `pos` would collect right now.
 * Used for action details, so the agent can compare risk before committing.
 */
export function forecastExposure(state: HeistState, pos: Pos, dashGuard = false): ExposureForecast {
  const threat = occupiedThreatPositions(state);
  if (threat.some((site) => samePos(site, pos))) {
    return { gain: 99, caught: true, sources: ['守卫已经占住 / 即将占住这格'] };
  }
  const concealment = concealmentAt(state, pos);
  const guard = dashGuard ? 1 : 0;
  const alertBonus = state.alert >= 2 ? 1 : 0;
  const sources: string[] = [];
  let gain = 0;
  for (const watcher of watchersOf(state)) {
    if (watcherSees(watcher, pos) && concealment < 2) {
      const value = detectionGain(alertBonus, concealment, guard);
      if (value > 0) {
        gain += value;
        sources.push(watcher.title);
      }
    }
  }
  if (cameraCells(state).some((site) => samePos(site, pos)) && concealment < 2) {
    const value = detectionGain(alertBonus, concealment, guard);
    if (value > 0) {
      gain += value;
      sources.push('镜头');
    }
  }
  const patrolPos = patrollerPosition(state);
  if (patrolPos[0] === pos[0] && Math.abs(patrolPos[1] - pos[1]) <= 1 && concealment < 2) {
    gain += Math.max(1, 3 - concealment - guard);
    sources.push('巡逻近线');
  }
  if (state.responderPos) {
    const distance = manhattan(state.responderPos, pos);
    if (distance <= 1 && concealment < 3) {
      gain += 3;
      sources.push('响应者贴身');
    }
  }
  return { gain, caught: false, sources };
}

interface DetectionEvent {
  text: string;
  source: string;
  gain: number;
}

function detectionPass(state: HeistState): { gain: number; events: DetectionEvent[] } {
  const concealment = concealmentAt(state, state.position);
  const guard = state.dashGuard ? 1 : 0;
  const alertBonus = state.alert >= 2 ? 1 : 0;
  const events: DetectionEvent[] = [];
  let gain = 0;

  for (const watcher of watchersOf(state)) {
    if (watcherSees(watcher, state.position) && concealment < 2) {
      const value = detectionGain(alertBonus, concealment, guard);
      if (value > 0) {
        gain += value;
        events.push({
          text: `${watcher.title} 的视线压在你身上（曝光 +${value}）。`,
          source: watcher.title,
          gain: value,
        });
      }
    }
  }

  if (cameraCells(state).some((site) => samePos(site, state.position)) && concealment < 2) {
    const value = detectionGain(alertBonus, concealment, guard);
    if (value > 0) {
      gain += value;
      events.push({ text: `镜头扫过你现在这格（曝光 +${value}）。`, source: '镜头', gain: value });
    }
  }

  const patrolPos = patrollerPosition(state);
  if (
    state.position[0] === patrolPos[0] &&
    Math.abs(state.position[1] - patrolPos[1]) <= 1 &&
    concealment < 2
  ) {
    const value = Math.max(1, 3 - concealment - guard);
    gain += value;
    events.push({
      text: `巡逻蟹从近线压了上来（曝光 +${value}）。`,
      source: '巡逻近线',
      gain: value,
    });
  }

  if (state.responderPos && manhattan(state.responderPos, state.position) <= 1) {
    if (concealment < 3) {
      gain += 3;
      events.push({ text: '快速响应者已经贴到你身边（曝光 +3）。', source: '响应者', gain: 3 });
    }
  }

  return { gain, events };
}

function moveNoise(state: HeistState, dest: Pos, viaDash = false, timed = 0): number {
  const { facility, objective, complication } = missionOf(state);
  let noise = terrainAt(facility, dest) === 'shadow' ? 0 : 1;
  if (steamActive(state) && samePos(dest, facility.steamCell)) noise += 1;
  if (state.carrying) {
    let extra = objective.carryNoise + complication.carryNoiseBonus - state.carryNoiseDiscount;
    if (state.profile === 'runner' && state.runnerQuietReady) extra = Math.max(0, extra - 1);
    noise += Math.max(0, extra);
  }
  if (viaDash) noise = Math.max(0, noise - 1);
  if (timed > 0) noise = Math.max(0, noise - timed);
  return noise;
}

export function exitIsBlocked(state: HeistState): boolean {
  const { complication } = missionOf(state);
  if (state.profile === 'breaker') return false;
  if (complication.mode !== 'jammed_exit') return false;
  if (!state.carrying) return false;
  return !state.exitUnjammed;
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

interface MoveTarget {
  pos: Pos;
  vent: boolean;
}

function ventPartner(state: HeistState, dir: Direction): Pos | null {
  if (state.carrying) return null;
  const { facility } = missionOf(state);
  const [a, b] = facility.vents;
  let partner: Pos | null = null;
  if (samePos(state.position, a)) partner = b;
  else if (samePos(state.position, b)) partner = a;
  if (!partner || partner[0] !== state.position[0]) return null;
  const needed: Direction = partner[1] > state.position[1] ? 'e' : 'w';
  return dir === needed ? partner : null;
}

export function resolveMove(state: HeistState, dir: Direction): MoveTarget | null {
  const { facility } = missionOf(state);
  const [row, col] = state.position;
  if (dir === 'n' || dir === 's') {
    if (!facility.climbColumns.includes(col)) return null;
    const nextRow = dir === 'n' ? row - 1 : row + 1;
    if (nextRow < 0 || nextRow > 1) return null;
    return { pos: [nextRow, col], vent: false };
  }
  const vent = ventPartner(state, dir);
  if (vent) return { pos: vent, vent: true };
  const nextCol = dir === 'e' ? col + 1 : col - 1;
  if (nextCol < 0 || nextCol >= COLUMNS) return null;
  return { pos: [row, nextCol], vent: false };
}

function neighborsOf(state: HeistState, pos: Pos): Pos[] {
  const { facility } = missionOf(state);
  const [row, col] = pos;
  const result: Pos[] = [];
  for (const delta of [-1, 1]) {
    const next: Pos = [row, col + delta];
    if (inBounds(next)) result.push(next);
  }
  if (facility.climbColumns.includes(col)) result.push([1 - row, col]);
  return result.filter((next) => !samePos(next, pos));
}

function pathKey(pos: Pos): string {
  return `${pos[0]},${pos[1]}`;
}

function bfsPath(
  state: HeistState,
  start: Pos,
  goal: Pos,
  options: { avoidThreats?: boolean } = {},
): Pos[] | null {
  if (samePos(start, goal)) return [start];
  const blocked = options.avoidThreats ? occupiedThreatPositions(state) : [];
  const queue: Pos[] = [start];
  const prev = new Map<string, Pos | null>();
  prev.set(pathKey(start), null);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    if (samePos(current, goal)) break;
    for (const next of neighborsOf(state, current)) {
      if (blocked.some((site) => samePos(site, next))) continue;
      const key = pathKey(next);
      if (prev.has(key)) continue;
      prev.set(key, current);
      queue.push(next);
    }
  }
  if (!prev.has(pathKey(goal))) return null;
  const path: Pos[] = [];
  let cursor: Pos | null = goal;
  while (cursor) {
    path.unshift(cursor);
    cursor = prev.get(pathKey(cursor)) ?? null;
  }
  return path;
}

function shortestStep(state: HeistState, start: Pos, goal: Pos): Pos {
  const path = bfsPath(state, start, goal);
  if (!path || path.length < 2) return start;
  return path[1]!;
}

interface DashPlan {
  goal: Pos;
  destination: Pos;
}

function dashPlan(state: HeistState): DashPlan | null {
  const { facility } = missionOf(state);
  let goals: Pos[];
  if (state.carrying) goals = [facility.exit];
  else if (state.objectiveKnown) goals = [state.mission.trueSite];
  else {
    goals = facility.candidates.filter((site) => !isInspected(state, site));
    if (goals.length === 0) goals = [...facility.candidates];
  }
  let best: { goal: Pos; path: Pos[] } | null = null;
  for (const goal of goals) {
    const path = bfsPath(state, state.position, goal, { avoidThreats: true });
    if (!path || path.length < 2) continue;
    if (!best || path.length < best.path.length) best = { goal, path };
  }
  if (!best) return null;
  const steps = Math.min(2, best.path.length - 1);
  return { goal: best.goal, destination: best.path[steps]! };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function moveRisk(state: HeistState, target: Pos, vent: boolean): Risk {
  const forecast = forecastExposure(state, target);
  if (forecast.caught) return 'high';
  if (state.exposure + forecast.gain >= state.exposureLimit) return 'high';
  if (samePos(nextPatrolPosition(state), target)) return 'high';
  if (sensorCells(state).some((site) => samePos(site, target))) {
    return state.alert >= 2 ? 'high' : 'medium';
  }
  if (forecast.gain >= 2) return 'high';
  if (forecast.gain === 1 || vent) return 'medium';
  return 'low';
}

function moveDetail(state: HeistState, target: Pos, vent: boolean): string {
  const noise = moveNoise(state, target, false, state.timedMove);
  const forecast = forecastExposure(state, target);
  const notes: string[] = [];
  if (vent) notes.push('vent 滑潜');
  if (state.carrying) notes.push('带货脚步更响');
  if (state.timedMove > 0) notes.push(`观察时机：噪音 -${state.timedMove}`);
  if (steamActive(state) && samePos(target, missionOf(state).facility.steamCell)) {
    notes.push('蒸汽格 +1 噪音');
  }
  if (sensorCells(state).some((site) => samePos(site, target))) notes.push('sensor：警戒 +1');
  if (samePos(nextPatrolPosition(state), target)) notes.push('下一拍巡逻可能到这格');
  const gain = forecast.caught ? '会被撞上' : `曝光 +${forecast.gain}`;
  return `${positionTitle(state, target)}；噪音 ${noise}；${gain}${
    notes.length > 0 ? `；${notes.join('；')}` : ''
  }`;
}

function waitReduction(state: HeistState): number {
  const { facility } = missionOf(state);
  const terrain = terrainAt(facility, state.position);
  let reduction = terrain === 'shadow' || smokeAt(state, state.position) ? 2 : 1;
  const steamHere = steamActive(state) && samePos(state.position, facility.steamCell);
  if (steamHere) reduction += 1;
  if (
    state.profile === 'shade' &&
    (terrain === 'shadow' || steamHere || smokeAt(state, state.position))
  ) {
    reduction += 1;
  }
  return reduction;
}

function objectiveWindow(state: HeistState): number {
  const { objective } = missionOf(state);
  const profile = profileOf(state);
  const bonus = profile?.extractionBonus ?? 0;
  return Math.max(
    1,
    objective.extractionWindow + bonus + state.extractionBuffer + windowBonusFor(state.difficulty),
  );
}

function cacheRewardText(state: HeistState): string {
  const { objective } = missionOf(state);
  if (objective.cacheReward === 'intel') return '拿到真目标情报';
  if (objective.cacheReward === 'cold_sleeve') return '带货噪音 -1';
  return `撤离窗 +2、快门可开`;
}

function objectiveDetail(state: HeistState): string {
  const { objective, trueSite } = missionOf(state);
  const known =
    state.objectiveKnown || (isInspected(state, trueSite) && samePos(state.position, trueSite));
  const window = objectiveWindow(state);
  if (known && samePos(state.position, trueSite)) {
    return `确认是真目标；目标分 +${objective.score}，取物后撤离窗 ${window} 拍，带货噪音 +${objective.carryNoise}。`;
  }
  if (state.objectiveKnown) {
    return `已知真目标在 ${positionLabel(trueSite)}；这格是空的，硬开只会警戒 +${objective.falseAlert}、噪音 +2。`;
  }
  return `未确认货格：若为空，警戒 +${objective.falseAlert}、噪音 +2；若为真，目标分 +${objective.score}、撤离窗 ${window} 拍。`;
}

function gearRisk(state: HeistState): Risk {
  if (state.profile !== 'runner') return 'low';
  const plan = dashPlan(state);
  if (!plan) return 'low';
  const gain = forecastExposure(state, plan.destination, true).gain;
  if (gain >= 2) return 'high';
  if (gain === 1) return 'medium';
  return 'low';
}

function gearLabel(state: HeistState): string {
  if (state.profile === 'shade') return '甩墨幕';
  if (state.profile === 'breaker') return '打干扰钉';
  return '空壳冲刺';
}

function breakerGearTarget(state: HeistState): 'camera' | 'sensor' | 'patrol' {
  const { security } = missionOf(state);
  if (security.camera && state.cameraDown <= 0) return 'camera';
  if (security.sensors.length > 0 && state.sensorsDown <= 0) return 'sensor';
  return 'patrol';
}

function gearDetail(state: HeistState): string {
  if (state.profile === 'shade') {
    return `在当前格留下 2 拍墨幕，并立刻曝光 -2。本次消耗 1，剩余 ${state.gear - 1} 次。`;
  }
  if (state.profile === 'breaker') {
    const target = breakerGearTarget(state);
    if (target === 'camera') return `钉死镜头 2 拍。本次消耗 1，剩余 ${state.gear - 1} 次。`;
    if (target === 'sensor') return `钉哑 sensor 2 拍。本次消耗 1，剩余 ${state.gear - 1} 次。`;
    return `钉住巡逻蟹 1 拍。本次消耗 1，剩余 ${state.gear - 1} 次。`;
  }
  const plan = dashPlan(state);
  if (!plan) return `没有可用的冲刺线：原地缩壳，曝光 -2。本次消耗 1，剩余 ${state.gear - 1} 次。`;
  const noise = moveNoise(state, plan.destination, true, state.timedMove);
  const forecast = forecastExposure(state, plan.destination, true);
  return `冲到 ${positionTitle(state, plan.destination)}；噪音 ${noise}，曝光 +${forecast.gain}。本次消耗 1，剩余 ${state.gear - 1} 次。`;
}

export function availableActions(state: HeistState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  if (state.phase === 'setup') {
    return PROFILES.map((profile) => ({
      id: `choose:${profile.key}`,
      label: profile.title,
      detail: `${profile.gearName}×${profile.gearCharges}；被动：${profile.passiveSummary}；撤离窗 +${profile.extractionBonus}。${profile.blurb}`,
      risk: 'low',
      tags: ['setup'],
    }));
  }
  if (state.phase === 'ended') return [];

  const actions: ActionView[] = [];
  const { facility } = missionOf(state);
  for (const dir of DIRECTIONS) {
    const move = resolveMove(state, dir);
    if (!move) continue;
    if (occupiedThreatPositions(state).some((site) => samePos(site, move.pos))) continue;
    actions.push({
      id: `move:${dir}`,
      label: `${DIRECTION_LABELS[dir]}·${positionLabel(move.pos)}`,
      detail: moveDetail(state, move.pos, move.vent),
      risk: moveRisk(state, move.pos, move.vent),
      tags: move.vent ? ['move', 'vent'] : ['move'],
    });
  }

  if (samePos(state.position, facility.console) && !state.consoleUsed) {
    const { security, objective, complication } = missionOf(state);
    const parts: string[] = [];
    if (objective.consoleReveals) parts.push('锁定真目标');
    if (security.camera) parts.push('镜头停 1 拍');
    if (complication.mode === 'jammed_exit') parts.push('预开卡涩快门');
    if (state.profile !== 'breaker') parts.push('噪音 1');
    actions.push({
      id: 'interact:console',
      label: '用终端',
      detail: `${parts.join('；') || '把安保节奏吐给你一部分'}。`,
      risk: forecastExposure(state, state.position).gain > 0 ? 'medium' : 'low',
      tags: ['interact', 'console'],
    });
  }

  if (samePos(state.position, facility.cache) && !state.cacheOpened) {
    actions.push({
      id: 'interact:cache',
      label: '摸侧缓存',
      detail: `${cacheRewardText(state)}；噪音 1。`,
      risk: forecastExposure(state, state.position).gain > 0 ? 'medium' : 'low',
      tags: ['interact', 'cache'],
    });
  }

  if (
    facility.candidates.some((site) => samePos(site, state.position)) &&
    !state.carrying &&
    !isInspected(state, state.position)
  ) {
    const { trueSite } = missionOf(state);
    const known =
      state.objectiveKnown || (isInspected(state, trueSite) && samePos(state.position, trueSite));
    actions.push({
      id: 'interact:objective',
      label: known && samePos(state.position, trueSite) ? '取目标' : '开货格',
      detail: objectiveDetail(state),
      risk: known && samePos(state.position, trueSite) ? 'medium' : 'high',
      tags: ['interact', 'objective'],
    });
  }

  if (samePos(state.position, facility.exit) && state.carrying) {
    const blocked = exitIsBlocked(state);
    actions.push({
      id: 'interact:extract',
      label: '撤离',
      detail: blocked
        ? '快门还卡着：先 interact:console 或 gear 打开它。'
        : '带着目标撤离；结算 +10。',
      risk: blocked ? 'high' : 'low',
      tags: ['interact', 'extract'],
    });
  }

  const currentGain = forecastExposure(state, state.position).gain;
  actions.push({
    id: 'observe',
    label: '观察节奏',
    detail: `读下一拍巡逻/镜头；掩体/暗格额外曝光 -1；下一拍位移 / 冲刺噪音 -${state.profile === 'shade' ? 2 : 1}。`,
    risk: currentGain > 1 ? 'medium' : 'low',
    tags: ['utility', 'observe'],
  });

  const reduction = waitReduction(state);
  const waitRisk: Risk =
    currentGain >= reduction
      ? state.exposure + currentGain >= state.exposureLimit
        ? 'high'
        : 'medium'
      : 'low';
  actions.push({
    id: 'wait',
    label: '隐蔽等待',
    detail: `曝光 -${reduction}；设施仍会推进一拍。`,
    risk: waitRisk,
    tags: ['utility', 'wait'],
  });

  if (state.gear > 0) {
    const profile = profileOf(state);
    actions.push({
      id: 'gear',
      label: gearLabel(state),
      detail: gearDetail(state),
      risk: gearRisk(state),
      cost: `1 ${profile?.gearName ?? '道具'}`,
      tags: ['gear', state.profile ?? 'none'],
    });
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function endRun(state: HeistState, outcome: Outcome, cause: string): void {
  state.phase = 'ended';
  state.outcome = outcome;
  state.cause = cause;
}

function pushNoise(state: HeistState, intensity: number, source: string): void {
  state.noise = intensity > 0 ? { pos: state.position, intensity, source } : null;
}

function triggerSensors(state: HeistState, log: string[]): number {
  if (!sensorCells(state).some((site) => samePos(site, state.position))) return 0;
  log.push('你踩到了 sensor 线，设施开始收紧。');
  state.alert = Math.min(3, state.alert + 1);
  return 2;
}

function noteNoiseReaction(state: HeistState): void {
  const noise = state.noise;
  if (!noise) return;
  const { security } = missionOf(state);
  if (!security.watcher || state.watcherFacing === null) return;
  if (noise.pos[0] !== security.watcher.position[0]) return;
  state.watcherFacing = noise.pos[1] < security.watcher.position[1] ? 'left' : 'right';
}

function movePatroller(state: HeistState, events: GameEvent[]): void {
  if (state.patrolStun > 0) {
    state.patrolStun -= 1;
    events.push({ type: 'patrol-stunned' });
    return;
  }
  const { security } = missionOf(state);
  const path = security.patroller.path;
  const index = state.patrolIndex;
  let direction = state.patrolDir;
  if (state.noise && state.noise.intensity >= 2) {
    let best = index;
    let bestDistance = Number.POSITIVE_INFINITY;
    path.forEach((site, siteIndex) => {
      const distance = manhattan(site, state.noise!.pos);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = siteIndex;
      }
    });
    if (best !== index) {
      direction = best > index ? 1 : -1;
      state.patrolDir = direction;
      state.patrolIndex = Math.max(0, Math.min(path.length - 1, index + direction));
      events.push({ type: 'patrol', position: patrollerPosition(state), towardNoise: true });
      return;
    }
  }
  if (index + direction >= path.length || index + direction < 0) {
    direction *= -1;
    state.patrolDir = direction;
  }
  state.patrolIndex = Math.max(0, Math.min(path.length - 1, index + direction));
  events.push({ type: 'patrol', position: patrollerPosition(state), towardNoise: false });
}

function moveResponder(state: HeistState, events: GameEvent[]): void {
  const shouldPressure = state.carrying || state.alert >= 2;
  if (!shouldPressure) return;
  const { facility, security } = missionOf(state);
  if (!state.responderPos) {
    if (state.responderCountdown === null) state.responderCountdown = security.responderDelay;
    if (state.responderCountdown > 0) {
      state.responderCountdown -= 1;
      return;
    }
    state.responderPos = facility.responderEntry;
    events.push({ type: 'responder', position: state.responderPos, spawned: true });
    return;
  }
  const step = shortestStep(state, state.responderPos, state.position);
  if (!samePos(step, state.responderPos)) {
    state.responderPos = step;
    events.push({ type: 'responder', position: step, spawned: false });
  }
}

function tickEffects(state: HeistState): void {
  state.smoke = state.smoke
    .map((cloud) => ({ ...cloud, turns: cloud.turns - 1 }))
    .filter((cloud) => cloud.turns > 0);
  if (state.cameraDown > 0) state.cameraDown -= 1;
  if (state.sensorsDown > 0) state.sensorsDown -= 1;
  const { security } = missionOf(state);
  if (security.camera)
    state.cameraPhase = (state.cameraPhase + 1) % security.camera.patterns.length;
  state.dashGuard = false;
}

function pushTimeline(state: HeistState, actionId: string): void {
  state.timeline.push(
    `T${state.turn} ${positionLabel(state.position)} ${actionId} · 曝光 ${state.exposure}/${state.exposureLimit} · 警戒 ${state.alert}${
      state.noise ? ` · 噪音 ${state.noise.intensity}` : ''
    }`,
  );
  if (state.timeline.length > 40) state.timeline.shift();
}

function finish(
  state: HeistState,
  log: string[],
  events: GameEvent[],
  actionId: string,
): Resolution {
  state.lastAction = actionId;
  state.lastResult = log.slice(-8);
  pushTimeline(state, actionId);
  if (state.outcome !== 'ongoing') {
    events.push({ type: 'end', outcome: state.outcome, cause: state.cause });
  }
  return { log, events };
}

function resolvePlayAction(state: HeistState, actionId: string): Resolution {
  const log: string[] = [];
  const events: GameEvent[] = [];
  let actionNoise = 0;
  let noiseSource = '';
  let freshPickup = false;
  const timedMove = state.timedMove;
  state.timedMove = 0;
  const { facility, objective, complication, security } = missionOf(state);
  const profile = profileOf(state);

  if (actionId.startsWith('move:')) {
    const dir = actionId.slice('move:'.length) as Direction;
    if (!DIRECTIONS.includes(dir)) throw new Error(`Unknown move direction: ${actionId}`);
    const move = resolveMove(state, dir);
    if (!move) throw new Error(`Blocked move: ${actionId}`);
    if (occupiedThreatPositions(state).some((site) => samePos(site, move.pos))) {
      throw new Error(`Blocked move: ${actionId}`);
    }
    state.position = move.pos;
    actionNoise = moveNoise(state, move.pos, false, timedMove);
    noiseSource = move.vent ? 'vent 滑潜' : '位移';
    if (profile?.key === 'runner' && state.runnerQuietReady) state.runnerQuietReady = false;
    log.push(
      move.vent
        ? `你顺着 vent 滑到 ${positionTitle(state, move.pos)}。`
        : `你挪到了 ${positionTitle(state, move.pos)}。`,
    );
    events.push({ type: 'move', to: move.pos, vent: move.vent, noise: actionNoise });
  } else if (actionId === 'observe') {
    state.timedMove = profile?.key === 'shade' ? 2 : 1;
    const terrain = terrainAt(facility, state.position);
    if (terrain === 'shadow' || terrain === 'cover') {
      state.exposure = Math.max(0, state.exposure - 1);
    }
    const next = nextPatrolPosition(state);
    log.push(`你停下来重新读节奏：巡逻下一拍大概率到 ${positionLabel(next)}。`);
    log.push(`下一拍位移 / 冲刺噪音 -${state.timedMove}。`);
    if (security.camera) {
      const current = cameraCells(state);
      const nextPhase = (state.cameraPhase + 1) % security.camera.patterns.length;
      const nextCells = security.camera.patterns[nextPhase] ?? [];
      log.push(
        `镜头本拍扫 ${
          current.map((site) => positionLabel(site)).join(' / ') || '停摆'
        }；再下一拍扫 ${nextCells.map((site) => positionLabel(site)).join(' / ')}。`,
      );
    }
    events.push({ type: 'observe', timedMove: state.timedMove });
  } else if (actionId === 'wait') {
    const steamHere = steamActive(state) && samePos(state.position, facility.steamCell);
    const reduction = waitReduction(state);
    state.exposure = Math.max(0, state.exposure - reduction);
    if (steamHere) {
      actionNoise += 1;
      noiseSource = '蒸汽';
      log.push('蒸汽替你遮了一下线，但也嘶了一声（噪音 +1）。');
    }
    log.push(`你把节奏压慢了一拍，曝光 -${reduction}。`);
    events.push({ type: 'wait', reduction, exposure: state.exposure });
  } else if (actionId.startsWith('interact:')) {
    const key = actionId.slice('interact:'.length);
    if (key === 'console') {
      if (!samePos(state.position, facility.console) || state.consoleUsed) {
        throw new Error(`Illegal interaction here: ${actionId}`);
      }
      state.consoleUsed = true;
      if (complication.mode === 'jammed_exit') state.exitUnjammed = true;
      if (objective.consoleReveals) state.objectiveKnown = true;
      if (security.camera) state.cameraDown = Math.max(state.cameraDown, 1);
      if (profile?.key !== 'breaker') {
        actionNoise = 1;
        noiseSource = '终端';
      }
      log.push('终端把目标情报和安保节奏吐给了你一部分。');
      events.push({
        type: 'console',
        revealed: objective.consoleReveals,
        unjammed: complication.mode === 'jammed_exit',
      });
    } else if (key === 'cache') {
      if (!samePos(state.position, facility.cache) || state.cacheOpened) {
        throw new Error(`Illegal interaction here: ${actionId}`);
      }
      state.cacheOpened = true;
      state.cacheReward = objective.cacheReward;
      if (objective.cacheReward === 'intel') {
        state.objectiveKnown = true;
        log.push('缓存里有路线纸条：你现在能直接认出真目标。');
      } else if (objective.cacheReward === 'cold_sleeve') {
        state.carryNoiseDiscount += 1;
        log.push('缓存里翻出一截冷袖：带货脚步会轻一点。');
      } else {
        state.extractionBuffer += 2;
        if (state.lockdown !== null) state.lockdown += 2;
        state.exitUnjammed = true;
        log.push('缓存里有旧通行环：撤离窗 +2，快门也更容易打开。');
      }
      actionNoise = 1;
      noiseSource = '摸缓存';
      events.push({ type: 'cache', reward: objective.cacheReward });
    } else if (key === 'objective') {
      if (
        !facility.candidates.some((site) => samePos(site, state.position)) ||
        state.carrying ||
        isInspected(state, state.position)
      ) {
        throw new Error(`Illegal interaction here: ${actionId}`);
      }
      if (samePos(state.position, state.mission.trueSite)) {
        state.objectiveKnown = true;
        state.objectiveTaken = true;
        state.carrying = true;
        state.phase = 'extraction';
        state.lockdown = objectiveWindow(state);
        freshPickup = true;
        state.alert = Math.max(state.alert, 2);
        log.push(`你拿到了【${objective.title}】。现在真正的游戏才开始。`);
        if (objective.consoleReveals && !state.consoleUsed) {
          actionNoise += 2;
          noiseSource = '硬撬冷锁';
          state.alert = Math.min(3, state.alert + 1);
          log.push('你没先过终端，冷锁直接把设施吵醒了一截。');
        }
        if (complication.mode === 'jammed_exit') {
          state.exitUnjammed = false;
          log.push('取物后快门闸没有乖乖自己开。');
        }
        state.runnerQuietReady = profile?.key === 'runner';
        state.score += objective.score;
        events.push({
          type: 'objective',
          site: state.position,
          score: objective.score,
          window: state.lockdown,
        });
      } else {
        state.inspected.push([state.position[0], state.position[1]]);
        state.alert = Math.min(3, state.alert + objective.falseAlert);
        actionNoise += 2;
        noiseSource = '误开空货格';
        log.push('这格是空的，只留下足够让设施收紧的动静。');
        const remaining = facility.candidates.filter((site) => !isInspected(state, site));
        if (remaining.length === 1) {
          state.objectiveKnown = true;
          log.push('剩下那格基本就是唯一合理的真目标了。');
        }
        events.push({
          type: 'false-objective',
          site: state.position,
          alert: state.alert,
        });
      }
    } else if (key === 'extract') {
      if (!samePos(state.position, facility.exit) || !state.carrying) {
        throw new Error(`Illegal interaction here: ${actionId}`);
      }
      if (exitIsBlocked(state)) {
        actionNoise = 1;
        noiseSource = '快门';
        log.push('你摸到了快门，但它还卡着。');
      } else {
        state.score += 10;
        endRun(state, 'won', '你带着目标在快门彻底锁死前撤了出去。');
        log.push(state.cause);
        return finish(state, log, events, actionId);
      }
    } else {
      throw new Error(`Unknown interaction: ${actionId}`);
    }
  } else if (actionId === 'gear') {
    if (state.gear <= 0) throw new Error('No gear charges left');
    state.gear -= 1;
    if (profile?.key === 'shade') {
      state.smoke = state.smoke.filter((cloud) => !samePos(cloud.pos, state.position));
      state.smoke.push({ pos: [state.position[0], state.position[1]], turns: 2 });
      state.exposure = Math.max(0, state.exposure - 2);
      log.push('墨幕在你脚下炸开：这格短时更难被看死，曝光 -2。');
      events.push({ type: 'gear', effect: 'smoke', exposure: state.exposure });
    } else if (profile?.key === 'breaker') {
      const target = breakerGearTarget(state);
      if (target === 'camera') {
        state.cameraDown = Math.max(state.cameraDown, 2);
        log.push('你把摄像头钉住了两拍。');
      } else if (target === 'sensor') {
        state.sensorsDown = Math.max(state.sensorsDown, 2);
        log.push('sensor 线被你暂时钉哑了。');
      } else {
        state.patrolStun = Math.max(state.patrolStun, 1);
        log.push('你把巡逻蟹的路线钉住了一拍。');
      }
      events.push({ type: 'gear', effect: target });
    } else if (profile?.key === 'runner') {
      const plan = dashPlan(state);
      state.dashGuard = true;
      if (plan) {
        state.position = plan.destination;
        actionNoise = moveNoise(state, plan.destination, true, timedMove);
        noiseSource = '冲刺';
        state.runnerQuietReady = false;
        log.push(`你脱壳一冲，直接换到 ${positionTitle(state, plan.destination)}。`);
        events.push({
          type: 'gear',
          effect: 'dash',
          to: plan.destination,
          noise: actionNoise,
        });
      } else {
        state.exposure = Math.max(0, state.exposure - 2);
        log.push('没找到可用的冲刺线：你把壳一缩，曝光 -2。');
        events.push({ type: 'gear', effect: 'dash-fallback', exposure: state.exposure });
      }
    } else {
      throw new Error('No profile selected');
    }
  } else {
    throw new Error(`Unknown action: ${actionId}`);
  }

  actionNoise += triggerSensors(state, log);
  if (actionNoise > 0 && !noiseSource) noiseSource = 'sensor';
  pushNoise(state, actionNoise, noiseSource || actionId);

  const detection = detectionPass(state);
  for (const event of detection.events) {
    log.push(event.text);
    events.push({ type: 'detection', source: event.source, gain: event.gain });
  }
  if (detection.gain > 0) {
    state.exposure += detection.gain;
    state.exposurePeak = Math.max(state.exposurePeak, state.exposure);
    if (state.exposure >= 3) state.alert = Math.max(state.alert, 1);
    state.quietTurns = 0;
    events.push({ type: 'exposure', gain: detection.gain, exposure: state.exposure });
  } else if (actionNoise === 0) {
    state.quietTurns += 1;
  } else {
    state.quietTurns = 0;
  }

  if (actionNoise >= 2) state.alert = Math.min(3, state.alert + 1);

  noteNoiseReaction(state);
  movePatroller(state, events);
  moveResponder(state, events);

  if (state.responderPos && samePos(state.responderPos, state.position)) {
    log.push('快速响应者直接撞上了你。');
    endRun(state, 'lost', '快速响应者在近线把你装箱了。');
    log.push(state.cause);
    return finish(state, log, events, actionId);
  }
  if (samePos(patrollerPosition(state), state.position)) {
    log.push('巡逻蟹贴脸撞见了你。');
    endRun(state, 'lost', '你在巡逻路线上被撞了个正着，设施连警报都省了。');
    log.push(state.cause);
    return finish(state, log, events, actionId);
  }
  if (state.exposure >= state.exposureLimit) {
    log.push('曝光已经堆满，设施再也不需要猜你在哪。');
    endRun(state, 'lost', '曝光堆满后，你被设施彻底锁定。');
    log.push(state.cause);
    return finish(state, log, events, actionId);
  }

  if (state.alert === 1 && state.quietTurns >= 2 && !state.carrying) {
    state.alert = 0;
    log.push('你把低警戒又压回了静默线。');
  }

  if (state.lockdown !== null && !freshPickup) {
    state.lockdown -= 1;
    if (state.lockdown <= 0) {
      state.lockdown = 0;
      log.push('设施已经彻底锁死，撤离线没了。');
      endRun(state, 'lost', '你拿到目标了，但没能在设施锁死前撤出去。');
      log.push(state.cause);
      return finish(state, log, events, actionId);
    }
  }

  tickEffects(state);
  return finish(state, log, events, actionId);
}

export function act(state: HeistState, actionId: string): Resolution {
  if (state.outcome !== 'ongoing') throw new Error('This run has already ended');
  const rng = Rng.restore(state.rng);
  state.turn += 1;

  if (state.phase === 'setup') {
    if (!actionId.startsWith('choose:'))
      throw new Error(`Expected choose:<profile>, got ${actionId}`);
    const key = actionId.slice('choose:'.length);
    const profile = PROFILES.find((item) => item.key === key);
    if (!profile) throw new Error(`Unknown profile: ${key}`);
    state.profile = profile.key;
    state.gear = profile.gearCharges;
    state.runnerQuietReady = profile.key === 'runner';
    state.phase = 'infiltrate';
    const log = [
      `你以【${profile.title}】的身份接手这票：${profile.gearName}×${profile.gearCharges}。`,
      `被动：${profile.passiveSummary}`,
    ];
    state.rng = rng.serialize();
    return finish(state, log, [{ type: 'choose', profile: profile.key }], actionId);
  }

  const resolution = resolvePlayAction(state, actionId);
  state.rng = rng.serialize();
  return resolution;
}

export function abort(state: HeistState): void {
  if (state.outcome !== 'ongoing') return;
  state.phase = 'ended';
  state.outcome = 'aborted';
  state.cause = '本轮在这里收壳：没有假装已经撤出去，也没有假装这是胜利。';
  state.lastResult = [state.cause];
  pushTimeline(state, 'abort');
}

// ---------------------------------------------------------------------------
// Status / recap helpers
// ---------------------------------------------------------------------------

export function objectiveWindowFor(state: HeistState): number {
  return objectiveWindow(state);
}

export function currentNoiseLine(state: HeistState): string {
  if (!state.noise) return '没有确认的动静';
  return `${positionLabel(state.noise.pos)} · ${state.noise.source} · 强度 ${state.noise.intensity}`;
}

export function briefingLines(state: HeistState, full: boolean): string[] {
  const { facility, security, objective, complication } = missionOf(state);
  if (full) {
    return [
      `设施：${facility.title}（${facility.subtitle}）—— ${facility.brief}`,
      `安保：${security.title} —— ${security.brief}`,
      `目标：${objective.title} —— ${objective.brief}`,
      `麻烦：${complication.title} —— ${complication.brief}`,
      objective.clue,
      '提醒：vent 只适合进，带货后 vent 不再可滑；先想撤离线，再伸手。',
    ];
  }
  return [
    `安保 ${security.title} · 目标 ${objective.title} · 麻烦 ${complication.title}`,
    objective.clue,
    '提醒：先想撤离线，带货后 vent 失效。',
  ];
}

export function objectiveLines(state: HeistState): string[] {
  const { facility, objective } = missionOf(state);
  const profile = profileOf(state);
  const status = state.objectiveTaken ? '已到手' : state.objectiveKnown ? '已确认真目标' : '未确认';
  const lines = [
    `目标 ${status} · 终端 ${state.consoleUsed ? '已用' : '未用'} · 缓存 ${
      state.cacheOpened ? '已开' : '未开'
    } · 快门 ${exitIsBlocked(state) ? '卡着' : '可开'}`,
    `撤离窗 ${state.lockdown ?? '--'} 拍 · 目标分 ${state.score} · 撤离加成 +${
      profile?.extractionBonus ?? 0
    }`,
  ];
  if (state.objectiveKnown && !state.objectiveTaken) {
    lines.push(`真目标在 ${positionLabel(state.mission.trueSite)}（${objective.title}）。`);
  }
  if (state.carrying) {
    const discount = state.carryNoiseDiscount;
    const extra = Math.max(
      0,
      objective.carryNoise + missionOf(state).complication.carryNoiseBonus - discount,
    );
    lines.push(`带货噪音 +${extra}（缓存抵扣 ${discount}） · 出口 ${positionLabel(facility.exit)}`);
  } else if (state.cacheOpened) {
    lines.push(`缓存收益：${cacheRewardText(state)}。`);
  }
  return lines;
}

export function forecastLines(state: HeistState): string[] {
  const { security, complication, facility } = missionOf(state);
  const lines: string[] = [
    `巡逻下一拍：${positionLabel(nextPatrolPosition(state))}（当前 ${positionLabel(
      patrollerPosition(state),
    )}）。`,
  ];
  for (const watcher of watchersOf(state)) {
    lines.push(
      `${watcher.title} @ ${positionLabel(watcher.position)} 朝${
        watcher.facing === 'left' ? '左' : '右'
      } ${watcher.range} 格。`,
    );
  }
  if (security.camera) {
    if (state.cameraDown > 0) {
      lines.push(`镜头停摆 ${state.cameraDown} 拍。`);
    } else {
      const nextPhase = (state.cameraPhase + 1) % security.camera.patterns.length;
      const current =
        cameraCells(state)
          .map((site) => positionLabel(site))
          .join(' / ') || '停摆';
      const next = (security.camera.patterns[nextPhase] ?? [])
        .map((site) => positionLabel(site))
        .join(' / ');
      lines.push(`镜头本拍扫 ${current}；再下一拍扫 ${next}。`);
    }
  }
  if (state.sensorsDown > 0) {
    lines.push(`Sensor 已钉哑 ${state.sensorsDown} 拍。`);
  } else {
    lines.push(serverSensorsLine(security.sensors));
  }
  if (state.responderPos) {
    lines.push(`快速响应者 @ ${positionLabel(state.responderPos)}。`);
  } else if (state.carrying || state.alert >= 2) {
    const countdown = Math.max(0, state.responderCountdown ?? 0);
    lines.push(countdown === 0 ? '快速响应者本拍切入。' : `快速响应者预计 ${countdown} 拍后切入。`);
  } else {
    lines.push('快速响应者尚未启动。');
  }
  if (complication.mode === 'steam') {
    lines.push(
      `蒸汽格 ${positionLabel(facility.steamCell)}：${steamActive(state) ? '本拍喷发' : '本拍安静'}（每 3 拍一次）。`,
    );
  }
  return lines;
}

function serverSensorsLine(sensors: Pos[]): string {
  if (sensors.length === 0) return 'Sensor 线：无。';
  return `Sensor 线：${sensors.map((site) => positionLabel(site)).join(' / ')}。`;
}

export function lastResultLines(state: HeistState): string[] {
  if (state.lastResult.length === 0) return ['还没有动作。'];
  const shown = state.lastResult.slice(-4);
  const lines = shown.map((line) => `- ${line}`);
  if (state.lastResult.length > shown.length) {
    lines.push(`- 另有 ${state.lastResult.length - shown.length} 条细节省略。`);
  }
  return lines;
}

export function mapRows(state: HeistState): string[] {
  const { facility } = missionOf(state);
  const patrol = patrollerPosition(state);
  const cameras = cameraCells(state);
  const watchers = watchersOf(state);
  const rows: string[] = [];
  for (let row = 0; row < 2; row += 1) {
    const cells: string[] = [];
    for (let col = 0; col < COLUMNS; col += 1) {
      const pos: Pos = [row, col];
      let actor = ' ';
      if (samePos(pos, state.position)) actor = 'L';
      else if (state.responderPos && samePos(pos, state.responderPos)) actor = 'R';
      else if (samePos(pos, patrol)) actor = 'P';
      else if (watchers.some((watcher) => samePos(watcher.position, pos))) actor = 'W';
      else if (cameras.some((site) => samePos(site, pos))) actor = '^';

      let feature = '.';
      if (samePos(pos, facility.exit)) feature = 'X';
      else if (samePos(pos, facility.console)) feature = 'T';
      else if (samePos(pos, facility.cache)) feature = '$';
      else if (facility.candidates.some((site) => samePos(site, pos))) {
        feature = candidateMark(state, pos);
      } else if (facility.vents.some((site) => samePos(site, pos))) feature = 'V';
      else if (steamActive(state) && samePos(pos, facility.steamCell)) feature = '~';
      else {
        const terrain = terrainAt(facility, pos);
        feature = terrain === 'cover' ? '#' : terrain === 'shadow' ? ':' : '.';
      }
      cells.push(`[${actor}${feature}]`);
    }
    rows.push(`${ROW_NAMES[row]} ${cells.join(' ')}`);
  }
  return rows;
}

export const MAP_LEGEND = [
  'L 你 · P 巡逻 · R 响应 · W 盯守 · ^ 镜头扫线',
  'X 出口 · T 终端 · $ 缓存 · O 真目标 · ? 货格 · E 空货格 · V 通风 · # 掩体 · : 暗格 · . 开阔 · ~ 蒸汽',
];

export function settlementScore(state: HeistState): number {
  let score = state.score;
  if (state.cacheOpened) score += 2;
  score -= state.alert;
  score -= Math.max(0, state.turn - 8);
  score -= state.inspected.filter((site) => !samePos(site, state.mission.trueSite)).length;
  if (state.outcome === 'won') score += 4;
  return Math.max(0, score);
}

export function finalNotes(state: HeistState): string[] {
  const { objective, complication } = missionOf(state);
  const notes: string[] = [];
  if (state.cacheOpened && state.outcome !== 'won') {
    notes.push('本局观察：侧缓存吃掉了取物前最贵的节奏；下局再验证这条绕路值不值。');
  }
  if (objective.consoleReveals && !state.consoleUsed) {
    notes.push('本局观察：这个目标包不先过终端，取物那一拍会更吵；下局验证先拐终端的成本。');
  }
  if (state.exposurePeak >= 7) {
    notes.push('本局观察：高曝光通常不是一回合炸出来的，而是连续两三拍待在能被压线的位置。');
  }
  if (state.outcome === 'won' && state.alert >= 2) {
    notes.push('本局观察：高警戒也能撤出去，但道具要留到带货段，而不是全花在进场。');
  }
  if (state.outcome === 'lost' && state.lockdown !== null && state.lockdown <= 0) {
    notes.push('本局观察：这次不是没摸到目标，而是拿到之后撤离线规划得不够早。');
  }
  if (complication.mode === 'jammed_exit' && !state.consoleUsed && state.profile !== 'breaker') {
    notes.push('本局观察：快门卡涩的局，终端不是装饰；不提前处理，出口会把你活活卡住。');
  }
  if (notes.length === 0) {
    notes.push(
      '本局观察：先记录哪一格最容易把你暴露，再用下一局验证它是 package 差异还是路线选择。',
    );
  }
  return notes.slice(0, 4);
}

export function outcomeHeadline(state: HeistState): string {
  if (state.outcome === 'won') return '带货撤离';
  if (state.outcome === 'lost') return '被设施装箱';
  if (state.outcome === 'aborted') return '中止收壳';
  return state.carrying ? '带货撤离中' : '潜入中';
}
