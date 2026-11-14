import {
  type ActionResult,
  type ActionView,
  type GameEvent,
  illegalAction,
  type Metric,
  type Outcome,
  type RecapView,
  Rng,
  type StatusSection,
  type StatusView,
} from '@gameclaw/gamekit';

import {
  ANGLE_IDS,
  ANGLES,
  type AngleId,
  type Attributes,
  COLOR_IDS,
  COLORS,
  type ColorId,
  DISTRICTS,
  ENDING_NAMES,
  type EndingId,
  GROWTH_INTERVAL,
  MAX_LEVEL,
  NATURE_IDS,
  NATURES,
  type NatureId,
  PARTNER_NAMES,
  POWER_IDS,
  POWERS,
  type PowerId,
  SIZE_NAMES,
  STAT_CAP,
  STAT_IDS,
  STAT_NAMES,
  type StatId,
  TIMING_IDS,
  TIMINGS,
  type TimingId,
  TRAIN_COST,
} from './content';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type Phase = 'nature' | 'color' | 'leap' | 'rescue' | 'ended';
export type JumpResult = 'perfect' | 'clean' | 'edge' | 'short' | 'long';

export interface Lamp {
  index: number;
  x: number;
  height: number;
  gap: number;
  rise: number;
  wind: number;
  window: TimingId;
  district: string;
}

export interface RescueState {
  partner: string;
  roundsLeft: number;
  round: number;
  progress: number;
  need: number;
  tension: number;
  maxTension: number;
  cue: TimingId;
}

export interface JumpRecord {
  level: number;
  actionId: string;
  result: JumpResult;
  landing: number;
  error: number;
  tolerance: number;
  stamina: number;
  falls: number;
}

export interface LeapState {
  version: 1;
  seed: number;
  difficulty: Difficulty;
  phase: Phase;
  personality: NatureId | null;
  color: ColorId | null;
  level: number;
  cleared: number;
  size: number;
  street: Lamp[];
  beat: number;
  stamina: number;
  sparks: number;
  falls: number;
  training: Attributes;
  bond: number;
  jumps: number;
  perfect: number;
  /** Consecutive perfect landings. Only a perfect continues it. */
  streak: number;
  bestStreak: number;
  rests: number;
  trained: number;
  rescues: number;
  rescueFailures: number;
  sinceRescue: number;
  rescue: RescueState | null;
  lastJump: JumpRecord | null;
  lastSetback: string;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  ending: EndingId | null;
  cause: string;
  score: number;
  rng: number[];
}

export interface JumpPreview {
  actionId: string;
  power: PowerId;
  angle: AngleId;
  timing: TimingId;
  landing: number;
  error: number;
  tolerance: number;
  result: JumpResult;
  cost: number;
  wind: number;
  window: TimingId;
}

export interface RescuePreview {
  actionId: string;
  progress: number;
  tension: number;
  force: number;
  result: 'success' | 'continue' | 'spent' | 'snap';
}

const PHASE_NAMES: Record<Phase, string> = {
  nature: '塑形',
  color: '上色',
  leap: '跳街',
  rescue: '黏连救援',
  ended: '结算',
};

const RESULT_NAMES: Record<JumpResult, string> = {
  perfect: '完美落地',
  clean: '站稳',
  edge: '擦边过关',
  short: '跳短',
  long: '跳远',
};

const GUSTS = [-1, 0, 1] as const;
const MAX_NOTES = 6;
const MAX_TIMELINE = 90;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function isNature(value: string): value is NatureId {
  return (NATURE_IDS as readonly string[]).includes(value);
}

function isColor(value: string): value is ColorId {
  return (COLOR_IDS as readonly string[]).includes(value);
}

function parseContent(content: string | undefined): {
  personality: NatureId | null;
  color: ColorId | null;
} {
  const parsed: { personality: NatureId | null; color: ColorId | null } = {
    personality: null,
    color: null,
  };
  if (!content) return parsed;
  for (const raw of content.split(/[:/,]/)) {
    const token = raw.trim();
    if (isNature(token)) parsed.personality = token;
    if (isColor(token)) parsed.color = token;
  }
  return parsed;
}

function emptyAttributes(): Attributes {
  return { spring: 0, control: 0, endurance: 0, grip: 0 };
}

export function visionOf(level: number): number {
  return Math.min(5, 2 + Math.floor((level - 1) / 10));
}

export function speedOf(level: number): number {
  return Math.min(3, 1 + Math.floor((level - 1) / GROWTH_INTERVAL));
}

export function districtOf(level: number): (typeof DISTRICTS)[number] {
  return DISTRICTS.find((district) => level <= district.until) ?? DISTRICTS[DISTRICTS.length - 1]!;
}

function appendLamp(state: LeapState, rng: Rng): void {
  const previous = state.street[state.street.length - 1];
  if (!previous || previous.index >= MAX_LEVEL) return;
  const index = previous.index + 1;
  const difficultyGap =
    state.difficulty === 'easy' ? -0.35 : state.difficulty === 'hard' ? 0.35 : 0;
  const gap = round2(3.6 + index * 0.08 + rng.int(0, 14) / 10 + difficultyGap);
  const proposedRise = rng.int(-1, index > GROWTH_INTERVAL ? 2 : 1);
  const height = clamp(previous.height + proposedRise, 2, 8);
  const windLimit = index > 30 ? 3 : index > 15 ? 2 : 1;
  state.street.push({
    index,
    x: round2(previous.x + gap),
    height,
    gap,
    rise: height - previous.height,
    wind: rng.int(-windLimit, windLimit),
    window: rng.pick(TIMING_IDS),
    district: districtOf(index).name,
  });
}

function ensureStreet(state: LeapState, rng: Rng): void {
  const lastVisible = Math.min(MAX_LEVEL, state.level - 1 + visionOf(state.level));
  while ((state.street[state.street.length - 1]?.index ?? 0) < lastVisible) {
    appendLamp(state, rng);
  }
}

