/**
 * Pure pulse-based tower-defense rules.
 *
 * The engine owns the state machine and every number that changes during a
 * run. It never renders text for the CLI directly; `definition.ts` turns the
 * exported query helpers into status sections and legal action ids.
 */

import type { CreateOptions, GameEvent, Outcome } from '@gameclaw/gamekit';
import { illegalAction, Rng } from '@gameclaw/gamekit';

import {
  buildWavePlan,
  DOCTRINES,
  type DoctrineKey,
  doctrineByKey,
  ENEMIES,
  type EnemyKey,
  type LaneKey,
  type NodeKey,
  type SlotKey,
  type SpawnEntry,
  STAGE,
  UNIT_ORDER,
  UNITS,
  type UnitKey,
} from './content';

export type Phase = 'doctrine' | 'setup' | 'battle' | 'ended';

export interface UnitState {
  key: UnitKey;
  /** Current shell points while deployed. Reset on redeploy. */
  hp: number;
  slot: SlotKey | null;
  /** Earliest pulse this unit can be deployed again. */
  readyPulse: number;
  /** Remaining lifetime for short-lived units; `null` means permanent. */
  duration: number | null;
  damage: number;
  kills: number;
  deployments: number;
  recalls: number;
  defeats: number;
  lastSlot: SlotKey | null;
}

export interface EnemyState {
  uid: number;
  key: EnemyKey;
  lane: LaneKey;
  /** Index into the lane path: 0 = entrance, 2 = shared choke, 3 = sea. */
  pos: number;
  hp: number;
  /** Movement points denied on the current pulse. */
  slowed: number;
  /** Extra damage taken on the current pulse. */
  exposed: number;
}

export interface LeakRecord {
  pulse: number;
  lane: LaneKey;
  enemy: EnemyKey;
  amount: number;
}

export interface TowerDefenseState {
  version: 1;
  seed: number;
  /** sfc32 state, always restored before acting and serialised afterwards. */
  rng: number[];
  phase: Phase;
  doctrine: DoctrineKey | null;
  stage: string;
  wavePlan: SpawnEntry[][];
  pulse: number;
  tide: number;
  integrity: number;
  maxIntegrity: number;
  roster: UnitState[];
  enemies: EnemyState[];
  leaks: number;
  kills: number;
  nextUid: number;
  laneLeaks: Record<LaneKey, number>;
  firstLeak: Record<LaneKey, { pulse: number; enemy: EnemyKey } | null>;
  leakHistory: LeakRecord[];
  notes: string[];
  skillReadyPulse: number;
  skillUses: number;
  /** Crusher buff target for the pulse currently being resolved. */
  crusherSlot: SlotKey | null;
  /** Oracle buff lane for the pulse currently being resolved. */
  oracleLane: LaneKey | null;
  lastBreakLane: LaneKey | null;
  lastBreakEnemy: EnemyKey | null;
  lastResult: string | null;
  timeline: string[];
  outcome: Outcome;
  cause: string;
  turn: number;
}

export const GAME_ID = 'lobster-cli-tower-defense';
export const GAME_VERSION = '2.0.0';

export const OUTCOME_TEXT: Record<Outcome, string> = {
  ongoing: '进行中',
  won: '守住',
  lost: '失守',
  aborted: '中止',
};

const DEPLOY_PRIORITY: Record<string, number> = {
  support: 0,
  splash: 0,
  ranged: 1,
  control: 2,
  melee: 3,
  decoy: 4,
};

export function createRun(options: CreateOptions): TowerDefenseState {
  const rng = Rng.fromSeed(options.seed);
  const wavePlan = buildWavePlan(rng);
  return {
    version: 1,
    seed: options.seed,
    rng: rng.serialize(),
    phase: 'doctrine',
    doctrine: null,
    stage: STAGE.key,
    wavePlan,
    pulse: 1,
    tide: 0,
    integrity: 0,
    maxIntegrity: 0,
    roster: [],
    enemies: [],
    leaks: 0,
    kills: 0,
    nextUid: 1,
    laneLeaks: { left: 0, mid: 0, right: 0 },
    firstLeak: { left: null, mid: null, right: null },
    leakHistory: [],
    notes: [],
    skillReadyPulse: 1,
    skillUses: 0,
    crusherSlot: null,
    oracleLane: null,
    lastBreakLane: null,
    lastBreakEnemy: null,
    lastResult: null,
    timeline: [],
    outcome: 'ongoing',
    cause: '',
    turn: 0,
  };
}

export function doctrineOf(state: TowerDefenseState) {
  if (!state.doctrine) throw new Error('No doctrine selected');
  return doctrineByKey(state.doctrine);
}

export function unitCost(doctrine: ReturnType<typeof doctrineOf>, key: UnitKey): number {
  return Math.max(1, UNITS[key].cost - (doctrine.discounts[key] ?? 0));
}

export function unitMaxHp(doctrine: ReturnType<typeof doctrineOf>, key: UnitKey): number {
  const template = UNITS[key];
  return template.maxHp + (template.block > 0 ? doctrine.blockerHpBonus : 0);
}

