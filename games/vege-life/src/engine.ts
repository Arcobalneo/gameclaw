/**
 * Run state machine for 素食人生 / Vege Life.
 *
 * Sixteen seats, one action each. The opening roll tells you who you are.
 * Every later number comes from the seat you are sitting at and the action
 * you pick. A bite of meat never feeds you. Surviving all sixteen seats is
 * not a win — you still have to settle a table.
 */

import { type ActionResult, type ActionView, type GameEvent, Rng } from '@gameclaw/gamekit';

import {
  type CreedId,
  ENDING_BASE,
  ENDING_CAUSE,
  ENDING_NAMES,
  type EndingId,
  FAMILY_BLURB,
  FAMILY_IDS,
  FAMILY_NAMES,
  type FamilyId,
  GENDER_IDS,
  GENDER_NAMES,
  type GenderId,
  HOUSE_CREEDS,
  type PersonalityId,
  PHASE_ENTER,
  PHASE_NAMES,
  PHASE_ORDER,
  type PhaseId,
  PROFILES,
  REASON_BLURB,
  REASON_IDS,
  REASON_NAMES,
  SCENE_TEMPLATES,
  type SceneKind,
  STEREOTYPE,
  WHO_NAMES,
  type Who,
  WIN_ENDINGS,
} from './content';

export type Outcome = 'ongoing' | 'won' | 'lost' | 'aborted';

export interface Scene {
  id: string;
  phase: PhaseId;
  kind: SceneKind;
  title: string;
  heat: number;
  vegOnTable: boolean;
  who: Who;
  thin: boolean;
  blurb: string;
}

export interface VegeState {
  seed: number;
  difficulty: string;
  turn: number;
  maxTurns: number;
  gender: GenderId;
  personality: PersonalityId;
  family: FamilyId;
  reason: ReasonId;
  houseCreed: CreedId;
  creedGap: boolean;
  namedDifference: boolean;
  body: number;
  home: number;
  room: number;
  line: number;
  prep: number;
  clash: number;
  holds: number;
  shares: number;
  names: number;
  nameWins: number;
  leaves: number;
  bites: number;
  stocks: number;
  brings: number;
  differs: number;
  scenes: Scene[];
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  ending?: EndingId;
  cause: string;
  score: number;
  rng: number[];
}

type ReasonId = (typeof REASON_IDS)[number];

export const MAX_TURNS = 16;
export const STAT_MAX = 8;
export const PREP_MAX = 3;
export const HOST_LINE = 6;
export const HOST_BODY = 3;
export const HOST_PREP = 1;
export const TRUCE_HOME = 6;
export const TRUCE_BODY = 3;
export const TRUCE_LINE = 2;
export const SCRIPT_ROOM = 7;
export const SCRIPT_BODY = 3;
export const SCRIPT_LINE = 4;
export const SPLIT_HOME = 4;
export const SPLIT_LINE = 5;
export const SPLIT_BODY = 3;
export const CLASH_NEED = 3;
export const CLASH_BODY = 2;
export const CLASH_HOME = 2;

const NOTES_LIMIT = 6;
const TIMELINE_LIMIT = 40;

interface Patch {
  body: number;
  home: number;
  room: number;
  line: number;
  prep: number;
  clash: number;
}

interface ParsedContent {
  gender?: GenderId;
  personality?: PersonalityId;
  family?: FamilyId;
  gap: boolean;
}

function emptyPatch(): Patch {
  return { body: 0, home: 0, room: 0, line: 0, prep: 0, clash: 0 };
}

function clampStat(value: number): number {
  return Math.max(0, Math.min(STAT_MAX, value));
}

function clampPrep(value: number): number {
  return Math.max(0, Math.min(PREP_MAX, value));
}