export function createRun(options: {
  seed: number;
  content?: string;
  difficulty?: string;
}): LeapState {
  const rng = Rng.fromSeed(options.seed);
  const parsed = parseContent(options.content);
  const difficulty: Difficulty =
    options.difficulty === 'easy' || options.difficulty === 'hard' ? options.difficulty : 'normal';
  const state: LeapState = {
    version: 1,
    seed: options.seed,
    difficulty,
    phase: parsed.personality ? (parsed.color ? 'leap' : 'color') : 'nature',
    personality: parsed.personality,
    color: parsed.color,
    level: 1,
    cleared: 0,
    size: 0,
    street: [
      {
        index: 0,
        x: 0,
        height: 4,
        gap: 0,
        rise: 0,
        wind: 0,
        window: 'on',
        district: districtOf(1).name,
      },
    ],
    beat: 0,
    stamina: 0,
    sparks: 0,
    falls: 0,
    training: emptyAttributes(),
    bond: 0,
    jumps: 0,
    perfect: 0,
    streak: 0,
    bestStreak: 0,
    rests: 0,
    trained: 0,
    rescues: 0,
    rescueFailures: 0,
    sinceRescue: 0,
    rescue: null,
    lastJump: null,
    lastSetback: '',
    notes: ['性格与颜色会真实改变物理属性；同性格同伴只是确定性的离线事件。'],
    timeline: [],
    outcome: 'ongoing',
    ending: null,
    cause: '',
    score: 0,
    rng: rng.serialize(),
  };
  ensureStreet(state, rng);
  if (state.personality && state.color) state.stamina = maxStamina(state);
  state.rng = rng.serialize();
  return state;
}

export function statsOf(state: LeapState): Attributes {
  if (!state.personality || !state.color) return emptyAttributes();
  const base = NATURES[state.personality].stats;
  const tint = COLORS[state.color].stats;
  return {
    spring: Math.max(1, base.spring + (tint.spring ?? 0) + state.training.spring + state.size),
    control: Math.max(1, base.control + (tint.control ?? 0) + state.training.control),
    endurance: Math.max(
      1,
      base.endurance + (tint.endurance ?? 0) + state.training.endurance + state.size,
    ),
    grip: Math.max(1, base.grip + (tint.grip ?? 0) + state.training.grip + state.size),
  };
}

export function maxStamina(state: LeapState): number {
  return 10 + statsOf(state).endurance * 2;
}

function sizeName(state: LeapState): string {
  return SIZE_NAMES[state.size] ?? SIZE_NAMES[0];
}

export function maxFalls(state: LeapState): number {
  return state.difficulty === 'easy' ? 4 : state.difficulty === 'hard' ? 2 : 3;
}

export function landingTolerance(state: LeapState): number {
  const stats = statsOf(state);
  const difficulty = state.difficulty === 'easy' ? 0.25 : state.difficulty === 'hard' ? -0.2 : 0;
  return round2(
    0.65 +
      stats.control * 0.1 +
      stats.grip * 0.07 +
      state.size * 0.12 +
      state.bond * 0.45 +
      difficulty,
  );
}

export function targetOf(state: LeapState): Lamp {
  const target = state.street[state.level];
  if (!target) throw new Error(`第 ${state.level} 关的目标灯柱尚未生成。`);
  return target;
}

export function currentWindow(state: LeapState): TimingId {
  const target = targetOf(state);
  const base = TIMING_IDS.indexOf(target.window);
  return TIMING_IDS[(base + state.beat) % TIMING_IDS.length]!;
}

export function currentWind(state: LeapState): number {
  const target = targetOf(state);
  return target.wind + GUSTS[(state.beat + state.level) % GUSTS.length]!;
}

export function previewJump(
  state: LeapState,
  power: PowerId,
  angle: AngleId,
  timing: TimingId,
): JumpPreview {
  const stats = statsOf(state);
  const target = targetOf(state);
  const powerSpec = POWERS[power];
  const angleSpec = ANGLES[angle];
  const velocity = 3.8 + stats.spring * 0.55 + powerSpec.impulse;
  const horizontalVelocity = velocity * Math.cos(angleSpec.radians);
  const verticalVelocity = velocity * Math.sin(angleSpec.radians);
  const gravity = 9.8;
  const discriminant = Math.max(0, verticalVelocity ** 2 + 2 * gravity * target.rise);
  const flightTime = (verticalVelocity + Math.sqrt(discriminant)) / gravity;
  const ballistic = horizontalVelocity * flightTime;
  const wind = currentWind(state);
  const window = currentWindow(state);
  const timingDelta = TIMING_IDS.indexOf(timing) - TIMING_IDS.indexOf(window);
  const controlFactor = 1 - Math.min(0.45, stats.control * 0.045);
  const timingEffect = timingDelta * 0.38 * speedOf(state.level) * controlFactor;
  const windEffect = wind * 0.16 * speedOf(state.level);
  const landing = round2(ballistic + windEffect + timingEffect - state.size * 0.18);
  const error = round2(landing - target.gap);
  const tolerance = landingTolerance(state);
  const absoluteError = Math.abs(error);
  const result: JumpResult =
    absoluteError <= tolerance * 0.35
      ? 'perfect'
      : absoluteError <= tolerance
        ? 'clean'
        : absoluteError <= tolerance + 0.65
          ? 'edge'
          : error < 0
            ? 'short'
            : 'long';
  const actionId = `jump:${power}:${angle}:${timing}`;
  return {
    actionId,
    power,
    angle,
    timing,
    landing,
    error,
    tolerance,
    result,
    cost: powerSpec.cost + (result === 'edge' || result === 'short' || result === 'long' ? 1 : 0),
    wind,
    window,
  };
}