export function unitAttack(doctrine: ReturnType<typeof doctrineOf>, key: UnitKey): number {
  const template = UNITS[key];
  const supportBonus =
    template.kind === 'support' || template.kind === 'splash' ? doctrine.supportAttackBonus : 0;
  return template.attack + supportBonus;
}

export function unitDuration(doctrine: ReturnType<typeof doctrineOf>, key: UnitKey): number | null {
  const template = UNITS[key];
  if (template.duration === null) return null;
  return template.duration + doctrine.decoyDurationBonus;
}

export function unitRedeployCooldown(
  doctrine: ReturnType<typeof doctrineOf>,
  key: UnitKey,
): number {
  return Math.max(1, UNITS[key].redeployCooldown + doctrine.redeployCooldownDelta);
}

export function currentEntries(state: TowerDefenseState, offset: number): readonly SpawnEntry[] {
  return state.wavePlan[state.pulse - 1 + offset] ?? [];
}

export function rosterBySlot(state: TowerDefenseState, slotKey: SlotKey): UnitState | undefined {
  return state.roster.find((unit) => unit.slot === slotKey);
}

export function deployedUnits(state: TowerDefenseState): UnitState[] {
  return UNIT_ORDER.map((key) => state.roster.find((unit) => unit.key === key)).filter(
    (unit): unit is UnitState => unit !== undefined && unit.slot !== null,
  );
}

export function skillCooldownRemaining(state: TowerDefenseState): number {
  return Math.max(0, state.skillReadyPulse - state.pulse);
}

export function effectiveAttack(state: TowerDefenseState, unit: UnitState): number {
  const base = unitAttack(doctrineOf(state), unit.key);
  return base + (state.crusherSlot !== null && unit.slot === state.crusherSlot ? 2 : 0);
}

export function effectiveBlock(state: TowerDefenseState, unit: UnitState): number {
  const base = UNITS[unit.key].block;
  return base + (state.crusherSlot !== null && unit.slot === state.crusherSlot ? 1 : 0);
}

export function laneHasBlocker(state: TowerDefenseState, lane: LaneKey): boolean {
  return STAGE.laneBlockSlots[lane].some((slotKey) => {
    const unit = rosterBySlot(state, slotKey);
    return unit !== undefined && effectiveBlock(state, unit) > 0;
  });
}

export function scoreOf(state: TowerDefenseState): number {
  return state.kills * 2 + Math.max(0, state.integrity) * 3 - state.leaks;
}

export function pulseLabel(state: TowerDefenseState): string {
  const total = state.wavePlan.length;
  return state.pulse <= total ? `${state.pulse}/${total}` : `${total}+尾波`;
}

export function enemyNode(enemy: EnemyState): NodeKey {
  return STAGE.paths[enemy.lane][enemy.pos] ?? 'SEA';
}

export function enemiesAtNode(state: TowerDefenseState, node: NodeKey): EnemyState[] {
  return state.enemies.filter((enemy) => enemyNode(enemy) === node);
}

// ---------------------------------------------------------------------------
// Legal action queries
// ---------------------------------------------------------------------------

export interface DeployOption {
  unit: UnitKey;
  slot: SlotKey;
  cost: number;
  hp: number;
  attack: number;
  block: number;
}

export function deployOptions(state: TowerDefenseState): DeployOption[] {
  if (state.phase !== 'setup' && state.phase !== 'battle') return [];
  const doctrine = doctrineOf(state);
  const options: DeployOption[] = [];
  for (const key of UNIT_ORDER) {
    const unit = state.roster.find((item) => item.key === key);
    if (!unit || unit.slot !== null || unit.readyPulse > state.pulse) continue;
    const template = UNITS[key];
    const cost = unitCost(doctrine, key);
    if (state.tide < cost) continue;
    for (const slotKey of STAGE.slotOrder) {
      if (!template.allowedSlots.includes(slotKey)) continue;
      if (rosterBySlot(state, slotKey) !== undefined) continue;
      options.push({
        unit: key,
        slot: slotKey,
        cost,
        hp: unitMaxHp(doctrine, key),
        attack: unitAttack(doctrine, key),
        block: template.block,
      });
    }
  }
  return options;
}

export interface RecallOption {
  slot: SlotKey;
  unit: UnitState;
  refund: number;
}

export function recallOptions(state: TowerDefenseState): RecallOption[] {
  const doctrine = doctrineOf(state);
  return STAGE.slotOrder.flatMap((slotKey) => {
    const unit = rosterBySlot(state, slotKey);
    if (!unit) return [];
    // A recall is a partial refund, never a tide printer.
    const refund = Math.min(1 + doctrine.recallRefundBonus, unitCost(doctrine, unit.key));
    return [{ slot: slotKey, unit, refund }];
  });
}

export type SkillPlan =
  | { doctrine: 'crusher'; slot: SlotKey; unit: UnitKey }
  | { doctrine: 'oracle'; lane: LaneKey }
  | { doctrine: 'gambler'; from: SlotKey; to: SlotKey; unit: UnitKey };

function enemyWeight(enemyKey: EnemyKey): number {
  const enemy = ENEMIES[enemyKey];
  return enemy.weight + enemy.leak;
}

