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
  BASE_MATERIAL_IDS,
  COOLING,
  DIFFICULTIES,
  type Difficulty,
  ENDING_NAMES,
  type EndingId,
  FUSION_IDS,
  GUEST_NAMES,
  HEAT_GRADES,
  HEAT_ORBS,
  HEAT_START,
  type HeatGrade,
  LANE_COUNT,
  type LegendRole,
  MATERIALS,
  type MaterialId,
  MAX_NOTES,
  MAX_PESTS,
  MAX_TIMELINE,
  PEST_KINDS,
  PEST_SPECS,
  type PestKind,
  type Phase,
  RECIPES,
  type RecipeSpec,
  type TasteVerdict,
} from './content';

export type { Difficulty, EndingId, Phase, TasteVerdict };

export interface RecipeView {
  id: string;
  name: string;
  required: MaterialId[];
  optional: MaterialId[];
  heatMin: number;
  heatMax: number;
  note: string;
}

export interface StackEntry {
  uid: number;
  id: MaterialId;
  name: string;
  legend: LegendRole;
  onLegend: boolean;
  fused: boolean;
  special: boolean;
}

export type FallingKind = 'ingredient' | 'heat' | 'fusion';

export interface FallingItem {
  slot: number;
  kind: FallingKind;
  materialId: MaterialId | null;
  heatGrade: HeatGrade | null;
  heatValue: number;
  name: string;
  progress: number | null;
  fusionResultId: MaterialId | null;
}

export interface PestState {
  id: string;
  kind: PestKind;
  name: string;
  stealsIn: number;
  blurb: string;
}

export interface GuestState {
  name: string;
  mood: number;
}

export interface TasteReport {
  quality: number;
  roll: number;
  verdict: TasteVerdict;
  missing: MaterialId[];
  wrongMix: MaterialId[];
  heatDelta: number;
  heatMiss: number;
  fusionBonus: number;
  specialBonus: number;
  wrongTaste: number;
}

export interface LastOrder {
  order: number;
  recipeId: string;
  recipeName: string;
  taste: TasteReport;
  guest: string;
}