function jumpRisk(preview: JumpPreview): 'low' | 'medium' | 'high' {
  if (preview.result === 'perfect' || preview.result === 'clean') return 'low';
  return preview.result === 'edge' ? 'medium' : 'high';
}

function jumpRank(preview: JumpPreview): number {
  if (preview.result === 'perfect') return 0;
  if (preview.result === 'clean') return 1;
  if (preview.result === 'edge') return 2;
  return 3;
}

function jumpAction(preview: JumpPreview): ActionView {
  const power = POWERS[preview.power];
  const angle = ANGLES[preview.angle];
  const timing = TIMINGS[preview.timing];
  return {
    id: preview.actionId,
    label: `${power.name}力·${angle.name}·${timing.name} → ${RESULT_NAMES[preview.result]}`,
    detail: `间距 ${targetGapLabel(preview)}m；预计落点 ${preview.landing}m，误差 ${signed(preview.error)}m，容差 ±${preview.tolerance}m。当前风 ${signed(preview.wind)}，风拍 ${TIMINGS[preview.window].name}；此输入为${timing.name}。结果：${RESULT_NAMES[preview.result]}。`,
    risk: jumpRisk(preview),
    cost: `体力 -${preview.cost}`,
    tags: ['jump', preview.result],
  };
}

function targetGapLabel(preview: JumpPreview): number {
  return round2(preview.landing - preview.error);
}

function restAction(state: LeapState): ActionView {
  const amount = Math.min(maxStamina(state) - state.stamina, 5 + statsOf(state).endurance);
  return {
    id: 'rest',
    label: '盘成一团回体力',
    detail: `体力 +${amount}，风拍前进 ${speedOf(state.level)} 格。可以借此等到更合适的风，但不会推进关卡。`,
    risk: 'low',
    cost: '1 个动作',
    tags: ['recovery'],
  };
}

function trainAction(_state: LeapState, stat: StatId): ActionView {
  return {
    id: `train:${stat}`,
    label: `灯花养成·${STAT_NAMES[stat]}`,
    detail: `${STAT_NAMES[stat]}永久 +1（基础与训练合计上限 ${STAT_CAP}，体型加成另算）。消耗 ${TRAIN_COST} 灯花并推进风拍。`,
    risk: 'low',
    cost: `灯花 -${TRAIN_COST}`,
    tags: ['growth', stat],
  };
}

function baseWithTraining(state: LeapState, stat: StatId): number {
  if (!state.personality || !state.color) return 0;
  return (
    NATURES[state.personality].stats[stat] +
    (COLORS[state.color].stats[stat] ?? 0) +
    state.training[stat]
  );
}

function leapActions(state: LeapState): ActionView[] {
  const jumps: JumpPreview[] = [];
  for (const power of POWER_IDS) {
    if (state.stamina < POWERS[power].cost) continue;
    for (const angle of ANGLE_IDS) {
      for (const timing of TIMING_IDS) jumps.push(previewJump(state, power, angle, timing));
    }
  }
  jumps.sort(
    (left, right) =>
      jumpRank(left) - jumpRank(right) ||
      Math.abs(left.error) - Math.abs(right.error) ||
      left.cost - right.cost ||
      left.actionId.localeCompare(right.actionId),
  );
  const actions = jumps.map(jumpAction);
  const hasLanding = jumps.some(
    (preview) =>
      preview.result === 'perfect' || preview.result === 'clean' || preview.result === 'edge',
  );
  const rest = restAction(state);
  if (!hasLanding || actions.length === 0) actions.unshift(rest);
  else actions.push(rest);
  if (state.sparks >= TRAIN_COST) {
    for (const stat of STAT_IDS) {
      if (baseWithTraining(state, stat) < STAT_CAP) actions.push(trainAction(state, stat));
    }
  }
  return actions;
}

export function previewRescue(state: LeapState, power: PowerId, timing: TimingId): RescuePreview {
  const rescue = state.rescue;
  if (!rescue) throw new Error('当前没有黏连救援。');
  const exact = timing === rescue.cue;
  const distance = Math.abs(TIMING_IDS.indexOf(timing) - TIMING_IDS.indexOf(rescue.cue));
  const timingForce = exact ? 1 : distance === 1 ? -1 : -2;
  const force = Math.max(
    0,
    POWERS[power].rescueForce + timingForce + Math.floor(statsOf(state).grip / 4),
  );
  const progress = rescue.progress + force;
  let tension = rescue.tension + POWERS[power].tension + (exact ? 0 : 1);
  if (progress > rescue.need + 2) tension += 2;
  const result =
    tension > rescue.maxTension
      ? 'snap'
      : progress >= rescue.need
        ? 'success'
        : rescue.roundsLeft <= 1
          ? 'spent'
          : 'continue';
  return { actionId: `rescue:${power}:${timing}`, progress, tension, force, result };
}

function rescueRank(preview: RescuePreview): number {
  if (preview.result === 'success') return 0;
  if (preview.result === 'continue') return 1;
  if (preview.result === 'spent') return 2;
  return 3;
}