/** Rough pressure a slot would face this pulse, used for deterministic auto-targeting. */
export function slotPressure(state: TowerDefenseState, slotKey: SlotKey): number {
  const slot = STAGE.slots[slotKey];
  const nodeSet = new Set<string>(slot.coverage);
  let score = 0;
  for (const enemy of state.enemies) {
    const node = enemyNode(enemy);
    if (nodeSet.has(node)) {
      score += 3 * enemyWeight(enemy.key);
      continue;
    }
    if (!slot.isPath) continue;
    const path = STAGE.paths[enemy.lane];
    const index = path.indexOf(slot.node);
    if (index >= 0 && enemy.pos < index) score += enemyWeight(enemy.key);
  }
  for (const entry of currentEntries(state, 0)) {
    const covered = slot.isPath
      ? STAGE.paths[entry.lane].includes(slot.node)
      : nodeSet.has(STAGE.paths[entry.lane][0] ?? 'SEA');
    if (covered) score += 2 * enemyWeight(entry.enemy) * entry.count;
  }
  return score;
}

export function lanePressure(state: TowerDefenseState, lane: LaneKey): number {
  let score = 0;
  for (const enemy of state.enemies) {
    if (enemy.lane === lane) score += 3 * enemyWeight(enemy.key);
  }
  for (const entry of currentEntries(state, 0)) {
    if (entry.lane === lane) score += 2 * enemyWeight(entry.enemy) * entry.count;
  }
  return score;
}

export function skillPlan(state: TowerDefenseState): SkillPlan | null {
  if (state.phase !== 'battle' || !state.doctrine) return null;
  const doctrine = doctrineByKey(state.doctrine);
  if (skillCooldownRemaining(state) > 0) return null;
  if (state.tide < doctrine.skillCost) return null;

  if (doctrine.key === 'crusher') {
    let best: { slot: SlotKey; unit: UnitKey; pressure: number } | null = null;
    for (const slotKey of STAGE.slotOrder) {
      if (!STAGE.slots[slotKey].isPath) continue;
      const unit = rosterBySlot(state, slotKey);
      if (!unit) continue;
      const pressure = slotPressure(state, slotKey);
      if (!best || pressure > best.pressure) {
        best = { slot: slotKey, unit: unit.key, pressure };
      }
    }
    if (!best || best.pressure <= 0) return null;
    return { doctrine: 'crusher', slot: best.slot, unit: best.unit };
  }

  if (doctrine.key === 'oracle') {
    let best: { lane: LaneKey; pressure: number } | null = null;
    for (const lane of STAGE.lanes) {
      const pressure = lanePressure(state, lane);
      if (!best || pressure > best.pressure) best = { lane, pressure };
    }
    if (!best || best.pressure <= 0) return null;
    return { doctrine: 'oracle', lane: best.lane };
  }

  let best: { from: SlotKey; to: SlotKey; unit: UnitKey; value: number } | null = null;
  for (const from of STAGE.slotOrder) {
    const unit = rosterBySlot(state, from);
    if (!unit) continue;
    const template = UNITS[unit.key];
    const maxHp = unitMaxHp(doctrine, unit.key);
    const missing = Math.max(0, maxHp - unit.hp);
    const sourcePressure = slotPressure(state, from);
    for (const to of STAGE.slotOrder) {
      if (to === from || !template.allowedSlots.includes(to)) continue;
      if (rosterBySlot(state, to) !== undefined) continue;
      const value = slotPressure(state, to) * 6 - sourcePressure * 3 + missing;
      if (!best || value > best.value) best = { from, to, unit: unit.key, value };
    }
  }
  if (!best || best.value <= 0) return null;
  return { doctrine: 'gambler', from: best.from, to: best.to, unit: best.unit };
}

// ---------------------------------------------------------------------------
// State mutation helpers
// ---------------------------------------------------------------------------

function pushNote(state: TowerDefenseState, note: string, limit = 8): void {
  const existing = state.notes.indexOf(note);
  if (existing >= 0) state.notes.splice(existing, 1);
  state.notes.push(note);
  if (state.notes.length > limit) state.notes.splice(0, state.notes.length - limit);
}

function pushTimeline(state: TowerDefenseState, entry: string): void {
  state.timeline.push(entry);
  if (state.timeline.length > 40) state.timeline.shift();
}

