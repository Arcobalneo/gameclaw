/**
 * Capture model: weaken first, then throw. Rate depends on HP%, status, ball,
 * shiny penalty and difficulty; bait adds a flat bonus but enrages the wild on a
 * failed throw (handled by the action layer).
 */
import type { Rng } from '@gameclaw/gamekit';

import { captureInventory, consumeItem, itemName, itemOf } from './items';
import { BALANCE, displayName, speciesOf } from './species';
import type { Creature, TamerState } from './state';
import { addUnique, maxHp, nextUid, note, timeline } from './state';
import { rollAffixSlots } from './workshop';

export interface CaptureResult {
  success: boolean;
  rate: number;
}

/** Bait is a flat additive bonus; it can only be used once per encounter. */
export const BAIT_BONUS = 0.2;

export function captureChance(state: TamerState, wild: Creature, itemId: string): number {
  const species = speciesOf(wild.speciesId);
  const item = itemOf(itemId);
  const itemMultiplier =
    item?.type === 'capture'
      ? (item.multiplier ?? BALANCE.capture.tool_multipliers[item.name] ?? 1)
      : 1;

  const ratio = wild.hp / maxHp(wild);
  const hpFactor =
    ratio < 0.3 ? BALANCE.capture.weakened_bonus : ratio < 0.6 ? BALANCE.capture.half_hp_bonus : 1;

  const status =
    state.battle && state.battle.mode === 'wild' && state.battle.enemy.uid === wild.uid
      ? state.battle.enemySide.status
      : null;
  let statusBonus = 1;
  if (status === '中毒' || status === '灼烧') {
    statusBonus = BALANCE.capture.status_poison_burn_bonus;
  } else if (status === '麻痹' || status === '冰封' || status === '困惑') {
    statusBonus = BALANCE.capture.status_para_freeze_bonus;
  }

  const shinyPenalty = wild.shiny ? BALANCE.capture.shiny_capture_penalty : 1;
  const difficultyBonus =
    state.difficulty === 'easy' ? 0.05 : state.difficulty === 'hard' ? -0.05 : 0;
  const bait = state.catchBait ? BAIT_BONUS : 0;
  const rate =
    species.capture_base_rate * itemMultiplier * hpFactor * statusBonus * shinyPenalty +
    bait +
    difficultyBonus;
  return Math.max(0.02, Math.min(0.95, rate));
}

export interface CapturePreview {
  itemId: string;
  name: string;
  count: number;
  rate: number;
}

export function capturePreview(state: TamerState, wild: Creature): CapturePreview[] {
  return captureInventory(state).map((item) => ({
    itemId: item.id,
    name: item.name,
    count: state.items[item.id] ?? 0,
    rate: captureChance(state, wild, item.id),
  }));
}

/**
 * Consume one ball and roll capture. On success the wild creature joins the
 * party or box; the caller decides what phase to move to.
 */
export function attemptCapture(state: TamerState, rng: Rng, itemId: string): CaptureResult {
  const wild = state.wild;
  if (!wild) throw new Error('No wild creature to capture');
  if (!consumeItem(state, itemId, 1)) {
    throw new Error(`No ${itemName(itemId)} left`);
  }
  const rate = captureChance(state, wild, itemId);
  const success = rng.chance(rate);
  if (success) captureCreature(state, wild, rng);
  return { success, rate };
}

export function captureCreature(state: TamerState, wild: Creature, rng: Rng): Creature {
  const slotCount = speciesOf(wild.speciesId).affix_slots + (wild.shiny ? 1 : 0);
  const captured: Creature = {
    ...wild,
    uid: nextUid(state),
    nickname: null,
    hp: Math.max(1, wild.hp),
    affixSlots: rollAffixSlots(rng, slotCount, wild.shiny),
    capturedZone: state.explore?.zoneId ?? state.currentZone,
    dead: false,
  };
  addUnique(state.dexSeen, captured.speciesId);
  addUnique(state.dexCaught, captured.speciesId);
  if (captured.shiny) addUnique(state.shinyCaught, captured.speciesId);
  state.totalCaptures += 1;

  const emptySlot = state.party.indexOf(null);
  if (emptySlot >= 0) state.party[emptySlot] = captured;
  else state.box.push(captured);

  const species = speciesOf(captured.speciesId);
  note(
    state,
    `观察：${species.name} 在 ${Math.round((captured.hp / maxHp(captured)) * 100)}% HP 时被捕获，词条槽 ${slotCount} 个。`,
  );
  timeline(state, `捕获 ${species.name} Lv${captured.level}`);
  return captured;
}

export function markSeen(state: TamerState, speciesId: string): void {
  addUnique(state.dexSeen, speciesId);
}

export function captureRatePercent(state: TamerState, wild: Creature, itemId: string): number {
  return Math.round(captureChance(state, wild, itemId) * 1000) / 10;
}

export function capturedName(creature: Creature): string {
  return displayName(creature);
}