function rescueActions(state: LeapState): ActionView[] {
  const rescue = state.rescue;
  if (!rescue) return [];
  const previews: RescuePreview[] = [];
  for (const power of POWER_IDS) {
    for (const timing of TIMING_IDS) previews.push(previewRescue(state, power, timing));
  }
  previews.sort(
    (left, right) =>
      rescueRank(left) - rescueRank(right) ||
      left.tension - right.tension ||
      Math.abs(right.progress - rescue.need) - Math.abs(left.progress - rescue.need) ||
      left.actionId.localeCompare(right.actionId),
  );
  const resultNames: Record<RescuePreview['result'], string> = {
    success: '可以脱黏',
    continue: '继续缓拉',
    spent: '拍数将尽',
    snap: '拉力过高',
  };
  const actions: ActionView[] = previews.map((preview) => {
    const [, powerId, timingId] = preview.actionId.split(':');
    const power = POWERS[powerId as PowerId];
    const timing = TIMINGS[timingId as TimingId];
    return {
      id: preview.actionId,
      label: `${power.name}拉·${timing.name} → ${resultNames[preview.result]}`,
      detail: `救援进度 ${rescue.progress} → ${preview.progress}/${rescue.need}，拉力 ${rescue.tension} → ${preview.tension}/${rescue.maxTension}。当前提示 ${TIMINGS[rescue.cue].name}，剩余 ${rescue.roundsLeft} 拍。`,
      risk: preview.result === 'success' || preview.result === 'continue' ? 'low' : 'high',
      cost: '1 救援拍',
      tags: ['rescue', preview.result],
    } satisfies ActionView;
  });
  if (rescue.tension > 0) {
    actions.push({
      id: 'rescue:ease',
      label: '停一拍松开拉力',
      detail: `拉力 -2，进度不变，仍消耗 1 救援拍。若这是最后一拍且进度不足，救援会失败。`,
      risk: rescue.roundsLeft <= 1 && rescue.progress < rescue.need ? 'high' : 'medium',
      cost: '1 救援拍',
      tags: ['rescue'],
    });
  }
  return actions;
}

export function actionsOf(state: LeapState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  if (state.phase === 'nature') {
    return NATURE_IDS.map((id) => ({
      id: `nature:${id}`,
      label: NATURES[id].name,
      detail: `${NATURES[id].blurb} 初始属性：弹力 ${NATURES[id].stats.spring}、控制 ${NATURES[id].stats.control}、耐力 ${NATURES[id].stats.endurance}、黏性 ${NATURES[id].stats.grip}。`,
      risk: 'low',
      cost: '选择性格',
      tags: ['setup'],
    }));
  }
  if (state.phase === 'color') {
    return COLOR_IDS.map((id) => ({
      id: `color:${id}`,
      label: COLORS[id].name,
      detail: COLORS[id].blurb,
      risk: 'low',
      cost: '选择颜色',
      tags: ['setup'],
    }));
  }
  if (state.phase === 'rescue') return rescueActions(state);
  if (state.phase === 'leap') return leapActions(state);
  return [];
}

function pushNote(state: LeapState, text: string): void {
  state.notes.push(text);
  while (state.notes.length > MAX_NOTES) state.notes.shift();
}

function pushTimeline(state: LeapState, text: string): void {
  state.timeline.push(text);
  while (state.timeline.length > MAX_TIMELINE) state.timeline.shift();
}

function advanceBeat(state: LeapState): void {
  state.beat = (state.beat + speedOf(state.level)) % TIMING_IDS.length;
}

/**
 * Clears and perfects, plus the best perfect streak.
 * A clean or edge landing breaks the streak. Falls cost more than a perfect pays.
 */
export function scoreOf(state: LeapState): number {
  return Math.max(
    0,
    state.cleared * 40 +
      state.perfect * 20 +
      (state.bestStreak ?? 0) * 30 +
      state.rescues * 80 +
      state.sparks * 2 -
      state.falls * 70 -
      state.rests * 5 +
      (state.ending === 'dawn' ? 500 : 0),
  );
}

export function ladderScore(state: LeapState): number {
  if (state.outcome !== 'won' && state.outcome !== 'lost') return 0;
  return Math.min(999_999, scoreOf(state));
}

function finish(state: LeapState, ending: EndingId, cause: string): void {
  state.ending = ending;
  state.outcome = ending === 'dawn' ? 'won' : 'lost';
  state.phase = 'ended';
  state.cause = cause;
  state.score = scoreOf(state);
}

function beginRescue(state: LeapState, rng: Rng, log: string[], events: GameEvent[]): void {
  const personality = state.personality ?? 'steady';
  const rescue: RescueState = {
    partner: rng.pick(PARTNER_NAMES),
    roundsLeft: 3,
    round: 1,
    progress: 0,
    need: 7 + state.size,
    tension: 0,
    maxTension: 4,
    cue: rng.pick(TIMING_IDS),
  };
  state.rescue = rescue;
  state.phase = 'rescue';
  state.sinceRescue = 0;
  const text = `离线夜频亮起：同为「${NATURES[personality].name}」的${rescue.partner}黏在下一根灯柱上。不是真人联网，是这条街留下的一颗同频果冻。`;
  log.push(text);
  pushNote(
    state,
    `救援${rescue.partner}：三拍内进度到 ${rescue.need}，拉力别超过 ${rescue.maxTension}。`,
  );
  events.push({
    type: 'network',
    mode: 'offline-deterministic',
    personality,
    partner: rescue.partner,
    level: state.cleared,
    need: rescue.need,
  });
}

function completeLevel(
  state: LeapState,
  preview: JumpPreview,
  rng: Rng,
  log: string[],
  events: GameEvent[],
): void {
  const completed = state.level;
  state.cleared = completed;
  if (preview.result === 'perfect') state.sparks += 2;
  else if (preview.result === 'clean') state.sparks += 1;
  events.push({
    type: 'level',
    level: completed,
    result: preview.result,
    sparks: state.sparks,
  });
  if (completed >= MAX_LEVEL) {
    finish(
      state,
      'dawn',
      `第 ${MAX_LEVEL} 根灯柱接住了你。${preview.actionId} 的落点 ${preview.landing}m、误差 ${signed(preview.error)}m；你把整条街跳成了天亮。`,
    );
    log.push(state.cause);
    return;
  }

  state.level = completed + 1;
  const grownSize = Math.min(2, Math.floor(state.cleared / GROWTH_INTERVAL));
  if (grownSize > state.size) {
    state.size = grownSize;
    state.stamina = Math.min(maxStamina(state), state.stamina + 4);
    const text = `通关 ${state.cleared} 关，你长成「${sizeName(state)}」：弹力、耐力、黏性各 +1，体力 +4；身体重量也略增。`;
    log.push(text);
    pushNote(state, text);
    events.push({ type: 'growth', cleared: state.cleared, size: state.size });
  }
  ensureStreet(state, rng);
  state.sinceRescue += 1;
  const chance = 0.14 + (state.personality === 'mellow' ? 0.04 : 0);
  if (
    state.sinceRescue >= 7 ||
    (state.sinceRescue >= 3 && state.cleared >= 3 && rng.chance(chance))
  ) {
    beginRescue(state, rng, log, events);
  } else {
    state.phase = 'leap';
  }
}