function endRun(state: TowerDefenseState, outcome: Outcome, cause: string): void {
  state.phase = 'ended';
  state.outcome = outcome;
  state.cause = cause;

  if (state.laneLeaks.left + state.laneLeaks.mid + state.laneLeaks.right > 0) {
    const worstLane = [...STAGE.lanes].sort(
      (a, b) =>
        state.laneLeaks[b] - state.laneLeaks[a] || STAGE.lanes.indexOf(a) - STAGE.lanes.indexOf(b),
    )[0];
    if (worstLane && state.laneLeaks[worstLane] > 0) {
      pushNote(
        state,
        `${STAGE.laneTitles[worstLane]}总共漏了 ${state.laneLeaks[worstLane]} 点完整度；如果这条线又要吃快潮又要吃精英，C 位最好别空太久。`,
      );
    }
  }

  let best: UnitState | null = null;
  for (const unit of state.roster) {
    if (
      !best ||
      unit.damage > best.damage ||
      (unit.damage === best.damage && unit.kills > best.kills)
    ) {
      best = unit;
    }
  }
  if (best && best.damage > 0) {
    pushNote(
      state,
      `本局输出最高的是【${UNITS[best.key].title}】（${best.damage} 伤 / ${best.kills} 收壳）；它更像补关键 threat 的位子，不该随手乱摆。`,
    );
  }
  if (state.skillUses > 0 && state.doctrine) {
    pushNote(
      state,
      `这轮【${doctrineByKey(state.doctrine).skillName}】共用了 ${state.skillUses} 次；它更像救节奏的窗，而不是一冷却好就必须交的按钮。`,
    );
  }
  if (outcome === 'won') {
    pushNote(
      state,
      '这次守住了，不等于这条图已经被你解完；下局最好再换 seed，验证是不是同一套 opener 仍然稳。',
    );
  } else if (outcome === 'lost' && state.lastBreakLane && state.lastBreakEnemy) {
    pushNote(
      state,
      `最后打穿你的是 ${STAGE.laneTitles[state.lastBreakLane]}的【${ENEMIES[state.lastBreakEnemy].title}】；下局优先验证那里是缺拦口、缺减速，还是潮技交晚了。`,
    );
  }
  pushTimeline(state, `结束 · ${OUTCOME_TEXT[outcome]} · ${cause}`);
}

function sendToCooldown(
  state: TowerDefenseState,
  unit: UnitState,
  defeated: boolean,
  cooldown: number,
): void {
  unit.slot = null;
  unit.duration = null;
  unit.hp = unitMaxHp(doctrineOf(state), unit.key);
  unit.readyPulse = state.pulse + cooldown;
  if (defeated) unit.defeats += 1;
}

function spendSkillCharge(
  state: TowerDefenseState,
  doctrine: ReturnType<typeof doctrineOf>,
  target: string,
): void {
  state.tide -= doctrine.skillCost;
  state.skillReadyPulse = state.pulse + doctrine.skillCooldown + 1;
  state.skillUses += 1;
  pushNote(
    state,
    `这次把【${doctrine.skillName}】交给了 ${target}；它像翻盘窗，不等于每个 pulse 都该提前白交。`,
  );
}

// ---------------------------------------------------------------------------
// Pulse resolution
// ---------------------------------------------------------------------------

interface Resolution {
  log: string[];
  events: GameEvent[];
}

function spawnEnemies(state: TowerDefenseState): Resolution {
  const log: string[] = [];
  const events: GameEvent[] = [];
  const entries = currentEntries(state, 0);
  if (entries.length === 0) {
    log.push('本 pulse 没有新敌潮入场。');
    return { log, events };
  }
  const parts: string[] = [];
  for (const entry of entries) {
    const template = ENEMIES[entry.enemy];
    parts.push(`${STAGE.laneShort[entry.lane]}【${template.title}】x${entry.count}`);
    for (let i = 0; i < entry.count; i += 1) {
      state.enemies.push({
        uid: state.nextUid,
        key: entry.enemy,
        lane: entry.lane,
        pos: 0,
        hp: template.maxHp,
        slowed: 0,
        exposed: 0,
      });
      state.nextUid += 1;
    }
  }
  log.push(`入潮：${parts.join('；')}。`);
  events.push({
    type: 'spawn',
    pulse: state.pulse,
    entries: entries.map((entry) => ({ ...entry })),
  });
  return { log, events };
}

function applyOracleSkill(state: TowerDefenseState): Resolution {
  const log: string[] = [];
  const events: GameEvent[] = [];
  if (!state.oracleLane) return { log, events };
  const lane = state.oracleLane;
  let affected = 0;
  for (const enemy of state.enemies) {
    if (enemy.lane !== lane) continue;
    enemy.slowed = Math.max(enemy.slowed, 1);
    enemy.exposed += 1;
    affected += 1;
  }
  log.push(`${STAGE.laneTitles[lane]}被【触须预警】点亮：${affected} 个目标更慢、更脆。`);
  events.push({ type: 'skill-effect', doctrine: 'oracle', lane, affected });
  return { log, events };
}

function coveredEnemies(state: TowerDefenseState, unit: UnitState): EnemyState[] {
  if (!unit.slot) return [];
  const slot = STAGE.slots[unit.slot];
  const kind = UNITS[unit.key].kind;
  const sameNodeOnly = kind === 'melee' || kind === 'control' || kind === 'decoy';
  return state.enemies.filter((enemy) => {
    const node = enemyNode(enemy);
    if (!slot.coverage.includes(node)) return false;
    return !sameNodeOnly || node === slot.node;
  });
}

function chooseTarget(unit: UnitState, candidates: EnemyState[]): EnemyState | undefined {
  let pool = candidates;
  if (unit.key === 'ring-cutter') {
    const armored = candidates.filter((enemy) => {
      const tags = ENEMIES[enemy.key].tags;
      return tags.includes('armored') || tags.includes('elite');
    });
    if (armored.length > 0) pool = armored;
  } else if (unit.key === 'whisker-scout') {
    const fast = candidates.filter((enemy) => {
      const tags = ENEMIES[enemy.key].tags;
      return tags.includes('runner') || tags.includes('shock');
    });
    if (fast.length > 0) pool = fast;
  }
  let best: EnemyState | undefined;
  for (const enemy of pool) {
    if (
      !best ||
      enemy.pos > best.pos ||
      (enemy.pos === best.pos && enemy.hp > best.hp) ||
      (enemy.pos === best.pos && enemy.hp === best.hp && enemy.uid < best.uid)
    ) {
      best = enemy;
    }
  }
  return best;
}