function clampStart(value: number): number {
  return Math.max(1, Math.min(STAT_MAX, value));
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function costOf(patch: Patch): string {
  const parts: string[] = [];
  if (patch.body) parts.push(`身体 ${signed(patch.body)}`);
  if (patch.home) parts.push(`家人 ${signed(patch.home)}`);
  if (patch.room) parts.push(`场面 ${signed(patch.room)}`);
  if (patch.line) parts.push(`立场 ${signed(patch.line)}`);
  if (patch.prep) parts.push(`备菜 ${signed(patch.prep)}`);
  if (patch.clash) parts.push(`冲突 ${signed(patch.clash)}`);
  return parts.join('，') || '无数值变化';
}

function isGender(value: string): value is GenderId {
  return (GENDER_IDS as readonly string[]).includes(value);
}

function isPersonality(value: string): value is PersonalityId {
  return (['steady', 'soft', 'sharp'] as const).includes(value as PersonalityId);
}

function isFamily(value: string): value is FamilyId {
  return (FAMILY_IDS as readonly string[]).includes(value);
}

function parseContent(content: string | undefined): ParsedContent {
  const parsed: ParsedContent = { gap: false };
  if (!content) return parsed;
  for (const token of content.split(/[:/,]/)) {
    const name = token.trim();
    if (!name) continue;
    if (isGender(name)) parsed.gender = name;
    else if (isPersonality(name)) parsed.personality = name;
    else if (isFamily(name)) parsed.family = name;
    else if (name === 'gap') parsed.gap = true;
  }
  return parsed;
}

function vegFor(
  rule: (typeof SCENE_TEMPLATES)[number]['veg'],
  family: FamilyId,
  rng: Rng,
): boolean {
  if (rule === 'always') return true;
  if (rule === 'never') return false;
  if (rule === 'house') return family === 'veg';
  return rng.chance(0.5);
}

function buildScenes(rng: Rng, family: FamilyId): Scene[] {
  const scenes: Scene[] = [];
  for (const phase of PHASE_ORDER) {
    const templates = SCENE_TEMPLATES.filter((template) => template.phase === phase);
    for (const template of rng.shuffle(templates)) {
      const heat = template.id === 'homecoming' ? (family === 'veg' ? 1 : 3) : template.heat;
      scenes.push({
        id: template.id,
        phase: template.phase,
        kind: template.kind,
        title: template.title,
        heat,
        vegOnTable: vegFor(template.veg, family, rng),
        who: template.who,
        thin: template.thin === true,
        blurb: template.blurb,
      });
    }
  }
  return scenes;
}

export function createRun(options: {
  seed: number;
  content?: string;
  difficulty?: string;
}): VegeState {
  const parsed = parseContent(options.content);
  const difficulty =
    options.difficulty === 'easy' || options.difficulty === 'hard' ? options.difficulty : 'normal';
  const rng = Rng.fromSeed(options.seed);
  const gender = parsed.gender ?? rng.pick(GENDER_IDS);
  const personality = parsed.personality ?? rng.pick(['steady', 'soft', 'sharp'] as const);
  const family = parsed.family ?? rng.pick(FAMILY_IDS);
  const reason = rng.pick(REASON_IDS);
  let houseCreed: CreedId = 'none';
  if (family === 'veg') houseCreed = rng.pick(HOUSE_CREEDS);
  if (parsed.gap && family === 'veg' && houseCreed === reason) {
    houseCreed = HOUSE_CREEDS.find((creed) => creed !== reason) ?? 'faith';
  }
  const profile = PROFILES[personality];
  const swing = difficulty === 'easy' ? 1 : difficulty === 'hard' ? -1 : 0;
  const homeMod = family === 'meat' ? -1 : 2;
  const roomMod = gender === 'nonbinary' ? -1 : 0;

  return {
    seed: options.seed,
    difficulty,
    turn: 0,
    maxTurns: MAX_TURNS,
    gender,
    personality,
    family,
    reason,
    houseCreed,
    creedGap: family === 'veg' && houseCreed !== reason,
    namedDifference: false,
    body: clampStart(profile.body + swing),
    home: clampStart(profile.home + homeMod + swing),
    room: clampStart(profile.room + roomMod),
    line: clampStart(profile.line),
    prep: clampPrep(profile.prep),
    clash: 0,
    holds: 0,
    shares: 0,
    names: 0,
    nameWins: 0,
    leaves: 0,
    bites: 0,
    stocks: 0,
    brings: 0,
    differs: 0,
    scenes: buildScenes(rng, family),
    notes: ['十六席。活到最后不算赢，立席要自己收束。'],
    timeline: [],
    outcome: 'ongoing',
    cause: '',
    score: 0,
    rng: rng.serialize(),
  };
}

export function phaseOf(turn: number): PhaseId {
  if (turn < 4) return 'home';
  if (turn < 8) return 'school';
  if (turn < 12) return 'out';
  return 'seat';
}

export function sceneOf(state: VegeState): Scene {
  const scene = state.scenes[Math.min(state.turn, state.scenes.length - 1)];
  if (!scene) throw new Error('这一局没有席面。');
  return scene;
}

function pushNote(state: VegeState, line: string): void {
  state.notes.push(line);
  while (state.notes.length > NOTES_LIMIT) state.notes.shift();
}

function pushTimeline(state: VegeState, line: string): void {
  state.timeline.push(line);
  while (state.timeline.length > TIMELINE_LIMIT) state.timeline.shift();
}

function bond(scene: Scene, amount: number, patch: Patch): void {
  if (amount === 0) return;
  if (scene.who === 'family') patch.home += amount;
  else if (scene.who === 'class' || scene.who === 'work') patch.room += amount;
}

function bondWord(scene: Scene): string {
  return scene.who === 'family' ? '家人' : '场面';
}

export function nameOdds(
  state: VegeState,
  scene: Scene,
): { mod: number; need: number; faces: number } {
  let mod = 0;
  if (state.personality === 'steady') mod += 1;
  if (state.personality === 'sharp') mod += scene.who === 'family' ? -1 : 1;
  if (state.difficulty === 'easy') mod += 1;
  if (state.difficulty === 'hard') mod -= 1;
  let need = 3 + scene.heat;
  if (state.creedGap && scene.who === 'family') need += 1;
  let faces = 0;
  for (let roll = 1; roll <= 6; roll += 1) {
    if (roll + mod >= need) faces += 1;
  }
  return { mod, need, faces };
}

function holdPatch(state: VegeState, scene: Scene): Patch {
  const patch = emptyPatch();
  if (scene.kind === 'kitchen' || scene.kind === 'settle') {
    patch.body += 2;
    patch.line += 1;
    return patch;
  }
  if (scene.vegOnTable) {
    patch.body += scene.thin ? 1 : 2;
    if (scene.heat >= 2) {
      patch.line += 1;
      bond(scene, -1, patch);
    }
  } else {
    patch.body -= 1;
    patch.line += 1;
    bond(scene, -1, patch);
    if (state.family === 'meat' && scene.who === 'family' && scene.heat >= 2) patch.clash += 1;
  }
  if (state.personality === 'sharp' && scene.heat >= 2) patch.line += 1;
  if (state.gender === 'male' && scene.id === 'client') patch.room -= 1;
  return patch;
}

function sharePatch(state: VegeState, scene: Scene): Patch {
  const patch = emptyPatch();
  if (scene.kind === 'label') {
    bond(scene, 1, patch);
    patch.line -= 1;
    return patch;
  }
  if (scene.vegOnTable) {
    patch.body += 1;
    bond(scene, 1, patch);
    if (scene.heat >= 3 && state.personality !== 'soft') patch.line -= 1;
    return patch;
  }
  if (scene.heat >= 3) {
    patch.body -= 1;
    patch.line -= 1;
    return patch;
  }
  bond(scene, 1, patch);
  if (state.personality !== 'soft') patch.line -= 1;
  return patch;
}

function leavePatch(state: VegeState, scene: Scene): Patch {
  const patch = emptyPatch();
  patch.line += state.personality === 'sharp' ? 2 : 1;
  bond(scene, state.personality === 'steady' ? -1 : -2, patch);
  if (scene.kind === 'meal') {
    patch.body -= 1;
    if (state.family === 'meat' && scene.who === 'family' && scene.heat >= 2) patch.clash += 1;
  }
  if (state.gender === 'male' && scene.id === 'client') patch.room -= 1;
  return patch;
}

function bitePatch(scene: Scene): Patch {
  const patch = emptyPatch();
  bond(scene, 2, patch);
  patch.line -= 2;
  patch.body -= 2;
  return patch;
}

function bringPatch(scene: Scene): Patch {
  const patch = emptyPatch();
  patch.prep -= 1;
  patch.body += 1;
  patch.line += 1;
  bond(scene, 1, patch);
  return patch;
}

function stockPatch(state: VegeState): Patch {
  const patch = emptyPatch();
  patch.prep += Math.min(2, PREP_MAX - state.prep);
  patch.body += 1;
  patch.line += 1;
  return patch;
}

function differPatch(): Patch {
  const patch = emptyPatch();
  patch.home -= 1;
  patch.line += 1;
  return patch;
}

function riskFor(state: VegeState, patch: Patch): 'low' | 'medium' | 'high' {
  const body = state.body + patch.body;
  const home = state.home + patch.home;
  const room = state.room + patch.room;
  const line = state.line + patch.line;
  const clash = state.clash + patch.clash;
  if (body <= 0 || home <= 0 || room <= 0 || line <= 0) return 'high';
  if (state.family === 'meat' && clash >= CLASH_NEED && body <= CLASH_BODY && home <= CLASH_HOME) {
    return 'high';
  }
  if (patch.body < 0 || patch.line < 0 || patch.home < 0 || patch.room < 0 || patch.clash > 0) {
    return 'medium';
  }
  return 'low';
}

function holdDetail(state: VegeState, scene: Scene): string {
  if (scene.kind === 'kitchen' || scene.kind === 'settle') {
    return '自己的桌子。吃完这顿，不处理别人的眼光。';
  }
  if (scene.vegOnTable && scene.thin) return '有素，但分量小。身体 +1，立场不动。';
  if (scene.vegOnTable && scene.heat < 2) return '桌上有你的菜，没人逼你。身体 +2。这顿不涨立场。';
  if (scene.vegOnTable) return '桌上有你的菜，但这桌很吵。身体 +2，立场 +1，关系 -1。';
  const male =
    state.gender === 'male' && scene.id === 'client' ? '男客在这桌守空盘，场面再掉 1。' : '';
  return `桌上没有你的菜。守着空盘子会掉身体，家里还可能叠冲突。${male}`;
}

function shareDetail(state: VegeState, scene: Scene): string {
  if (scene.kind === 'label') return '不反驳这个称呼。关系涨一点，立场掉一点。';
  if (!scene.vegOnTable) {
    return scene.heat >= 3
      ? '热度 3 的空桌不给你加分。身体 -1，立场 -1，关系不动。'
      : state.personality === 'soft'
        ? '热度不高。关系 +1，软的人不掉立场，这顿也不扣身体。'
        : '热度不高。关系 +1，立场 -1，这顿不扣身体。';
  }
  return state.personality === 'soft'
    ? '桌上有素。身体和关系都涨。软的人在吵桌上也不掉立场。'
    : '桌上有素。身体和关系都涨。热度 3 时立场 -1。';
}

function nameDetail(state: VegeState, scene: Scene): string {
  const odds = nameOdds(state, scene);
  const meal = scene.kind === 'meal';
  return `掷 1d6${signed(odds.mod)}，需要 ${odds.need}，约 ${odds.faces}/6。说动：${bondWord(scene)} +2，立场 +1${meal && scene.vegOnTable ? '，身体 +1' : ''}。没说动：${bondWord(scene)} -1${meal ? '，身体 -1' : ''}。`;
}

function canDiffer(state: VegeState, scene: Scene): boolean {
  if (state.family !== 'veg' || !state.creedGap || state.namedDifference) return false;
  return phaseOf(state.turn) === 'seat' || scene.who === 'family';
}

function canHost(state: VegeState): boolean {
  return state.line >= HOST_LINE && state.body >= HOST_BODY && state.prep >= HOST_PREP;
}

function canTruce(state: VegeState): boolean {
  return state.home >= TRUCE_HOME && state.body >= TRUCE_BODY && state.line >= TRUCE_LINE;
}

function canScript(state: VegeState): boolean {
  return state.room >= SCRIPT_ROOM && state.body >= SCRIPT_BODY && state.line >= SCRIPT_LINE;
}

function canSplit(state: VegeState): boolean {
  return (
    state.family === 'veg' &&
    state.creedGap &&
    state.namedDifference &&
    state.home >= SPLIT_HOME &&
    state.line >= SPLIT_LINE &&
    state.body >= SPLIT_BODY
  );
}

function makeAction(
  id: string,
  label: string,
  detail: string,
  risk: 'low' | 'medium' | 'high',
  cost: string,
  tags: string[],
): ActionView {
  return { id, label, detail, risk, cost, tags };
}

export function actionsOf(state: VegeState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const scene = sceneOf(state);
  const actions: ActionView[] = [];

  if (scene.kind === 'meal' || scene.kind === 'kitchen' || scene.kind === 'settle') {
    const patch = holdPatch(state, scene);
    const label =
      scene.kind === 'kitchen' || scene.kind === 'settle' ? '自己吃一顿' : '守自己的盘子';
    actions.push(
      makeAction('hold', label, holdDetail(state, scene), riskFor(state, patch), costOf(patch), [
        'plate',
      ]),
    );
  }

  if (scene.kind === 'meal' || scene.kind === 'label') {
    const patch = sharePatch(state, scene);
    const label = scene.kind === 'label' ? '把话带过去' : '同席只夹素';
    actions.push(
      makeAction('share', label, shareDetail(state, scene), riskFor(state, patch), costOf(patch), [
        'table',
      ]),
    );
  }

  if ((scene.kind === 'meal' || scene.kind === 'label') && nameOdds(state, scene).faces > 0) {
    actions.push(
      makeAction('name', '把话说清', nameDetail(state, scene), 'medium', '1 次判定', ['talk']),
    );
  }

  if (scene.kind === 'meal' && !scene.vegOnTable && state.prep >= 1) {
    const patch = bringPatch(scene);
    actions.push(
      makeAction(
        'bring',
        '把备菜摆上',
        '消耗 1 备菜，摆上一盘大家都能夹的。不叠冲突。',
        riskFor(state, patch),
        costOf(patch),
        ['cook'],
      ),
    );
  }

  if (scene.kind === 'meal' && !scene.vegOnTable) {
    const patch = bitePatch(scene);
    actions.push(
      makeAction(
        'bite',
        '为场面咬一口',
        `这一口不提供体力。${bondWord(scene)} +2，身体 -2，立场 -2。`,
        'high',
        costOf(patch),
        ['risk'],
      ),
    );
  }

  if (scene.kind === 'meal' || scene.kind === 'label') {
    const patch = leavePatch(state, scene);
    const label = scene.kind === 'label' ? '不接这个话' : '离席';
    const detail =
      scene.kind === 'label'
        ? '把话放下就走。吃饭的席才会扣身体；这一席不扣。'
        : state.personality === 'steady'
          ? '离开。稳的人关系只 -1，但这顿没吃。'
          : state.personality === 'sharp'
            ? '离开。烈的人立场 +2，关系 -2，这顿没吃。'
            : '离开。关系 -2，立场 +1，这顿没吃。';
    actions.push(
      makeAction('leave', label, detail, riskFor(state, patch), costOf(patch), ['exit']),
    );
  }

  if (scene.kind === 'kitchen' && state.prep < PREP_MAX) {
    const patch = stockPatch(state);
    actions.push(
      makeAction(
        'stock',
        '备菜',
        '花这一席做菜，自己也吃一点。备菜留给后面没有素菜的桌子。',
        riskFor(state, patch),
        costOf(patch),
        ['cook'],
      ),
    );
  }

  if (canDiffer(state, scene)) {
    const patch = differPatch();
    actions.push(
      makeAction(
        'differ',
        '说开分歧',
        '承认家里和你素的理由不一样。说开之后，立席才可能走分席。',
        riskFor(state, patch),
        costOf(patch),
        ['talk'],
      ),
    );
  }

  if (phaseOf(state.turn) === 'seat') {
    if (canHost(state)) {
      actions.push(
        makeAction('settle:host', '收束·自席', ENDING_CAUSE.host, 'low', '1 备菜', ['settle']),
      );
    }
    if (canTruce(state)) {
      actions.push(
        makeAction('settle:truce', '收束·同桌', ENDING_CAUSE.truce, 'low', '收束', ['settle']),
      );
    }
    if (canScript(state)) {
      actions.push(
        makeAction('settle:script', '收束·外席', ENDING_CAUSE.script, 'low', '收束', ['settle']),
      );
    }
    if (canSplit(state)) {
      actions.push(
        makeAction('settle:split', '收束·分席', ENDING_CAUSE.split, 'low', '收束', ['settle']),
      );
    }
  }

  return actions;
}

function ensureOngoing(state: VegeState): void {
  if (state.outcome !== 'ongoing') throw new Error('这一局已经收尾了，用 recap 查看结算。');
}

function canExecute(state: VegeState, actionId: string): boolean {
  if (actionsOf(state).some((action) => action.id === actionId)) return true;
  if (actionId !== 'name') return false;
  const scene = sceneOf(state);
  return scene.kind === 'meal' || scene.kind === 'label';
}

function applyPatch(state: VegeState, patch: Patch): string {
  const before = {
    body: state.body,
    home: state.home,
    room: state.room,
    line: state.line,
    prep: state.prep,
    clash: state.clash,
  };
  state.body = clampStat(state.body + patch.body);
  state.home = clampStat(state.home + patch.home);
  state.room = clampStat(state.room + patch.room);
  state.line = clampStat(state.line + patch.line);
  state.prep = clampPrep(state.prep + patch.prep);
  state.clash = Math.max(0, state.clash + patch.clash);
  if (state.clash > before.clash) {
    pushNote(state, `家里的冲突叠到 ${state.clash}。到 3 且身体≤2、家人≤2 会爆。`);
  }
  if (before.body > CLASH_BODY && state.body <= CLASH_BODY && state.body > 0) {
    pushNote(state, `身体只剩 ${state.body}。空肚子再守一次就危险。`);
  }
  if (before.line > 2 && state.line <= 2 && state.line > 0) {
    pushNote(state, `立场只剩 ${state.line}。再沉默或再咬，身份会散。`);
  }
  return costOf({
    body: state.body - before.body,
    home: state.home - before.home,
    room: state.room - before.room,
    line: state.line - before.line,
    prep: state.prep - before.prep,
    clash: state.clash - before.clash,
  });
}

function resolveName(
  state: VegeState,
  scene: Scene,
  rng: Rng,
): { patch: Patch; success: boolean; roll: number; mod: number; need: number } {
  const odds = nameOdds(state, scene);
  const roll = rng.int(1, 6);
  const success = roll + odds.mod >= odds.need;
  const patch = emptyPatch();
  if (success) {
    bond(scene, 2, patch);
    patch.line += 1;
    if (scene.kind === 'meal' && scene.vegOnTable) patch.body += 1;
  } else {
    bond(scene, -1, patch);
    if (scene.kind === 'meal') {
      patch.body -= 1;
      if (state.family === 'meat' && scene.who === 'family' && scene.heat >= 2) patch.clash += 1;
    }
  }
  return { patch, success, roll, mod: odds.mod, need: odds.need };
}

function finish(state: VegeState, ending: EndingId): void {
  state.ending = ending;
  state.outcome = WIN_ENDINGS.has(ending) ? 'won' : 'lost';
  state.cause = ENDING_CAUSE[ending];
  state.score = scoreOf(state);
}

function collapseEnding(state: VegeState): EndingId | null {
  if (state.line <= 0) return 'dissolved';
  if (state.body <= 0) return 'anorexia';
  if (state.home <= 0) return 'cutoff';
  if (state.room <= 0) return 'labeled';
  if (
    state.family === 'meat' &&
    state.clash >= CLASH_NEED &&
    state.body <= CLASH_BODY &&
    state.home <= CLASH_HOME
  ) {
    return 'clash';
  }
  return null;
}

function perform(
  state: VegeState,
  scene: Scene,
  actionId: string,
  rng: Rng,
  log: string[],
  events: GameEvent[],
): void {
  if (actionId === 'hold') {
    state.holds += 1;
    const delta = applyPatch(state, holdPatch(state, scene));
    const lead =
      scene.kind === 'kitchen' || scene.kind === 'settle'
        ? '你在自己的桌上吃完了一顿'
        : scene.vegOnTable
          ? '你吃了自己的那一盘'
          : '桌上没有你的菜，你守着空盘子';
    log.push(`${lead}。（${delta}）`);
    return;
  }
  if (actionId === 'share') {
    state.shares += 1;
    const delta = applyPatch(state, sharePatch(state, scene));
    const lead =
      scene.kind === 'label' ? '你把这个称呼笑过去了' : '你坐下，只夹能吃的，没把理由摊开';
    log.push(`${lead}。（${delta}）`);
    return;
  }
  if (actionId === 'name') {
    const result = resolveName(state, scene, rng);
    state.names += 1;
    if (result.success) state.nameWins += 1;
    const delta = applyPatch(state, result.patch);
    const total = result.roll + result.mod;
    const verdict = `判定 ${result.roll}${signed(result.mod)}=${total}，${result.success ? '过了' : '需要'} ${result.need}`;
    log.push(
      result.success
        ? `你把话说清了。${verdict}。（${delta}）`
        : `你说了，没说动。${verdict}。（${delta}）`,
    );
    events.push({
      type: 'check',
      action: 'name',
      roll: result.roll,
      mod: result.mod,
      need: result.need,
      total,
      success: result.success,
    });
    return;
  }
  if (actionId === 'bring') {
    state.brings += 1;
    const delta = applyPatch(state, bringPatch(scene));
    log.push(`你把备好的菜摆上去。这一桌终于有你能吃的。（${delta}）`);
    return;
  }
  if (actionId === 'bite') {
    state.bites += 1;
    const delta = applyPatch(state, bitePatch(scene));
    log.push(`你为了这一桌咬了一口。恶心是真的，立场也掉了。这一口不提供体力。（${delta}）`);
    return;
  }
  if (actionId === 'leave') {
    state.leaves += 1;
    const delta = applyPatch(state, leavePatch(state, scene));
    const lead = scene.kind === 'label' ? '你不接这个话' : '你离席';
    log.push(`${lead}。（${delta}）`);
    return;
  }
  if (actionId === 'stock') {
    state.stocks += 1;
    const delta = applyPatch(state, stockPatch(state));
    log.push(`你备了菜，自己也吃了一点。备菜现在是 ${state.prep}。（${delta}）`);
    return;
  }
  if (actionId === 'differ') {
    state.differs += 1;
    state.namedDifference = true;
    const delta = applyPatch(state, differPatch());
    log.push(`你说：我们都吃素，但不是为了同一件事。（${delta}）`);
    pushNote(state, '分歧已经说开。立席若门槛够，可以走分席。');
    return;
  }
  if (actionId === 'settle:host') {
    state.prep -= 1;
    finish(state, 'host');
    log.push(state.cause);
    return;
  }
  if (actionId === 'settle:truce') {
    finish(state, 'truce');
    log.push(state.cause);
    return;
  }
  if (actionId === 'settle:script') {
    finish(state, 'script');
    log.push(state.cause);
    return;
  }
  if (actionId === 'settle:split') {
    finish(state, 'split');
    log.push(state.cause);
    return;
  }
  throw new Error(`不认识的动作：${actionId}`);
}

function actionLabel(actionId: string): string {
  const labels: Record<string, string> = {
    hold: '守盘',
    share: '同席',
    name: '说清',
    bring: '摆菜',
    bite: '咬一口',
    leave: '离席',
    stock: '备菜',
    differ: '说开',
    'settle:host': '自席',
    'settle:truce': '同桌',
    'settle:script': '外席',
    'settle:split': '分席',
  };
  return labels[actionId] ?? actionId;
}

export function act(state: VegeState, actionId: string): ActionResult {
  ensureOngoing(state);
  if (!canExecute(state, actionId)) throw new Error(`这一席不能做：${actionId}`);
  const scene = sceneOf(state);
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  const events: GameEvent[] = [];

  perform(state, scene, actionId, rng, log, events);
  state.rng = rng.serialize();

  if (state.outcome === 'ongoing') {
    const collapsed = collapseEnding(state);
    if (collapsed) {
      finish(state, collapsed);
      log.push(state.cause);
    }
  }

  const played = state.turn + 1;
  const previousPhase = phaseOf(state.turn);
  state.turn += 1;
  if (
    state.outcome === 'ongoing' &&
    state.turn < MAX_TURNS &&
    previousPhase !== phaseOf(state.turn)
  ) {
    const entered = PHASE_ENTER[phaseOf(state.turn)];
    if (entered) {
      log.push(entered);
      pushNote(state, entered);
    }
  }
  if (state.outcome === 'ongoing' && state.turn >= MAX_TURNS) {
    finish(state, 'loose');
    log.push(state.cause);
  }

  const endingName = state.ending ? ` → ${ENDING_NAMES[state.ending]}` : '';
  pushTimeline(state, `第 ${played} 席 · ${scene.title} · ${actionLabel(actionId)}${endingName}`);
  events.push({
    type: 'act',
    action: actionId,
    scene: scene.id,
    turn: played,
    body: state.body,
    home: state.home,
    room: state.room,
    line: state.line,
    prep: state.prep,
    clash: state.clash,
    ending: state.ending ?? null,
  });
  return { log, events };
}

export function scoreOf(state: VegeState): number {
  const ending = state.ending ?? 'aborted';
  const raw =
    ENDING_BASE[ending] +
    state.body * 2 +
    state.home +
    state.room +
    state.line * 2 +
    state.prep * 2 -
    state.bites * 3;
  return Math.max(0, raw);
}

function gateLines(state: VegeState): string[] {
  const seat = phaseOf(state.turn) === 'seat';
  const mark = (ready: boolean): string => (ready && seat ? '可走' : '未到');
  return [
    `${mark(canHost(state))} 自席：立场≥${HOST_LINE}（现 ${state.line}），身体≥${HOST_BODY}（现 ${state.body}），备菜≥${HOST_PREP}（现 ${state.prep}），且在立席`,
    `${mark(canTruce(state))} 同桌：家人≥${TRUCE_HOME}（现 ${state.home}），身体≥${TRUCE_BODY}（现 ${state.body}），立场≥${TRUCE_LINE}（现 ${state.line}），且在立席`,
    `${mark(canScript(state))} 外席：场面≥${SCRIPT_ROOM}（现 ${state.room}），身体≥${SCRIPT_BODY}（现 ${state.body}），立场≥${SCRIPT_LINE}（现 ${state.line}），且在立席`,
    `${mark(canSplit(state))} 分席：素食家庭、理由不同且已说开，家人≥${SPLIT_HOME}（现 ${state.home}），立场≥${SPLIT_LINE}（现 ${state.line}），身体≥${SPLIT_BODY}（现 ${state.body}），且在立席`,
    '身体到 0 是厌食，家人到 0 是断席，场面到 0 是标签，立场到 0 是随席。',
    state.family === 'meat'
      ? `冲突到 ${CLASH_NEED} 且身体≤${CLASH_BODY}、家人≤${CLASH_HOME} 是冲突。家人先到 0 则算断席。`
      : '这户人家不走肉食家庭的冲突条。',
    '十六席结束仍没收束，是没收束。',
  ];
}

function familyLines(state: VegeState): string[] {
  const lines = [FAMILY_BLURB[state.family], `备菜 ${state.prep}/${PREP_MAX}。`];
  if (state.family === 'veg') {
    const creed = state.houseCreed === 'none' ? '没有单独的理由' : REASON_NAMES[state.houseCreed];
    const gap = state.creedGap ? '和你不一样。' : '和你一样。';
    const said = state.namedDifference
      ? '这句话你已经说开了。'
      : state.creedGap
        ? '还没说开，分席不会出现。'
        : '';
    lines.splice(1, 0, `家人的理由是${creed}。${gap}${said}`);
  } else {
    lines.splice(
      1,
      0,
      `冲突 ${state.clash}/${CLASH_NEED}。没素菜且热度≥2 的家里，硬守、离席或没说动会 +1。`,
    );
  }
  return lines;
}

export function statusOf(state: VegeState): {
  headline: string;
  metrics: { label: string; value: string | number; hint?: string }[];
  sections: { title: string; lines: string[] }[];
  outcome: Outcome;
  turn: number;
  phase?: string;
} {
  const scene = sceneOf(state);
  const phase = phaseOf(Math.min(state.turn, MAX_TURNS - 1));
  const profile = PROFILES[state.personality];
  const headline =
    state.outcome === 'ongoing'
      ? `${PHASE_NAMES[phase]} · 第 ${state.turn + 1}/${state.maxTurns} 席 · ${GENDER_NAMES[state.gender]}·${profile.name} · ${FAMILY_NAMES[state.family]} · 身体 ${state.body} 家人 ${state.home} 场面 ${state.room} 立场 ${state.line}`
      : `${ENDING_NAMES[state.ending ?? 'aborted']} · ${state.cause}`;

  const seatLines = [
    `${scene.title}：${scene.blurb}`,
    `热度 ${scene.heat}/3。${scene.vegOnTable ? '桌上有你能吃的。' : '桌上没有你的菜。'}`,
    `这一席算在${WHO_NAMES[scene.who]}上。`,
  ];
  if (scene.kind === 'label') seatLines.push(`别人会用的词是「${STEREOTYPE[state.gender]}」。`);
  if (state.gender === 'male' && scene.id === 'client') {
    seatLines.push('你是男的。这桌守空盘或离席，场面多掉 1。');
  }

  const sections = [
    { title: '这一席', lines: seatLines },
    {
      title: '你是谁',
      lines: [
        `${GENDER_NAMES[state.gender]} · ${profile.name}。${profile.blurb}`,
        `理由：${REASON_NAMES[state.reason]}。${REASON_BLURB[state.reason]}`,
        '你是自己选的素食者，不是「胎内素」：不是母亲孕期吃素，所以你天生不吃。',
      ],
    },
    { title: '家里', lines: familyLines(state) },
    { title: '收束', lines: gateLines(state) },
  ];
  if (state.notes.length > 0) sections.push({ title: '记下', lines: [...state.notes] });

  const metrics = [
    { label: '身体', value: state.body, hint: '到 0 为厌食' },
    { label: '家人', value: state.home, hint: '到 0 为断席' },
    { label: '场面', value: state.room, hint: '到 0 为标签' },
    { label: '立场', value: state.line, hint: '到 0 为随席' },
    { label: '备菜', value: state.prep },
  ];
  if (state.family === 'meat' || state.clash > 0) {
    metrics.push({ label: '冲突', value: state.clash, hint: '肉食家庭叠满会爆' });
  }

  return {
    headline,
    metrics,
    sections,
    outcome: state.outcome,
    turn: state.turn,
    phase:
      state.outcome === 'ongoing' ? PHASE_NAMES[phase] : ENDING_NAMES[state.ending ?? 'aborted'],
  };
}

function lessonsOf(state: VegeState): string[] {
  const lessons: string[] = [];
  if (state.bites > 0) {
    lessons.push(`这一局咬了 ${state.bites} 口。那一口换来关系，不提供体力，还掉立场。`);
  }
  if (state.ending === 'anorexia') {
    lessons.push('守立场如果靠空肚子，身体会先结束这一局。有素菜就吃，没素菜就靠事先备的菜。');
  }
  if (state.ending === 'clash') {
    lessons.push('肉食家里，硬守和离席会叠冲突。冲突到 3 并且身体、家人都低时，会走「冲突」。');
  }
  if (state.ending === 'cutoff') {
    lessons.push('家人先归零是「断席」。要留在这张桌子上，得有同席、说动或备菜。');
  }
  if (state.ending === 'dissolved') {
    lessons.push('立场归零是「随席」。关系也许还在，但这一局已经说不清自己为什么不吃肉。');
  }
  if (state.ending === 'labeled') {
    lessons.push('场面归零是「标签」。只离席、不备菜、也不把话说清，外面会只剩一个称呼。');
  }
  if (state.family === 'veg' && state.creedGap && !state.namedDifference) {
    lessons.push('素食家庭但理由不同。这一局没有把分歧说开，所以走不到「分席」。');
  }
  if (state.namedDifference) {
    lessons.push(
      '你把「我们都吃素，但理由不同」说开了。这是这一家里的观察，不是下一户人家的规律。',
    );
  }
  if (state.brings === 0 && state.stocks === 0) {
    lessons.push('这一局没有备菜。空桌时守盘子会直接扣身体。');
  }
  if (lessons.length === 0) {
    lessons.push(
      '这一局没有单一的崩点。把开局的家庭和你实际选的动作对照一下，再决定下局要不要换打法。',
    );
  }
  return lessons.slice(0, 5);
}

export function recapOf(state: VegeState): {
  title: string;
  outcome: Outcome;
  cause: string;
  metrics: { label: string; value: string | number; hint?: string }[];
  timeline: string[];
  lessons: string[];
  memoryPrompt: string;
} {
  const ending = state.ending ?? 'aborted';
  const name = state.outcome === 'ongoing' ? '进行中' : ENDING_NAMES[ending];
  return {
    title: `素食人生 · ${name}`,
    outcome: state.outcome,
    cause: state.cause || '这一局还没收尾。',
    metrics: [
      { label: '结局', value: name },
      { label: '得分', value: state.score },
      { label: '身体', value: state.body },
      { label: '家人', value: state.home },
      { label: '场面', value: state.room },
      { label: '立场', value: state.line },
      { label: '家庭', value: FAMILY_NAMES[state.family] },
      { label: '理由', value: REASON_NAMES[state.reason] },
    ],
    timeline: state.timeline.slice(-10),
    lessons: lessonsOf(state),
    memoryPrompt:
      '把这一局的开局写进你自己的 memory：性别、性格、家里吃不吃肉、你的理由、有没有说开分歧。再记下你靠守盘、备菜、同席还是咬一口走到这个结局。这是这一局的观察，换一个家庭或性格要重新验证，不要写成所有素食者的规律。',
  };
}

export function abort(state: VegeState): void {
  state.ending = 'aborted';
  state.outcome = 'aborted';
  state.cause = ENDING_CAUSE.aborted;
  state.score = scoreOf(state);
}