export interface BurgerState {
  version: 1;
  seed: number;
  difficulty: Difficulty;
  phase: Phase;
  turnsUsed: number;
  turnsRemaining: number;
  goal: number;
  served: number;
  score: number;
  order: number;
  recipe: RecipeView;
  stack: StackEntry[];
  heat: number;
  falling: FallingItem[];
  pests: PestState[];
  guest: GuestState;
  walkouts: number;
  ruined: number;
  maxWalkouts: number;
  maxRuined: number;
  pestThefts: number;
  fusionsCaught: number;
  wrongCaught: number;
  soothed: number;
  sincePest: number;
  nextUid: number;
  nextPestSeq: number;
  lastOrder: LastOrder | null;
  lastSetback: string;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  ending: EndingId | null;
  cause: string;
  rng: [number, number, number, number];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pushNote(state: BurgerState, text: string): void {
  state.notes.push(text);
  while (state.notes.length > MAX_NOTES) state.notes.shift();
}

function pushTimeline(state: BurgerState, text: string): void {
  state.timeline.push(text);
  while (state.timeline.length > MAX_TIMELINE) state.timeline.shift();
}

function cloneRecipe(spec: RecipeSpec): RecipeView {
  return {
    id: spec.id,
    name: spec.name,
    required: [...spec.required],
    optional: [...spec.optional],
    heatMin: spec.heatMin,
    heatMax: spec.heatMax,
    note: spec.note,
  };
}

function heatMid(recipe: RecipeView): number {
  return Math.round((recipe.heatMin + recipe.heatMax) / 2);
}

function heatMissOf(heat: number, recipe: RecipeView): number {
  if (heat < recipe.heatMin) return heat - recipe.heatMin;
  if (heat > recipe.heatMax) return heat - recipe.heatMax;
  return 0;
}

export function legendOf(id: MaterialId, recipe: RecipeView): LegendRole {
  const material = MATERIALS[id];
  if (material.special) return 'special';
  if (recipe.required.includes(id)) return 'required';
  if (material.satisfies.some((need) => recipe.required.includes(need))) return 'compatible';
  if (recipe.optional.includes(id)) return 'optional';
  if (material.satisfies.some((need) => recipe.optional.includes(need))) return 'optional';
  return 'wrong';
}

export function missingRequired(state: BurgerState): MaterialId[] {
  const missing: MaterialId[] = [];
  const used = new Set<number>();
  for (const need of state.recipe.required) {
    const hit = state.stack.findIndex((entry, index) => {
      if (used.has(index)) return false;
      return entry.id === need || MATERIALS[entry.id].satisfies.includes(need);
    });
    if (hit < 0) missing.push(need);
    else used.add(hit);
  }
  return missing;
}

export function wrongMixOf(state: BurgerState): MaterialId[] {
  return state.stack.filter((entry) => entry.legend === 'wrong').map((entry) => entry.id);
}

export function previewTaste(state: BurgerState): TasteReport {
  const missing = missingRequired(state);
  const wrongMix = wrongMixOf(state);
  const heatDelta = state.heat - heatMid(state.recipe);
  const heatMiss = heatMissOf(state.heat, state.recipe);
  let wrongTaste = 0;
  let fusionBonus = 0;
  let specialBonus = 0;
  for (const entry of state.stack) {
    const material = MATERIALS[entry.id];
    if (entry.legend === 'wrong') wrongTaste += material.taste;
    if (material.fused) fusionBonus += material.fusionBonus;
    if (material.special) specialBonus += material.taste > 0 ? material.taste : 0;
  }
  const quality = clamp(
    92 -
      missing.length * 24 +
      wrongTaste -
      Math.abs(heatMiss) * 3 -
      Math.floor(Math.abs(heatDelta) / 4) +
      fusionBonus +
      specialBonus,
    3,
    97,
  );
  return {
    quality,
    roll: 0,
    verdict: 'bad',
    missing,
    wrongMix,
    heatDelta,
    heatMiss,
    fusionBonus,
    specialBonus,
    wrongTaste,
  };
}

function resolveVerdict(preview: TasteReport, roll: number): TasteVerdict {
  const success = roll <= preview.quality;
  const offScript =
    preview.wrongMix.length > 0 || preview.missing.length > 0 || preview.heatMiss !== 0;
  if (success) return offScript ? 'lucky' : 'tasty';
  if (roll > preview.quality + 25 || preview.quality < 40) return 'disaster';
  return 'bad';
}

function weightedBase(rng: Rng, recipe: RecipeView): MaterialId {
  const pool: MaterialId[] = [];
  for (const id of recipe.required) {
    pool.push(id, id, id);
  }
  for (const id of recipe.optional) pool.push(id);
  for (const id of BASE_MATERIAL_IDS) {
    if (!recipe.required.includes(id) && !recipe.optional.includes(id)) pool.push(id);
  }
  // Bias a little toward weirdness without flooding.
  pool.push('sock', 'battery', 'seaweed');
  return rng.pick(pool);
}

function generateLane(state: BurgerState, rng: Rng, slot: number, events: GameEvent[]): FallingItem {
  const roll = rng.float();
  if (roll < 0.22) {
    const grade = rng.pick(HEAT_GRADES);
    const orb = HEAT_ORBS[grade];
    return {
      slot,
      kind: 'heat',
      materialId: null,
      heatGrade: grade,
      heatValue: orb.value,
      name: orb.name,
      progress: null,
      fusionResultId: null,
    };
  }
  if (roll < 0.34) {
    const resultId = rng.pick(FUSION_IDS);
    events.push({ type: 'fusion-start', slot, resultId, name: MATERIALS[resultId].name });
    return {
      slot,
      kind: 'fusion',
      materialId: null,
      heatGrade: null,
      heatValue: 0,
      name: `融合漩涡→${MATERIALS[resultId].name}`,
      progress: 0,
      fusionResultId: resultId,
    };
  }
  const materialId = weightedBase(rng, state.recipe);
  return {
    slot,
    kind: 'ingredient',
    materialId,
    heatGrade: null,
    heatValue: 0,
    name: MATERIALS[materialId].name,
    progress: null,
    fusionResultId: null,
  };
}

function refreshFalling(state: BurgerState, rng: Rng, events: GameEvent[]): void {
  const next: FallingItem[] = [];
  for (let slot = 0; slot < LANE_COUNT; slot += 1) {
    const previous = state.falling.find((item) => item.slot === slot);
    if (previous && previous.kind === 'fusion' && previous.progress === 0) {
      const ready: FallingItem = {
        ...previous,
        progress: 1,
        name: `稳定融合→${MATERIALS[previous.fusionResultId!].name}`,
      };
      events.push({
        type: 'fusion-ready',
        slot,
        resultId: previous.fusionResultId,
        name: MATERIALS[previous.fusionResultId!].name,
      });
      next.push(ready);
      continue;
    }
    next.push(generateLane(state, rng, slot, events));
  }
  state.falling = next;
}

function pickRecipe(rng: Rng, previousId: string | null): RecipeView {
  const pool = previousId ? RECIPES.filter((recipe) => recipe.id !== previousId) : [...RECIPES];
  return cloneRecipe(rng.pick(pool.length > 0 ? pool : RECIPES));
}

function beginOrder(state: BurgerState, rng: Rng, events: GameEvent[], keepGuest = false): void {
  state.order += 1;
  state.recipe = pickRecipe(rng, state.recipe?.id ?? null);
  state.stack = [];
  state.heat = HEAT_START;
  state.pests = [];
  state.sincePest = 0;
  if (!keepGuest) {
    state.guest = { name: rng.pick(GUEST_NAMES), mood: 100 };
  } else {
    state.guest.mood = 100;
  }
  refreshFalling(state, rng, events);
  pushNote(
    state,
    `第 ${state.order} 单「${state.recipe.name}」：需要 ${state.recipe.required
      .map((id) => MATERIALS[id].name)
      .join('、')}；火候 ${state.recipe.heatMin}-${state.recipe.heatMax}。`,
  );
  events.push({
    type: 'order',
    order: state.order,
    recipeId: state.recipe.id,
    heatMin: state.recipe.heatMin,
    heatMax: state.recipe.heatMax,
  });
}

export function createRun(options: {
  seed: number;
  content?: string;
  difficulty?: string;
}): BurgerState {
  const rng = Rng.fromSeed(options.seed);
  const difficulty: Difficulty =
    options.difficulty === 'easy' || options.difficulty === 'hard' ? options.difficulty : 'normal';
  const spec = DIFFICULTIES[difficulty];
  const state: BurgerState = {
    version: 1,
    seed: options.seed,
    difficulty,
    phase: 'service',
    turnsUsed: 0,
    turnsRemaining: spec.turns,
    goal: spec.goal,
    served: 0,
    score: 0,
    order: 0,
    recipe: cloneRecipe(RECIPES[0]!),
    stack: [],
    heat: HEAT_START,
    falling: [],
    pests: [],
    guest: { name: rng.pick(GUEST_NAMES), mood: 100 },
    walkouts: 0,
    ruined: 0,
    maxWalkouts: spec.maxWalkouts,
    maxRuined: spec.maxRuined,
    pestThefts: 0,
    fusionsCaught: 0,
    wrongCaught: 0,
    soothed: 0,
    sincePest: 0,
    nextUid: 1,
    nextPestSeq: 1,
    lastOrder: null,
    lastSetback: '',
    notes: [
      '错料照样进汉堡；最终好不好吃看阈值与判定值。',
      '火候球和食材抢同一只手；害虫逼近时要腾出另一只手驱赶。',
    ],
    timeline: [],
    outcome: 'ongoing',
    ending: null,
    cause: '',
    rng: rng.serialize(),
  };
  const events: GameEvent[] = [];
  beginOrder(state, rng, events, true);
  state.rng = rng.serialize();
  state.score = scoreOf(state);
  return state;
}

export function scoreOf(state: BurgerState): number {
  return Math.max(
    0,
    state.served * 250 +
      state.order * 12 +
      state.fusionsCaught * 15 -
      state.walkouts * 120 -
      state.ruined * 140 -
      state.pestThefts * 12 -
      state.soothed * 15 +
      (state.ending === 'shift-done' ? state.turnsRemaining * 4 : 0),
  );
}

function finish(state: BurgerState, ending: EndingId, cause: string): void {
  state.ending = ending;
  state.outcome = ending === 'shift-done' ? 'won' : ending === 'aborted' ? 'aborted' : 'lost';
  state.phase = 'ended';
  state.cause = cause;
  state.score = scoreOf(state);
}

function maybeSpawnPest(state: BurgerState, rng: Rng, events: GameEvent[]): void {
  if (state.pests.length >= MAX_PESTS) return;
  state.sincePest += 1;
  const force = state.sincePest >= 7;
  const chance = state.turnsUsed >= 3 && state.sincePest >= 3 ? 0.28 : 0;
  if (!force && !rng.chance(chance)) return;
  const kind = rng.pick(PEST_KINDS);
  const spec = PEST_SPECS[kind];
  const pest: PestState = {
    id: `p${state.nextPestSeq++}`,
    kind,
    name: spec.name,
    stealsIn: spec.warning,
    blurb: spec.blurb,
  };
  state.pests.push(pest);
  state.sincePest = 0;
  events.push({ type: 'pest-spawn', id: pest.id, kind, stealsIn: pest.stealsIn });
}

function stealFromStack(state: BurgerState, preferRequired: boolean): StackEntry | null {
  if (state.stack.length === 0) return null;
  if (preferRequired) {
    const index = state.stack.findIndex(
      (entry) => entry.legend === 'required' || entry.legend === 'compatible',
    );
    if (index >= 0) return state.stack.splice(index, 1)[0]!;
  }
  return state.stack.pop() ?? null;
}

function resolvePest(
  state: BurgerState,
  pest: PestState,
  log: string[],
  events: GameEvent[],
): void {
  state.pestThefts += 1;
  let detail = '';
  if (pest.kind === 'raccoon') {
    if (state.heat > 0) {
      const lost = Math.min(14, state.heat);
      state.heat -= lost;
      detail = `偷走火候 ${lost}，当前 ${state.heat}`;
    } else {
      const stolen = stealFromStack(state, false);
      detail = stolen ? `火候已冷，改偷走${stolen.name}` : '找不到可偷的东西，悻悻离开';
    }
  } else if (pest.kind === 'seagull') {
    const stolen = stealFromStack(state, true);
    detail = stolen ? `叼走配方料${stolen.name}` : '栈空，只啄了一格空气';
  } else if (pest.kind === 'cat') {
    const first = stealFromStack(state, false);
    const second = stealFromStack(state, false);
    detail = first
      ? `掀掉${first.name}${second ? `和${second.name}` : ''}`
      : '栈空，只在落物上踩了一脚';
  } else if (pest.kind === 'pigeon') {
    const stolen = stealFromStack(state, false);
    state.guest.mood = clamp(state.guest.mood - 8, 0, 100);
    detail = stolen
      ? `啄走${stolen.name}，客人皱眉（心情 ${state.guest.mood}）`
      : `把落物弄脏，客人皱眉（心情 ${state.guest.mood}）`;
  } else {
    const stolen = stealFromStack(state, false);
    detail = stolen ? `偷走顶层${stolen.name}` : '栈空，叼走一格落物的影子';
  }
  log.push(`${pest.name}得手：${detail}。`);
  events.push({ type: 'pest-theft', id: pest.id, kind: pest.kind, detail });
}

function advanceServiceTick(
  state: BurgerState,
  rng: Rng,
  actionId: string,
  log: string[],
  events: GameEvent[],
): void {
  state.turnsUsed += 1;
  state.turnsRemaining -= 1;
  state.heat = clamp(state.heat - COOLING, 0, 100);

  const remaining: PestState[] = [];
  for (const pest of state.pests) {
    pest.stealsIn -= 1;
    if (pest.stealsIn <= 0) {
      resolvePest(state, pest, log, events);
    } else {
      remaining.push(pest);
    }
  }
  state.pests = remaining;

  // Drop consumed lanes then refresh; preserve unfinished fusions.
  refreshFalling(state, rng, events);
  maybeSpawnPest(state, rng, events);

  if (state.outcome !== 'ongoing') return;
  if (state.turnsRemaining <= 0 && state.served < state.goal) {
    finish(
      state,
      'timeout',
      `班次耗尽：最后动作 ${actionId}，已送出 ${state.served}/${state.goal}，当前第 ${state.order} 单「${state.recipe.name}」仍在台上，火候 ${state.heat}（目标 ${state.recipe.heatMin}-${state.recipe.heatMax}）。`,
    );
    log.push(state.cause);
    events.push({ type: 'ending', ending: 'timeout' });
  }
}

function pushStack(state: BurgerState, id: MaterialId): StackEntry {
  const legend = legendOf(id, state.recipe);
  const material = MATERIALS[id];
  const entry: StackEntry = {
    uid: state.nextUid++,
    id,
    name: material.name,
    legend,
    onLegend: legend !== 'wrong',
    fused: material.fused,
    special: material.special,
  };
  state.stack.push(entry);
  if (legend === 'wrong') state.wrongCaught += 1;
  if (material.fused) state.fusionsCaught += 1;
  return entry;
}

function performCatch(
  state: BurgerState,
  slot: number,
  rng: Rng,
  log: string[],
  events: GameEvent[],
): void {
  const item = state.falling.find((lane) => lane.slot === slot);
  if (!item) throw new Error(`落物格 ${slot} 不存在`);
  state.falling = state.falling.filter((lane) => lane.slot !== slot);

  if (item.kind === 'heat') {
    const before = state.heat;
    state.heat = clamp(state.heat + item.heatValue, 0, 100);
    log.push(
      `接住${item.name}：火候 ${before}→${state.heat}（本拍末还会冷却 ${COOLING}）。目标 ${state.recipe.heatMin}-${state.recipe.heatMax}。`,
    );
    events.push({
      type: 'catch-heat',
      slot,
      grade: item.heatGrade,
      value: item.heatValue,
      heat: state.heat,
    });
  } else {
    const materialId =
      item.kind === 'fusion' ? (item.fusionResultId as MaterialId) : (item.materialId as MaterialId);
    const unstable = item.kind === 'fusion' && item.progress === 0;
    if (unstable) state.heat = clamp(state.heat + 6, 0, 100);
    const entry = pushStack(state, materialId);
    const tag =
      entry.legend === 'wrong'
        ? '不在图例里，照样塞进汉堡'
        : entry.legend === 'special'
          ? '特殊材料'
          : entry.legend === 'compatible'
            ? '融合兼容需求'
            : entry.legend === 'optional'
              ? '可选配料'
              : '图例必需';
    log.push(
      `接住${entry.name}（${tag}${unstable ? '；不稳定融合额外 +6 火候' : ''}）。当前叠层 ${state.stack.length}。`,
    );
    events.push({
      type: item.kind === 'fusion' ? 'fusion-catch' : 'catch-ingredient',
      slot,
      materialId,
      legend: entry.legend,
      unstable,
      heat: state.heat,
    });
  }

  advanceServiceTick(state, rng, `catch:${slot}`, log, events);
}

function performShoo(
  state: BurgerState,
  pestId: string,
  rng: Rng,
  log: string[],
  events: GameEvent[],
): void {
  const index = state.pests.findIndex((pest) => pest.id === pestId);
  const pest = state.pests[index]!;
  state.pests.splice(index, 1);
  log.push(`腾出另一只手赶走${pest.name}（还剩 ${pest.stealsIn} 拍就要偷吃）。`);
  events.push({ type: 'shoo', id: pest.id, kind: pest.kind });
  advanceServiceTick(state, rng, `shoo:${pestId}`, log, events);
}

function performDiscard(state: BurgerState, rng: Rng, log: string[], events: GameEvent[]): void {
  const top = state.stack.pop()!;
  log.push(`丢掉顶层${top.name}（${top.legend}）。叠层剩 ${state.stack.length}。`);
  events.push({ type: 'discard', materialId: top.id, legend: top.legend });
  advanceServiceTick(state, rng, 'discard-top', log, events);
}

function performWait(state: BurgerState, rng: Rng, log: string[], events: GameEvent[]): void {
  log.push('空拍等待：落物刷新，火候继续冷却，害虫也会靠近。');
  events.push({ type: 'wait' });
  advanceServiceTick(state, rng, 'wait', log, events);
}

function performServe(state: BurgerState, rng: Rng, log: string[], events: GameEvent[]): void {
  const preview = previewTaste(state);
  const roll = rng.int(1, 100);
  const verdict = resolveVerdict(preview, roll);
  const taste: TasteReport = { ...preview, roll, verdict };
  const guestName = state.guest.name;
  state.lastOrder = {
    order: state.order,
    recipeId: state.recipe.id,
    recipeName: state.recipe.name,
    taste,
    guest: guestName,
  };

  state.turnsUsed += 1;
  state.turnsRemaining -= 1;
  state.pests = [];

  const summary = `出餐「${state.recipe.name}」给${guestName}：阈值 ${taste.quality}，判定 ${taste.roll}，结论 ${verdict}；缺失 [${taste.missing.join(',')}]，错料 [${taste.wrongMix.join(',')}]，火候偏差 ${taste.heatDelta}（越界 ${taste.heatMiss}）。`;
  log.push(summary);
  events.push({ type: 'serve', ...taste, recipeId: state.recipe.id, guest: guestName });
  pushTimeline(state, `#${state.order} ${verdict} q=${taste.quality} roll=${taste.roll}`);

  if (verdict === 'tasty' || verdict === 'lucky') {
    state.served += 1;
    state.guest.mood = 100;
    log.push(
      verdict === 'lucky'
        ? `${guestName}咬了一口，居然觉得好吃！幸运美味计入 ${state.served}/${state.goal}。`
        : `${guestName}点头：正餐美味。进度 ${state.served}/${state.goal}。`,
    );
    if (state.served >= state.goal) {
      finish(
        state,
        'shift-done',
        `交班成功：送出 ${state.served}/${state.goal} 份美味汉堡，剩余 ${state.turnsRemaining} 拍。最后一单判定 ${taste.roll}/${taste.quality}（${verdict}）。`,
      );
      log.push(state.cause);
      events.push({ type: 'ending', ending: 'shift-done' });
      state.score = scoreOf(state);
      return;
    }
    if (state.turnsRemaining <= 0) {
      finish(
        state,
        'timeout',
        `班次耗尽：虽然刚送出一单，进度仍为 ${state.served}/${state.goal}。`,
      );
      log.push(state.cause);
      events.push({ type: 'ending', ending: 'timeout' });
      return;
    }
    beginOrder(state, rng, events);
  } else {
    if (verdict === 'disaster') state.ruined += 1;
    state.guest.mood = verdict === 'disaster' ? 0 : 20;
    state.lastSetback = summary;
    log.push(
      verdict === 'disaster'
        ? `${guestName}差点把盘子摔了（灾难餐 ${state.ruined}/${state.maxRuined}）。`
        : `${guestName}闷闷不乐（心情 ${state.guest.mood}）。该安抚还是放他走？`,
    );
    if (state.ruined >= state.maxRuined) {
      finish(
        state,
        'ruined',
        `厨房报废：灾难餐达到 ${state.ruined}/${state.maxRuined}。最后一单 roll ${taste.roll} / 阈值 ${taste.quality}，错料 [${taste.wrongMix.join(',')}]，火候偏差 ${taste.heatDelta}。`,
      );
      log.push(state.cause);
      events.push({ type: 'ending', ending: 'ruined' });
      return;
    }
    if (state.turnsRemaining <= 0) {
      finish(
        state,
        'timeout',
        `班次耗尽：出餐失败后已无时间安抚。进度 ${state.served}/${state.goal}。`,
      );
      log.push(state.cause);
      events.push({ type: 'ending', ending: 'timeout' });
      return;
    }
    state.phase = 'guest';
  }
  state.score = scoreOf(state);
}

function performSoothe(state: BurgerState, rng: Rng, log: string[], events: GameEvent[]): void {
  state.soothed += 1;
  state.turnsUsed += 1;
  state.turnsRemaining -= 1;
  state.guest.mood = 70;
  log.push(`你安抚了${state.guest.name}，对方勉强留下来。下一单开始。`);
  events.push({ type: 'soothe', guest: state.guest.name });
  pushTimeline(state, `安抚 · ${state.guest.name}`);
  if (state.turnsRemaining <= 0 && state.served < state.goal) {
    finish(state, 'timeout', `安抚后班次已尽，仍未凑满 ${state.goal} 份美味。`);
    log.push(state.cause);
    events.push({ type: 'ending', ending: 'timeout' });
    return;
  }
  state.phase = 'service';
  beginOrder(state, rng, events);
  state.score = scoreOf(state);
}

function performGuestWait(state: BurgerState, rng: Rng, log: string[], events: GameEvent[]): void {
  state.walkouts += 1;
  state.turnsUsed += 1;
  state.turnsRemaining -= 1;
  log.push(`${state.guest.name}愤然离店（离店 ${state.walkouts}/${state.maxWalkouts}）。`);
  events.push({ type: 'walkout', guest: state.guest.name, walkouts: state.walkouts });
  pushTimeline(state, `离店 · ${state.guest.name}`);
  if (state.walkouts >= state.maxWalkouts) {
    finish(
      state,
      'walkouts',
      `客人愤然离店达到上限 ${state.walkouts}/${state.maxWalkouts}。最近一次出餐：${state.lastSetback || '无记录'}。`,
    );
    log.push(state.cause);
    events.push({ type: 'ending', ending: 'walkouts' });
    return;
  }
  if (state.turnsRemaining <= 0 && state.served < state.goal) {
    finish(state, 'timeout', `离店处理后班次已尽，进度 ${state.served}/${state.goal}。`);
    log.push(state.cause);
    events.push({ type: 'ending', ending: 'timeout' });
    return;
  }
  state.phase = 'service';
  beginOrder(state, rng, events);
  state.score = scoreOf(state);
}

function catchRank(state: BurgerState, item: FallingItem): number {
  if (item.kind === 'heat') {
    const after = clamp(state.heat + item.heatValue - COOLING, 0, 100);
    const miss = Math.abs(heatMissOf(after, state.recipe));
    const beforeMiss = Math.abs(heatMissOf(state.heat, state.recipe));
    if (after >= state.recipe.heatMin && after <= state.recipe.heatMax) return 90 - miss;
    if (beforeMiss > 0 && miss < beforeMiss) return 80 - miss;
    if (after > state.recipe.heatMax) return -40 - miss;
    return 50 - miss;
  }
  const materialId =
    item.kind === 'fusion' ? (item.fusionResultId as MaterialId) : (item.materialId as MaterialId);
  const missing = missingRequired(state);
  const material = MATERIALS[materialId];
  const legend = legendOf(materialId, state.recipe);
  if (missing.includes(materialId) || material.satisfies.some((id) => missing.includes(id))) {
    return material.special ? 110 : item.kind === 'fusion' ? 100 : 95;
  }
  if (legend === 'special') return 70;
  if (legend === 'optional') return 15;
  if (legend === 'wrong') return -80;
  return -20;
}

export function actionsOf(state: BurgerState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  if (state.phase === 'guest') {
    return [
      {
        id: 'soothe',
        label: '安抚客人',
        detail: `花 1 拍安抚${state.guest.name}（心情 ${state.guest.mood}），保住这单并开下一单。`,
        risk: 'low',
        cost: '1 拍',
        tags: ['guest'],
      },
      {
        id: 'wait',
        label: '放任离店',
        detail: `明确放弃安抚，记一次愤怒离店（当前 ${state.walkouts}/${state.maxWalkouts}）。`,
        risk: 'high',
        cost: '1 拍',
        tags: ['guest', 'risk'],
      },
    ];
  }
  if (state.phase !== 'service') return [];

  type Ranked = ActionView & { rank: number };
  const ranked: Ranked[] = [];
  const preview = previewTaste(state);
  const canServeWell =
    preview.missing.length === 0 &&
    preview.heatMiss === 0 &&
    preview.quality >= 65;

  ranked.push({
    id: 'serve',
    label: '出餐',
    detail: `当前阈值 ${preview.quality}（缺失 ${preview.missing.length}，错料 ${preview.wrongMix.length}，火候偏差 ${preview.heatDelta}，越界 ${preview.heatMiss}）。判定值出餐时才抽。`,
    risk: canServeWell ? 'low' : preview.quality >= 45 ? 'medium' : 'high',
    cost: '1 拍',
    tags: ['serve'],
    rank: canServeWell ? 120 : preview.quality >= 55 && preview.missing.length === 0 ? 35 : -10,
  });

  for (const pest of state.pests) {
    const urgent = pest.stealsIn <= 1 && (state.stack.length > 0 || pest.kind === 'raccoon');
    ranked.push({
      id: `shoo:${pest.id}`,
      label: `驱赶${pest.name}`,
      detail: `${pest.blurb} 还有 ${pest.stealsIn} 拍动手。`,
      risk: urgent ? 'medium' : 'low',
      cost: '1 拍',
      tags: ['shoo'],
      rank: urgent ? 105 : 25,
    });
  }

  for (const item of state.falling) {
    const rank = catchRank(state, item);
    ranked.push({
      id: `catch:${item.slot}`,
      label: `接住${item.name}`,
      detail:
        item.kind === 'heat'
          ? `火候 +${item.heatValue}，拍末再冷却 ${COOLING}。`
          : item.kind === 'fusion'
            ? `融合进度 ${item.progress}/1 → ${MATERIALS[item.fusionResultId!].name}${
                item.progress === 0 ? '；现在接会额外 +6 火候' : ''
              }`
            : `材料 ${item.name}（图例 ${legendOf(item.materialId!, state.recipe)}）`,
      risk: rank < 0 ? 'high' : rank >= 90 ? 'low' : 'medium',
      cost: '1 拍',
      tags: ['catch', item.kind],
      rank,
    });
  }

  if (state.stack.length > 0) {
    const top = state.stack[state.stack.length - 1]!;
    ranked.push({
      id: 'discard-top',
      label: `丢掉${top.name}`,
      detail: `移除顶层（${top.legend}），给误接一个真实代价。`,
      risk: 'medium',
      cost: '1 拍',
      tags: ['discard'],
      rank: top.legend === 'wrong' ? 30 : -35,
    });
  }

  ranked.push({
    id: 'wait',
    label: '空拍等待',
    detail: '刷新落物并冷却火候；害虫也会靠近。',
    risk: 'medium',
    cost: '1 拍',
    tags: ['wait'],
    rank: 5,
  });

  ranked.sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
  return ranked.map(({ rank: _rank, ...action }) => action);
}

export function act(state: BurgerState, actionId: string): ActionResult {
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

  if (state.phase === 'guest') {
    if (actionId === 'soothe') performSoothe(state, rng, log, events);
    else if (actionId === 'wait') performGuestWait(state, rng, log, events);
    else throw new Error(`未处理的客人动作：${actionId}`);
  } else if (actionId.startsWith('catch:')) {
    performCatch(state, Number(actionId.slice('catch:'.length)), rng, log, events);
  } else if (actionId.startsWith('shoo:')) {
    performShoo(state, actionId.slice('shoo:'.length), rng, log, events);
  } else if (actionId === 'discard-top') {
    performDiscard(state, rng, log, events);
  } else if (actionId === 'wait') {
    performWait(state, rng, log, events);
  } else if (actionId === 'serve') {
    performServe(state, rng, log, events);
  } else {
    throw new Error(`未处理的动作：${actionId}`);
  }

  state.rng = rng.serialize();
  state.score = scoreOf(state);
  return { log, events };
}

export function abort(state: BurgerState): void {
  if (state.outcome !== 'ongoing') return;
  finish(
    state,
    'aborted',
    `主动收摊：进度 ${state.served}/${state.goal}，第 ${state.order} 单「${state.recipe.name}」，剩余 ${state.turnsRemaining} 拍。`,
  );
}

export function statusOf(state: BurgerState): StatusView {
  const metrics: Metric[] = [
    { label: '进度', value: `${state.served}/${state.goal}` },
    { label: '剩余拍', value: state.turnsRemaining },
    { label: '火候', value: `${state.heat}（目标 ${state.recipe.heatMin}-${state.recipe.heatMax}）` },
    { label: '离店', value: `${state.walkouts}/${state.maxWalkouts}` },
    { label: '灾难', value: `${state.ruined}/${state.maxRuined}` },
    { label: '得分', value: state.score },
  ];
  const sections: StatusSection[] = [];
  const recommended = actionsOf(state)[0];

  if (state.phase === 'service') {
    sections.push({
      title: `第 ${state.order} 单 · ${state.recipe.name}`,
      lines: [
        `必需：${state.recipe.required.map((id) => MATERIALS[id].name).join('、')}`,
        `可选：${state.recipe.optional.map((id) => MATERIALS[id].name).join('、') || '无'}`,
        state.recipe.note,
        `缺失：${missingRequired(state).map((id) => MATERIALS[id].name).join('、') || '无'}`,
      ],
    });
    sections.push({
      title: '汉堡叠层',
      lines:
        state.stack.length === 0
          ? ['（空）']
          : state.stack.map(
              (entry, index) =>
                `${index + 1}. ${entry.name} [${entry.legend}${entry.fused ? '/融合' : ''}${
                  entry.special ? '/特殊' : ''
                }]`,
            ),
    });
    sections.push({
      title: '落物三格',
      lines: state.falling.map((item) => {
        if (item.kind === 'heat') return `#${item.slot} 火候 ${item.name} +${item.heatValue}`;
        if (item.kind === 'fusion')
          return `#${item.slot} 融合 progress=${item.progress} → ${MATERIALS[item.fusionResultId!].name}`;
        return `#${item.slot} ${item.name}（${legendOf(item.materialId!, state.recipe)}）`;
      }),
    });
    sections.push({
      title: '害虫',
      lines:
        state.pests.length === 0
          ? ['暂无']
          : state.pests.map(
              (pest) => `${pest.id} ${pest.name}｜${pest.stealsIn} 拍后偷吃｜${pest.blurb}`,
            ),
    });
  } else if (state.phase === 'guest' && state.lastOrder) {
    const taste = state.lastOrder.taste;
    sections.push({
      title: '不满的客人',
      lines: [
        `${state.guest.name} 心情 ${state.guest.mood}`,
        `上一单 ${state.lastOrder.recipeName}：${taste.verdict}，阈值 ${taste.quality}，判定 ${taste.roll}`,
        `缺失 [${taste.missing.join(',')}]，错料 [${taste.wrongMix.join(',')}]，火候偏差 ${taste.heatDelta}`,
      ],
    });
  } else if (state.phase === 'ended') {
    sections.push({
      title: '收摊',
      lines: [ENDING_NAMES[state.ending ?? 'aborted'], state.cause],
    });
  }

  if (recommended) {
    sections.push({ title: '建议', lines: [`next → ${recommended.id}｜${recommended.detail ?? ''}`] });
  }
  if (state.notes.length > 0) {
    sections.push({ title: '备忘', lines: state.notes.slice(-4) });
  }

  const phaseLabel =
    state.phase === 'service' ? '出餐中' : state.phase === 'guest' ? '安抚窗口' : '已收摊';
  return {
    headline: `虾堡｜${phaseLabel}｜${state.served}/${state.goal}｜剩 ${state.turnsRemaining} 拍｜火候 ${state.heat}`,
    metrics,
    sections,
    outcome: state.outcome,
    turn: state.turnsUsed,
    phase: phaseLabel,
  };
}

export function recapOf(state: BurgerState): RecapView {
  const ending = state.ending ?? 'aborted';
  const taste = state.lastOrder?.taste;
  const lessons = [
    taste
      ? `最近一单阈值 ${taste.quality} / 判定 ${taste.roll}（${taste.verdict}）；缺失 [${taste.missing.join(',')}]，错料 [${taste.wrongMix.join(',')}]，火候偏差 ${taste.heatDelta}。`
      : '本局还没有完成出餐判定。',
    `害虫偷吃 ${state.pestThefts} 次，融合入栈 ${state.fusionsCaught}，错料入栈 ${state.wrongCaught}，安抚 ${state.soothed}。`,
    state.ending === 'shift-done'
      ? '这局按时交班。可记录：何时该出餐、何时该驱赶、何时该赌错料。'
      : state.ending === 'timeout'
        ? '时间被空拍、安抚或犹豫吃掉了。可记录：推荐动作是否该更早 serve。'
        : state.ending === 'walkouts'
          ? '安抚窗口被放弃。可记录：bad/disaster 后 soothe 的机会成本。'
          : state.ending === 'ruined'
            ? '灾难餐叠满。可记录：阈值公开后仍出餐的风险阈值。'
            : '主动收摊。可记录当前订单的缺失与火候位置。',
    '错料从不自动失败；把 seed、错料组合、火候偏差与判定值一起写进 memory，才算可复验。',
    '单局观察不是真理：换 seed 再验证同一策略。',
  ];
  return {
    title: `虾堡结算 · ${ENDING_NAMES[ending]}`,
    outcome: state.outcome,
    cause: state.cause || `进行中：${state.served}/${state.goal}，剩余 ${state.turnsRemaining} 拍。`,
    metrics: [
      { label: '美味', value: `${state.served}/${state.goal}` },
      { label: '得分', value: state.score },
      { label: '用拍', value: state.turnsUsed },
      { label: '离店', value: state.walkouts },
      { label: '灾难', value: state.ruined },
      { label: '偷吃', value: state.pestThefts },
    ],
    timeline: state.timeline.slice(-12),
    lessons,
    memoryPrompt:
      '把本局可复验的观察写进 memory：seed、难度、关键动作序列、出餐阈值与判定值、错料组合、火候偏差、害虫偷吃。标注“需换 seed 再验证”，不要把单次幸运写成规律。',
  };
}