function dealDamage(unit: UnitState, enemy: EnemyState, amount: number, armorPierce = 0): number {
  const template = ENEMIES[enemy.key];
  const reduction = Math.max(0, template.armor - armorPierce);
  const raw = amount + enemy.exposed;
  // Armor may soften a hit but never makes an attacking unit completely useless:
  // without the floor, a slowed armored enemy can park forever and soft-lock the run.
  const actual = raw <= 0 ? 0 : Math.max(1, raw - reduction);
  enemy.hp -= actual;
  unit.damage += actual;
  return actual;
}

function cleanupDead(
  state: TowerDefenseState,
  source: UnitState,
  log: string[],
  events: GameEvent[],
): void {
  const alive: EnemyState[] = [];
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      alive.push(enemy);
      continue;
    }
    state.kills += 1;
    source.kills += 1;
    log.push(
      `${source.slot ?? '?'} ${UNITS[source.key].short} 收壳了【${ENEMIES[enemy.key].title}】。`,
    );
    events.push({
      type: 'kill',
      unit: source.key,
      slot: source.slot,
      enemy: enemy.key,
      uid: enemy.uid,
    });
  }
  state.enemies = alive;
}

function resolveUnitActions(state: TowerDefenseState): Resolution {
  const log: string[] = [];
  const events: GameEvent[] = [];
  const units = deployedUnits(state).sort((a, b) => {
    const priority =
      (DEPLOY_PRIORITY[UNITS[a.key].kind] ?? 0) - (DEPLOY_PRIORITY[UNITS[b.key].kind] ?? 0);
    if (priority !== 0) return priority;
    return STAGE.slotOrder.indexOf(a.slot ?? 'C') - STAGE.slotOrder.indexOf(b.slot ?? 'C');
  });

  for (const unit of units) {
    if (!unit.slot || unit.hp <= 0) continue;
    if (unit.key === 'molt-decoy') continue;
    const candidates = coveredEnemies(state, unit);
    if (candidates.length === 0) continue;

    if (unit.key === 'salt-spray') {
      const slot = STAGE.slots[unit.slot];
      let bestNode: NodeKey | null = null;
      let bestSize = -1;
      for (const node of slot.coverage) {
        const size = enemiesAtNode(state, node).length;
        if (size > bestSize) {
          bestNode = node;
          bestSize = size;
        }
      }
      if (!bestNode || bestSize <= 0) continue;
      const targets = enemiesAtNode(state, bestNode);
      for (const enemy of targets) {
        dealDamage(unit, enemy, effectiveAttack(state, unit));
        enemy.slowed = Math.max(enemy.slowed, UNITS[unit.key].slow);
      }
      log.push(
        `${unit.slot} ${UNITS[unit.key].short} 在 ${bestNode} 喷出盐沫，压了 ${targets.length} 个目标。`,
      );
      events.push({
        type: 'splash',
        unit: unit.key,
        slot: unit.slot,
        node: bestNode,
        targets: targets.length,
      });
      cleanupDead(state, unit, log, events);
      continue;
    }

    const target = chooseTarget(unit, candidates);
    if (!target) continue;
    const template = UNITS[unit.key];
    const dealt = dealDamage(unit, target, effectiveAttack(state, unit), template.armorPierce);
    if (template.slow > 0) target.slowed = Math.max(target.slowed, template.slow);
    if (template.expose > 0) target.exposed += template.expose;
    if (template.push > 0) target.pos = Math.max(0, target.pos - template.push);
    log.push(`${unit.slot} ${template.short} -> 【${ENEMIES[target.key].title}】 ${dealt}。`);
    events.push({
      type: 'attack',
      unit: unit.key,
      slot: unit.slot,
      enemy: target.key,
      uid: target.uid,
      damage: dealt,
    });
    cleanupDead(state, unit, log, events);
  }
  return { log, events };
}

function resolveEnemyStrikes(state: TowerDefenseState): Resolution {
  const log: string[] = [];
  const events: GameEvent[] = [];
  for (const slotKey of STAGE.slotOrder) {
    if (!STAGE.slots[slotKey].isPath) continue;
    const unit = rosterBySlot(state, slotKey);
    if (!unit) continue;
    const nodeEnemies = enemiesAtNode(state, STAGE.slots[slotKey].node);
    if (nodeEnemies.length === 0) continue;
    const total = nodeEnemies.reduce((sum, enemy) => sum + ENEMIES[enemy.key].contactDamage, 0);
    const before = unit.hp;
    unit.hp -= total;
    log.push(
      `${slotKey} ${UNITS[unit.key].short} 吃到 ${nodeEnemies.length} 个目标合计 ${total} 点冲击（壳 ${Math.max(0, before)}→${Math.max(0, unit.hp)}）。`,
    );
    events.push({
      type: 'strike',
      slot: slotKey,
      unit: unit.key,
      targets: nodeEnemies.length,
      damage: total,
      hp: unit.hp,
    });
    if (unit.hp <= 0) {
      const threat = [...nodeEnemies].sort((a, b) => {
        const enemyA = ENEMIES[a.key];
        const enemyB = ENEMIES[b.key];
        return (
          enemyB.contactDamage - enemyA.contactDamage || enemyB.leak - enemyA.leak || a.uid - b.uid
        );
      })[0];
      const cooldown = unitRedeployCooldown(doctrineOf(state), unit.key);
      sendToCooldown(state, unit, true, cooldown);
      log.push(`${slotKey} 的【${UNITS[unit.key].title}】被拆掉，进入再编冷却。`);
      pushNote(
        state,
        `${slotKey} 的【${UNITS[unit.key].title}】${
          threat ? `被【${ENEMIES[threat.key].title}】打穿过一次` : '被打穿过一次'
        }；这说明这里只靠薄前排容易崩。`,
      );
      events.push({ type: 'defeat', slot: slotKey, unit: unit.key });
    }
  }
  return { log, events };
}