function parseJump(actionId: string): { power: PowerId; angle: AngleId; timing: TimingId } | null {
  const parts = actionId.split(':');
  if (parts.length !== 4 || parts[0] !== 'jump') return null;
  const [, power, angle, timing] = parts;
  if (
    !(POWER_IDS as readonly string[]).includes(power!) ||
    !(ANGLE_IDS as readonly string[]).includes(angle!) ||
    !(TIMING_IDS as readonly string[]).includes(timing!)
  ) {
    return null;
  }
  return { power: power as PowerId, angle: angle as AngleId, timing: timing as TimingId };
}

function performJump(
  state: LeapState,
  actionId: string,
  rng: Rng,
  log: string[],
  events: GameEvent[],
): void {
  const parsed = parseJump(actionId);
  if (!parsed) throw new Error(`无法解析跳跃动作：${actionId}`);
  const preview = previewJump(state, parsed.power, parsed.angle, parsed.timing);
  const level = state.level;
  state.jumps += 1;
  state.bond = 0;
  state.stamina = Math.max(0, state.stamina - preview.cost);
  state.lastJump = {
    level,
    actionId,
    result: preview.result,
    landing: preview.landing,
    error: preview.error,
    tolerance: preview.tolerance,
    stamina: state.stamina,
    falls: state.falls,
  };
  const landed =
    preview.result === 'perfect' || preview.result === 'clean' || preview.result === 'edge';
  if (preview.result === 'perfect') {
    state.perfect += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
  } else {
    state.streak = 0;
  }
  const landingText = `第 ${level} 关 · ${actionId}：预计落点 ${preview.landing}m，间距 ${targetOf(state).gap}m，误差 ${signed(preview.error)}m（容差 ±${preview.tolerance}m）。`;
  log.push(`${landingText}${RESULT_NAMES[preview.result]}。体力 -${preview.cost}。`);
  events.push({
    type: 'jump',
    level,
    action: actionId,
    power: parsed.power,
    angle: parsed.angle,
    timing: parsed.timing,
    gap: targetOf(state).gap,
    rise: targetOf(state).rise,
    wind: preview.wind,
    window: preview.window,
    landing: preview.landing,
    error: preview.error,
    tolerance: preview.tolerance,
    result: preview.result,
    cost: preview.cost,
    stamina: state.stamina,
  });

  if (landed) {
    pushTimeline(
      state,
      `第 ${level} 关 · ${actionId} · ${RESULT_NAMES[preview.result]} · 误差 ${signed(preview.error)}m`,
    );
    completeLevel(state, preview, rng, log, events);
  } else {
    state.falls += 1;
    state.lastJump.falls = state.falls;
    const direction = preview.result === 'short' ? '灯柱前' : '灯柱后';
    state.lastSetback = `第 ${level} 关 ${actionId} 落在${direction}，误差 ${signed(preview.error)}m；体力剩 ${state.stamina}，摔落 ${state.falls}/${maxFalls(state)}。`;
    log.push(`你落在${direction}，被下层电线弹回原来的灯柱。本关尚未完成；摔落 +1。`);
    pushTimeline(
      state,
      `第 ${level} 关 · ${actionId} · ${RESULT_NAMES[preview.result]} · 留在原关`,
    );
    if (state.stamina <= 0) {
      finish(state, 'exhausted', `${state.lastSetback} 力竭时又没能落上灯柱，所以这次是力竭坠落。`);
      log.push(state.cause);
    } else if (state.falls >= maxFalls(state)) {
      finish(state, 'fall', `${state.lastSetback} 摔落次数到上限，灯柱边沿再也挂不住你。`);
      log.push(state.cause);
    }
  }
  state.lastJump.stamina = state.stamina;
  advanceBeat(state);
  state.score = scoreOf(state);
}

function performRest(state: LeapState, log: string[], events: GameEvent[]): void {
  const before = state.stamina;
  state.stamina = Math.min(maxStamina(state), state.stamina + 5 + statsOf(state).endurance);
  const recovered = state.stamina - before;
  state.rests += 1;
  log.push(
    `你在灯柱上盘成一团，体力 +${recovered}。风拍前进 ${speedOf(state.level)} 格；第 ${state.level} 关还在前面。`,
  );
  pushTimeline(state, `第 ${state.level} 关 · rest · 体力 +${recovered}`);
  events.push({ type: 'rest', level: state.level, recovered, stamina: state.stamina });
  advanceBeat(state);
  state.score = scoreOf(state);
}

function performTrain(state: LeapState, stat: StatId, log: string[], events: GameEvent[]): void {
  state.sparks -= TRAIN_COST;
  state.training[stat] += 1;
  state.trained += 1;
  if (stat === 'endurance') state.stamina = Math.min(maxStamina(state), state.stamina + 2);
  const value = statsOf(state)[stat];
  log.push(
    `你把 ${TRAIN_COST} 点灯花揉进身体：${STAT_NAMES[stat]} +1，现在有效值为 ${value}。风拍继续向前。`,
  );
  pushTimeline(state, `第 ${state.level} 关 · train:${stat} · ${STAT_NAMES[stat]}=${value}`);
  events.push({ type: 'train', level: state.level, stat, value, sparks: state.sparks });
  advanceBeat(state);
  state.score = scoreOf(state);
}