function isBlockedNow(state: TowerDefenseState, enemy: EnemyState): boolean {
  const node = enemyNode(enemy);
  let blocker: UnitState | undefined;
  for (const unit of deployedUnits(state)) {
    if (!unit.slot) continue;
    const slot = STAGE.slots[unit.slot];
    if (slot.isPath && slot.node === node) {
      blocker = unit;
      break;
    }
  }
  if (!blocker) return false;
  const capacity = effectiveBlock(state, blocker);
  if (capacity <= 0) return false;
  const occupants = state.enemies
    .filter((item) => enemyNode(item) === node)
    .sort((a, b) => a.uid - b.uid);
  let used = 0;
  for (const occupant of occupants) {
    const weight = ENEMIES[occupant.key].weight;
    if (used + weight <= capacity) {
      if (occupant.uid === enemy.uid) return true;
      used += weight;
      continue;
    }
    return false;
  }
  return false;
}

function resolveEnemyMovement(state: TowerDefenseState): Resolution {
  const log: string[] = [];
  const events: GameEvent[] = [];
  const ordered = [...state.enemies].sort((a, b) => b.pos - a.pos || a.uid - b.uid);
  const survivors: EnemyState[] = [];

  for (const enemy of ordered) {
    const template = ENEMIES[enemy.key];
    const path = STAGE.paths[enemy.lane];
    let steps = Math.max(0, template.speed - enemy.slowed);
    // Slow must not permanently root an unblocked enemy: otherwise a speed-1
    // enemy parked on an empty path node can soft-lock the tail waves forever.
    if (steps === 0 && !isBlockedNow(state, enemy)) steps = 1;
    enemy.slowed = 0;
    let escaped = false;
    while (steps > 0) {
      if (isBlockedNow(state, enemy)) break;
      enemy.pos += 1;
      if (enemy.pos >= path.length - 1) {
        state.integrity -= template.leak;
        state.leaks += template.leak;
        state.laneLeaks[enemy.lane] += template.leak;
        state.lastBreakLane = enemy.lane;
        state.lastBreakEnemy = enemy.key;
        state.leakHistory.push({
          pulse: state.pulse,
          lane: enemy.lane,
          enemy: enemy.key,
          amount: template.leak,
        });
        if (!state.firstLeak[enemy.lane]) {
          state.firstLeak[enemy.lane] = { pulse: state.pulse, enemy: enemy.key };
          pushNote(
            state,
            `${STAGE.laneTitles[enemy.lane]}在 pulse ${state.pulse} 第一次漏了【${template.title}】；下局要再验证这里是缺前排，还是只是太贪着省潮令。`,
          );
        }
        log.push(
          `【${template.title}】从 ${STAGE.laneTitles[enemy.lane]}漏过，归海线 -${template.leak}。`,
        );
        events.push({
          type: 'leak',
          pulse: state.pulse,
          lane: enemy.lane,
          enemy: enemy.key,
          amount: template.leak,
        });
        escaped = true;
        break;
      }
      steps -= 1;
    }
    enemy.exposed = 0;
    if (!escaped) survivors.push(enemy);
  }
  state.enemies = survivors;
  return { log, events };
}

function expireDurationUnits(state: TowerDefenseState): Resolution {
  const log: string[] = [];
  const events: GameEvent[] = [];
  for (const unit of deployedUnits(state)) {
    if (unit.duration === null || !unit.slot) continue;
    const slot = unit.slot;
    unit.duration -= 1;
    if (unit.duration <= 0) {
      const cooldown = unitRedeployCooldown(doctrineOf(state), unit.key);
      sendToCooldown(state, unit, false, cooldown);
      log.push(`${slot} 的【${UNITS[unit.key].title}】撑完了这波，自动退回再编。`);
      events.push({ type: 'expire', slot, unit: unit.key });
    }
  }
  return { log, events };
}

function resolvePulse(state: TowerDefenseState): Resolution {
  const log: string[] = [];
  const events: GameEvent[] = [];
  const killsBefore = state.kills;
  const leaksBefore = state.leaks;
  const integrityBefore = state.integrity;

  for (const step of [
    spawnEnemies,
    applyOracleSkill,
    resolveUnitActions,
    resolveEnemyStrikes,
    resolveEnemyMovement,
    expireDurationUnits,
  ]) {
    const resolution = step(state);
    log.push(...resolution.log);
    events.push(...resolution.events);
  }

  state.crusherSlot = null;
  state.oracleLane = null;
  state.lastResult = `Pulse ${state.pulse}：收壳 ${state.kills - killsBefore} · 漏 ${
    state.leaks - leaksBefore
  } · 归海线 ${Math.max(0, integrityBefore)}→${Math.max(0, state.integrity)}/${
    state.maxIntegrity
  } · 潮令 ${state.tide}`;
  pushTimeline(state, state.lastResult);
  events.push({
    type: 'pulse',
    pulse: state.pulse,
    kills: state.kills - killsBefore,
    leaks: state.leaks - leaksBefore,
    integrity: state.integrity,
    tide: state.tide,
  });
  return { log, events };
}

// ---------------------------------------------------------------------------
// Public action entry point
// ---------------------------------------------------------------------------

export interface ActionResolution {
  log: string[];
  events: GameEvent[];
}