function succeedRescue(state: LeapState, log: string[], events: GameEvent[]): void {
  const rescue = state.rescue;
  if (!rescue) return;
  state.rescues += 1;
  state.sparks += 2;
  state.bond = 1;
  log.push(`${rescue.partner}“啵”地一声脱黏，留下 2 点灯花。下一跳获得同伴护持：落地容差 +0.45m。`);
  pushTimeline(state, `第 ${state.cleared} 关后 · 救出${rescue.partner} · 灯花 +2`);
  events.push({
    type: 'rescue-complete',
    partner: rescue.partner,
    success: true,
    sparks: state.sparks,
  });
  state.rescue = null;
  state.phase = 'leap';
  state.score = scoreOf(state);
}

function failRescue(state: LeapState, reason: string, log: string[], events: GameEvent[]): void {
  const rescue = state.rescue;
  if (!rescue) return;
  state.rescueFailures += 1;
  state.falls += 1;
  state.stamina = Math.max(0, state.stamina - 2);
  state.lastSetback = `第 ${state.cleared} 关后救援${rescue.partner}失败：${reason}；体力 -2，摔落 ${state.falls}/${maxFalls(state)}。`;
  pushTimeline(state, `第 ${state.cleared} 关后 · 救援失败 · ${reason}`);
  events.push({
    type: 'rescue-complete',
    partner: rescue.partner,
    success: false,
    reason,
    falls: state.falls,
    stamina: state.stamina,
  });
  state.rescue = null;
  state.phase = 'leap';
  if (state.falls >= maxFalls(state)) {
    finish(
      state,
      'rescue-fall',
      `${state.lastSetback} 这是最后一次摔落：救同伴时反被黏连带下了灯柱。`,
    );
    log.push(state.cause);
  } else {
    log.push(`${state.lastSetback} 你被弹回本关后的灯柱，主线可以继续。`);
  }
  state.score = scoreOf(state);
}

function performRescue(
  state: LeapState,
  actionId: string,
  log: string[],
  events: GameEvent[],
): void {
  const rescue = state.rescue;
  if (!rescue) throw new Error('当前没有黏连救援。');
  if (actionId === 'rescue:ease') {
    rescue.tension = Math.max(0, rescue.tension - 2);
    rescue.roundsLeft -= 1;
    rescue.round += 1;
    log.push(
      `你停了一拍，拉力降到 ${rescue.tension}；救援进度仍是 ${rescue.progress}/${rescue.need}。`,
    );
    events.push({
      type: 'rescue',
      action: actionId,
      tension: rescue.tension,
      progress: rescue.progress,
    });
    if (rescue.roundsLeft <= 0 && rescue.progress < rescue.need) {
      failRescue(state, '缓力用掉最后一拍，进度不足', log, events);
    } else {
      rescue.cue = TIMING_IDS[(TIMING_IDS.indexOf(rescue.cue) + 1) % TIMING_IDS.length]!;
    }
    advanceBeat(state);
    return;
  }
  const parts = actionId.split(':');
  const power = parts[1] as PowerId;
  const timing = parts[2] as TimingId;
  const preview = previewRescue(state, power, timing);
  rescue.progress = preview.progress;
  rescue.tension = preview.tension;
  rescue.roundsLeft -= 1;
  rescue.round += 1;
  log.push(
    `${actionId}：拉力贡献 ${preview.force}，进度 ${rescue.progress}/${rescue.need}，拉力 ${rescue.tension}/${rescue.maxTension}，剩 ${rescue.roundsLeft} 拍。`,
  );
  events.push({
    type: 'rescue',
    action: actionId,
    partner: rescue.partner,
    force: preview.force,
    progress: rescue.progress,
    need: rescue.need,
    tension: rescue.tension,
    roundsLeft: rescue.roundsLeft,
    result: preview.result,
  });
  if (preview.result === 'success') {
    succeedRescue(state, log, events);
  } else if (preview.result === 'snap') {
    failRescue(state, '拉力超过灯柱能承受的上限', log, events);
  } else if (preview.result === 'spent') {
    failRescue(state, '三拍用完仍进度不足', log, events);
  } else {
    rescue.cue = TIMING_IDS[(TIMING_IDS.indexOf(rescue.cue) + 1) % TIMING_IDS.length]!;
  }
  advanceBeat(state);
}

export function act(state: LeapState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾，用 recap 查看结算。');
  const legal = actionsOf(state).some((action) => action.id === actionId);
  if (!legal) {
    throw illegalAction(
      `当前不能做：${actionId}`,
      `合法动作：${
        actionsOf(state)
          .map((action) => action.id)
          .join(', ') || '(无)'
      }`,
    );
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  const events: GameEvent[] = [];

  if (actionId.startsWith('nature:')) {
    const id = actionId.slice('nature:'.length) as NatureId;
    state.personality = id;
    state.phase = state.color ? 'leap' : 'color';
    if (state.color) state.stamina = maxStamina(state);
    log.push(`你选择了「${NATURES[id].name}」。${NATURES[id].blurb}`);
    pushTimeline(state, `塑形 · ${NATURES[id].name}`);
    events.push({ type: 'choose', kind: 'nature', id });
  } else if (actionId.startsWith('color:')) {
    const id = actionId.slice('color:'.length) as ColorId;
    state.color = id;
    state.phase = state.personality ? 'leap' : 'nature';
    if (state.personality) state.stamina = maxStamina(state);
    log.push(`你染成「${COLORS[id].name}」。${COLORS[id].blurb}`);
    if (state.personality)
      log.push(
        `身体成形：体力 ${state.stamina}/${maxStamina(state)}。下一调用返回的 next 开始跳街。`,
      );
    pushTimeline(state, `上色 · ${COLORS[id].name}`);
    events.push({ type: 'choose', kind: 'color', id });
  } else if (actionId === 'rest') {
    performRest(state, log, events);
  } else if (actionId.startsWith('train:')) {
    performTrain(state, actionId.slice('train:'.length) as StatId, log, events);
  } else if (actionId.startsWith('jump:')) {
    performJump(state, actionId, rng, log, events);
  } else if (actionId.startsWith('rescue:')) {
    performRescue(state, actionId, log, events);
  } else {
    throw new Error(`未处理的动作：${actionId}`);
  }

  state.rng = rng.serialize();
  return { log, events };
}

function visibleStreetLines(state: LeapState): string[] {
  const end = Math.min(state.street.length, state.level - 1 + visionOf(state.level) + 1);
  return state.street.slice(Math.max(0, state.level - 1), end).map((lamp) => {
    const marker = lamp.index === state.level - 1 ? '▶' : lamp.index === state.level ? '→' : '·';
    const relation =
      lamp.index === state.level - 1 ? '脚下' : `间距 ${lamp.gap}m / 高差 ${signed(lamp.rise)}m`;
    return `${marker} #${lamp.index} x=${lamp.x}m 高=${lamp.height}m｜${relation}｜风 ${signed(lamp.wind)}`;
  });
}

function setupSections(state: LeapState): StatusSection[] {
  if (state.phase === 'nature') {
    return [
      {
        title: '先捏性格',
        lines: NATURE_IDS.map((id) => `${NATURES[id].name}：${NATURES[id].blurb}`),
      },
      { title: '下一步', lines: ['执行 next 中的 nature:<id>；也可用 actions 查看全部性格。'] },
    ];
  }
  if (state.phase === 'color') {
    return [
      {
        title: '再给果冻一点颜色',
        lines: COLOR_IDS.map((id) => `${COLORS[id].name}：${COLORS[id].blurb}`),
      },
      { title: '下一步', lines: ['执行 next 中的 color:<id>；颜色修正会与性格、训练、体型叠加。'] },
    ];
  }
  return [];
}

function leapSections(state: LeapState): StatusSection[] {
  const target = targetOf(state);
  const stats = statsOf(state);
  const recommended = actionsOf(state)[0];
  const nextGrowth =
    state.size >= 2
      ? '已是最大体型'
      : `再通关 ${GROWTH_INTERVAL - (state.cleared % GROWTH_INTERVAL)} 关长大`;
  return [
    {
      title: '本关物理',
      lines: [
        `目标 #${target.index}：间距 ${target.gap}m，高差 ${signed(target.rise)}m，基础风 ${signed(target.wind)}，当前风 ${signed(currentWind(state))}。`,
        `当前风拍「${TIMINGS[currentWindow(state)].name}」；街速 ${speedOf(state.level)}。落地容差 ±${landingTolerance(state)}m${state.bond ? '（含同伴护持 +0.45m）' : ''}。`,
        '力度改变初速度与体力消耗；角度改变抛物线；输入与风拍的差值修正落点。动作 detail 已算出本拍结果。',
      ],
    },
    { title: `延伸街道 · 视野 ${visionOf(state.level)} 根`, lines: visibleStreetLines(state) },
    {
      title: '养成',
      lines: [
        `弹力 ${stats.spring}｜控制 ${stats.control}｜耐力 ${stats.endurance}｜黏性 ${stats.grip}。体力上限 ${maxStamina(state)}。`,
        `${sizeName(state)}；${nextGrowth}。灯花 ${state.sparks}，${TRAIN_COST} 点可训练一次，单项基础与训练上限 ${STAT_CAP}。`,
        `摔落 ${state.falls}/${maxFalls(state)}；失误会留在原关。体力不足时 next 会优先 rest。`,
      ],
    },
    {
      title: '下一步',
      lines: [
        recommended
          ? `建议 act ${recommended.id}：${recommended.detail ?? recommended.label}`
          : '当前没有合法动作。',
      ],
    },
  ];
}

function rescueSections(state: LeapState): StatusSection[] {
  const rescue = state.rescue;
  if (!rescue) return [];
  const recommended = actionsOf(state)[0];
  return [
    {
      title: '离线夜频 · 同性格黏连',
      lines: [
        `${rescue.partner}与你同为「${state.personality ? NATURES[state.personality].name : '未知'}」。这是 seed 驱动的离线副本，没有连接网络或其他玩家。`,
        `进度 ${rescue.progress}/${rescue.need}，拉力 ${rescue.tension}/${rescue.maxTension}，剩余 ${rescue.roundsLeft} 拍，当前提示「${TIMINGS[rescue.cue].name}」。`,
        '力度决定基础贡献；与提示合拍有额外进度且不增额外拉力。超过需求太多也会拉紧。成功得 2 灯花与下一跳护持。',
      ],
    },
    {
      title: '下一步',
      lines: [
        recommended
          ? `建议 act ${recommended.id}：${recommended.detail ?? recommended.label}`
          : '当前没有合法动作。',
      ],
    },
  ];
}

export function statusOf(state: LeapState): StatusView {
  const stats = statsOf(state);
  const metrics: Metric[] = [
    { label: '进度', value: `${state.cleared}/${MAX_LEVEL}` },
    { label: '体型', value: sizeName(state) },
    { label: '体力', value: `${state.stamina}/${maxStamina(state)}` },
    { label: '灯花', value: state.sparks },
    { label: '摔落', value: `${state.falls}/${maxFalls(state)}` },
  ];
  if (state.personality && state.color) {
    metrics.push(
      { label: '弹力', value: stats.spring },
      { label: '控制', value: stats.control },
      { label: '耐力', value: stats.endurance },
      { label: '黏性', value: stats.grip },
    );
  }
  let headline = '';
  if (state.outcome !== 'ongoing') {
    headline = `${ENDING_NAMES[state.ending ?? 'aborted']} · ${state.cause}`;
  } else if (state.phase === 'nature') {
    headline = '一颗果冻在路灯下醒来 · 先选性格';
  } else if (state.phase === 'color') {
    headline = `${state.personality ? NATURES[state.personality].name : '果冻'}已成形 · 再选颜色`;
  } else if (state.phase === 'rescue') {
    headline = `第 ${state.cleared} 关后 · 黏连救援 · ${state.rescue?.partner ?? '同伴'} · 剩 ${state.rescue?.roundsLeft ?? 0} 拍`;
  } else {
    headline = `${districtOf(state.level).name} · 第 ${state.level}/${MAX_LEVEL} 关 · ${sizeName(state)} · 街速 ${speedOf(state.level)} · 视野 ${visionOf(state.level)}`;
  }
  const sections =
    state.phase === 'leap'
      ? leapSections(state)
      : state.phase === 'rescue'
        ? rescueSections(state)
        : setupSections(state);
  if (state.outcome === 'ongoing' && state.lastSetback) {
    sections.push({ title: '最近一次失误', lines: [state.lastSetback] });
  }
  if (state.notes.length > 0 && state.outcome === 'ongoing') {
    sections.push({ title: '街边笔记', lines: [...state.notes] });
  }
  return {
    headline,
    metrics,
    sections,
    outcome: state.outcome,
    turn: state.cleared,
    phase:
      state.outcome === 'ongoing'
        ? PHASE_NAMES[state.phase]
        : ENDING_NAMES[state.ending ?? 'aborted'],
  };
}

function lessonsOf(state: LeapState): string[] {
  const lessons: string[] = [];
  if (state.lastJump) {
    const jump = state.lastJump;
    lessons.push(
      `最后一次跳跃是第 ${jump.level} 关 ${jump.actionId}：${RESULT_NAMES[jump.result]}，落点 ${jump.landing}m、误差 ${signed(jump.error)}m、容差 ±${jump.tolerance}m。`,
    );
  }
  if (state.ending === 'exhausted') {
    lessons.push(
      '这次死亡同时满足“体力归零”和“跳跃失误”。高力度耗体力更快；体力不足时应先 rest，而不是把最后一跳交给失误。',
    );
  }
  if (state.ending === 'fall') {
    lessons.push(
      `这局摔落 ${state.falls} 次到上限。动作 detail 已预告跳短或跳远；没有可落地组合时，rest 换风拍比硬跳更稳。`,
    );
  }
  if (state.ending === 'rescue-fall') {
    lessons.push(
      '最后一次摔落发生在救援副本。救援不仅看进度，还要看拉力；超过需求太多也会增加拉力。',
    );
  }
  if (state.ending === 'dawn') {
    lessons.push(
      `这局以 ${state.perfect} 次完美落地、${state.rests} 次休息和 ${state.rescues} 次救援完成 45 关。换 build 或 seed 后，同一档位的落点要重算。`,
    );
  }
  if (state.trained > 0) {
    lessons.push(
      `这局训练了 ${state.trained} 次。灯花来自落地质量，训练会改变后续物理；不要把训练前的动作预测带到训练后。`,
    );
  }
  if (state.rescueFailures > 0) {
    lessons.push(
      `这局救援失败 ${state.rescueFailures} 次。成功救援的护持只保留下一跳，使用后会消失。`,
    );
  }
  if (lessons.length === 0) {
    lessons.push(
      '还没有跳跃失误或训练记录。先比较间距、角度、风拍与动作 detail，再记录这一条街的实际观察。',
    );
  }
  return lessons.slice(0, 5);
}

export function recapOf(state: LeapState): RecapView {
  const endingName =
    state.outcome === 'ongoing' ? '进行中' : ENDING_NAMES[state.ending ?? 'aborted'];
  const build = `${state.personality ? NATURES[state.personality].name : '未选性格'}·${state.color ? COLORS[state.color].name : '未选颜色'}`;
  return {
    title: `虾跃 · ${endingName}`,
    outcome: state.outcome,
    cause:
      state.outcome === 'ongoing'
        ? `仍在${state.phase === 'rescue' ? `第 ${state.cleared} 关后的救援` : `第 ${state.level} 关`}；${build}，体力 ${state.stamina}/${maxStamina(state)}，摔落 ${state.falls}/${maxFalls(state)}。${state.lastSetback ? `最近一次失误：${state.lastSetback}` : ''}`
        : state.cause,
    metrics: [
      { label: '结局', value: endingName },
      { label: '得分', value: state.score },
      { label: '通关', value: `${state.cleared}/${MAX_LEVEL}` },
      { label: 'build', value: build },
      { label: '体型', value: sizeName(state) },
      { label: '跳跃', value: state.jumps },
      { label: '完美', value: state.perfect },
      { label: '摔落', value: `${state.falls}/${maxFalls(state)}` },
      { label: '救援', value: `${state.rescues} 成 / ${state.rescueFailures} 败` },
    ],
    timeline: state.timeline.slice(-10),
    lessons: lessonsOf(state),
    memoryPrompt:
      '把本局的性格、颜色、训练、最远关卡、最后一次跳跃的三档与落点误差写进你自己的 memory；若有救援，也记下进度和拉力。只把这些当作这个 seed 与这套 build 的观察，换地图、体型或属性后重新验证，不要把固定档位当成万能攻略。',
    score: ladderScore(state),
  };
}

export function abort(state: LeapState): void {
  state.ending = 'aborted';
  state.outcome = 'aborted';
  state.phase = 'ended';
  state.cause = `你主动把果冻收回一团，停在第 ${state.level} 关（已通关 ${state.cleared}/${MAX_LEVEL}）。这不是摔死，也不是通关。${state.lastSetback}`;
  state.rescue = null;
  state.score = scoreOf(state);
}