export function act(state: TowerDefenseState, actionId: string): ActionResolution {
  if (state.outcome !== 'ongoing') {
    throw illegalAction(
      `本局已经结束（${OUTCOME_TEXT[state.outcome]}）。`,
      '运行 recap 查看结算。',
    );
  }
  const rng = Rng.restore(state.rng);
  const log: string[] = [];
  const events: GameEvent[] = [];
  state.turn += 1;

  const parts = actionId.split(':');
  const head = parts[0] ?? '';

  if (state.phase === 'doctrine') {
    if (head !== 'doctrine') {
      throw illegalAction(
        `开局必须先选择 doctrine，不能执行 ${actionId}。`,
        `合法动作：${DOCTRINES.map((doctrine) => `doctrine:${doctrine.key}`).join(', ')}`,
      );
    }
    const key = parts[1] ?? '';
    const doctrine = DOCTRINES.find((item) => item.key === key);
    if (!doctrine) throw illegalAction(`未知 doctrine：${key}`);
    state.doctrine = doctrine.key;
    state.tide = doctrine.startingTide;
    state.integrity = doctrine.startingIntegrity;
    state.maxIntegrity = doctrine.startingIntegrity;
    state.roster = UNIT_ORDER.map((unitKey) => ({
      key: unitKey,
      hp: unitMaxHp(doctrine, unitKey),
      slot: null,
      readyPulse: 1,
      duration: null,
      damage: 0,
      kills: 0,
      deployments: 0,
      recalls: 0,
      defeats: 0,
      lastSlot: null,
    }));
    state.skillReadyPulse = 1;
    state.phase = 'setup';
    log.push(
      `你以【${doctrine.title}】入场：潮令 ${doctrine.startingTide}，归海线 ${doctrine.startingIntegrity}/${doctrine.startingIntegrity}。`,
    );
    log.push(`先布防；随时 act ready 放敌潮进场（共 ${state.wavePlan.length} 个 pulse）。`);
    events.push({ type: 'doctrine', doctrine: doctrine.key });
    state.rng = rng.serialize();
    return { log, events };
  }

  if (head === 'doctrine') {
    throw illegalAction('doctrine 已经选过了。', '可以用 `act ready` 开始敌潮。');
  }

  if (head === 'deploy') {
    if (state.phase !== 'setup' && state.phase !== 'battle') {
      throw illegalAction('现在不能部署。');
    }
    const unitKey = parts[1] ?? '';
    const slotKey = parts[2] ?? '';
    const option = deployOptions(state).find(
      (item) => item.unit === unitKey && item.slot === slotKey,
    );
    if (!option) {
      throw illegalAction(
        `不能部署 ${unitKey || '?'} 到 ${slotKey || '?'}。`,
        '运行 `actions` 查看当前合法的 deploy:<unit>:<slot>。',
      );
    }
    const unit = state.roster.find((item) => item.key === option.unit);
    if (!unit) throw illegalAction(`未知单位：${unitKey}`);
    const doctrine = doctrineOf(state);
    unit.slot = option.slot;
    unit.hp = unitMaxHp(doctrine, unit.key);
    unit.duration = unitDuration(doctrine, unit.key);
    unit.lastSlot = option.slot;
    unit.deployments += 1;
    state.tide -= option.cost;
    log.push(
      `【${UNITS[unit.key].title}】入位 ${option.slot}。潮令 -${option.cost}，壳 ${unit.hp}，拦 ${UNITS[unit.key].block}。`,
    );
    events.push({
      type: 'deploy',
      unit: unit.key,
      slot: option.slot,
      cost: option.cost,
      hp: unit.hp,
    });
  } else if (head === 'recall') {
    if (state.phase !== 'setup' && state.phase !== 'battle') {
      throw illegalAction('现在不能撤回单位。');
    }
    const slotKey = parts[1] ?? '';
    const option = recallOptions(state).find((item) => item.slot === slotKey);
    if (!option) {
      throw illegalAction(`没有可撤回的单位在 ${slotKey || '?'}。`);
    }
    const doctrine = doctrineOf(state);
    option.unit.slot = null;
    option.unit.duration = null;
    option.unit.hp = unitMaxHp(doctrine, option.unit.key);
    option.unit.recalls += 1;
    state.tide += option.refund;
    // Setup is a free planning phase; battle recall pays the real cooldown.
    const cooldown = state.phase === 'setup' ? 0 : unitRedeployCooldown(doctrine, option.unit.key);
    option.unit.readyPulse = state.pulse + cooldown;
    log.push(
      state.phase === 'setup'
        ? `【${UNITS[option.unit.key].title}】从 ${slotKey} 退潮再编，返还潮令 ${option.refund}；setup 内可立即重放。`
        : `【${UNITS[option.unit.key].title}】从 ${slotKey} 退潮再编，返还潮令 ${option.refund}，再编冷却 ${cooldown} pulse。`,
    );
    events.push({
      type: 'recall',
      unit: option.unit.key,
      slot: slotKey,
      refund: option.refund,
      cooldown,
    });
  } else if (head === 'skill') {
    if (state.phase !== 'battle') {
      throw illegalAction('潮技只在战斗 pulse 内可用。', '先 act ready 开始敌潮。');
    }
    const doctrine = doctrineOf(state);
    const plan = skillPlan(state);
    if (!plan) {
      throw illegalAction(
        `【${doctrine.skillName}】现在不可用（冷却 ${skillCooldownRemaining(state)} pulse，潮令 ${state.tide}/${doctrine.skillCost}，或没有目标）。`,
      );
    }
    if (plan.doctrine === 'crusher') {
      state.crusherSlot = plan.slot;
      spendSkillCharge(state, doctrine, `${UNITS[plan.unit].title}@${plan.slot}`);
      log.push(
        `你发动了【${doctrine.skillName}】：${UNITS[plan.unit].title}@${plan.slot} 本 pulse 攻 +2、拦口 +1。`,
      );
    } else if (plan.doctrine === 'oracle') {
      state.oracleLane = plan.lane;
      spendSkillCharge(state, doctrine, STAGE.laneTitles[plan.lane]);
      log.push(
        `你发动了【${doctrine.skillName}】：${STAGE.laneTitles[plan.lane]}本 pulse 的敌人更慢、更脆。`,
      );
    } else {
      const unit = rosterBySlot(state, plan.from);
      if (!unit) throw illegalAction('潮技目标已经不在场上。');
      unit.slot = plan.to;
      unit.lastSlot = plan.to;
      unit.hp = Math.min(unitMaxHp(doctrine, unit.key), unit.hp + 2);
      spendSkillCharge(state, doctrine, `${UNITS[plan.unit].title} ${plan.from}→${plan.to}`);
      log.push(
        `你发动了【${doctrine.skillName}】：${UNITS[plan.unit].title} ${plan.from}→${plan.to}，并回 2 点壳。`,
      );
    }
    events.push({ type: 'skill', doctrine: plan.doctrine, plan });
  } else if (head === 'ready') {
    if (state.phase !== 'setup') {
      throw illegalAction('ready 只在 setup 阶段可用。');
    }
    state.phase = 'battle';
    state.pulse = 1;
    log.push(
      `敌潮进场：共 ${state.wavePlan.length} 个 pulse。先手潮令 ${state.tide}，归海线 ${state.integrity}/${state.maxIntegrity}。`,
    );
    events.push({ type: 'ready', waves: state.wavePlan.length });
    state.rng = rng.serialize();
    return { log, events };
  } else if (head === 'hold') {
    if (state.phase !== 'battle') {
      throw illegalAction('hold 只在战斗 pulse 内可用。', 'setup 里用 act ready 开始敌潮。');
    }
    log.push('你选择不干预，直接结算这个 pulse。');
  } else {
    throw illegalAction(`未知动作：${actionId}`, '运行 `actions` 查看当前合法动作。');
  }

  // Setup actions (deploy / recall) happen for free, without advancing a pulse.
  if (state.phase === 'setup') {
    state.rng = rng.serialize();
    return { log, events };
  }

  const resolution = resolvePulse(state);
  log.push(...resolution.log);
  events.push(...resolution.events);

  if (state.integrity <= 0) {
    const lane = state.lastBreakLane ?? STAGE.lanes[1] ?? 'mid';
    const enemy = state.lastBreakEnemy ? ENEMIES[state.lastBreakEnemy].title : '漏怪';
    const cause = `归海线被打穿了。最后压垮你的是 ${STAGE.laneTitles[lane]}的【${enemy}】。`;
    endRun(state, 'lost', cause);
    log.push(cause);
    events.push({ type: 'lost', cause });
  } else if (state.pulse >= state.wavePlan.length && state.enemies.length === 0) {
    const cause = '你把这条归海侧排线守到了最后一 pulse。剩下的龙虾，今晚有路横着回海。';
    endRun(state, 'won', cause);
    log.push(cause);
    events.push({ type: 'won', cause });
  } else {
    state.pulse += 1;
    state.tide += doctrineOf(state).tidePerPulse;
  }

  state.rng = rng.serialize();
  return { log, events };
}

export function abort(state: TowerDefenseState): void {
  if (state.outcome !== 'ongoing') return;
  endRun(
    state,
    'aborted',
    '这轮先在这里收壳：输入停下，但观察已经留下；这是一次中止结算，不算胜利，也不假装你已经守住了。',
  );
}
