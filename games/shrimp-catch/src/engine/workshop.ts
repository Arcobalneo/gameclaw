/**
 * Affix engine + workshop economy.
 *
 * A creature owns 2-4 affix slots (shiny creatures get one extra). Captures roll
 * every slot; the workshop can reroll (same tier), upgrade (next tier) and seal
 * (lock) a slot. Currency comes from abyss drops.
 */
import type { Rng } from '@gameclaw/gamekit';

import { itemName } from './items';
import { AFFIX_BY_ID, AFFIXES, type Affix, BALANCE, displayName } from './species';
import type { AffixSlot, Creature, TamerState } from './state';

export const TIER_ORDER = ['common', 'blue', 'purple', 'gold'] as const;

export type Tier = (typeof TIER_ORDER)[number];

export const TIER_SYMBOL: Record<string, string> = {
  common: '○',
  blue: '◑',
  purple: '●',
  gold: '✦',
};

export function tierIndex(tier: string): number {
  const index = TIER_ORDER.indexOf(tier as Tier);
  return index >= 0 ? index : 0;
}

function affixPoolForTier(tier: string): Affix[] {
  const pool = AFFIXES.filter((affix) => affix.tier === tier);
  return pool.length > 0 ? pool : AFFIXES;
}

export function rollAffixTier(rng: Rng, shiny: boolean): Tier {
  const weights = BALANCE.affix.roll_weights;
  const bonus = shiny ? BALANCE.affix.shiny_roll_bonus : {};
  const values = TIER_ORDER.map((tier) => Math.max(0, (weights[tier] ?? 0) + (bonus[tier] ?? 0)));
  const total = values.reduce((sum, value) => sum + value, 0);
  let roll = rng.float() * total;
  for (let i = 0; i < TIER_ORDER.length; i += 1) {
    roll -= values[i] ?? 0;
    if (roll <= 0) return TIER_ORDER[i] ?? 'common';
  }
  return 'common';
}

export function rollAffix(rng: Rng, shiny = false): Affix {
  const tier = rollAffixTier(rng, shiny);
  return rng.pick(affixPoolForTier(tier));
}

export function rollAffixSlots(rng: Rng, count: number, shiny: boolean): AffixSlot[] {
  return Array.from({ length: count }, () => ({
    affixId: rollAffix(rng, shiny).id,
    locked: false,
  }));
}

/** Reroll keeps the tier and never returns the exact same affix. */
export function rerollAffixSlot(creature: Creature, slotIndex: number, rng: Rng): Affix {
  const slot = creature.affixSlots[slotIndex];
  if (!slot) throw new Error(`Invalid affix slot: ${slotIndex}`);
  const current = slot.affixId ? AFFIX_BY_ID.get(slot.affixId) : undefined;
  const tier = current?.tier ?? 'common';
  let pool = AFFIXES.filter((affix) => affix.tier === tier && affix.id !== slot.affixId);
  if (pool.length === 0) pool = affixPoolForTier(tier);
  return rng.pick(pool);
}

/** Upgrade moves to the next tier and picks a random affix of that tier. */
export function upgradeAffixSlot(creature: Creature, slotIndex: number, rng: Rng): Affix {
  const slot = creature.affixSlots[slotIndex];
  if (!slot) throw new Error(`Invalid affix slot: ${slotIndex}`);
  const current = slot.affixId ? AFFIX_BY_ID.get(slot.affixId) : undefined;
  if (!current) throw new Error('Cannot upgrade an empty affix slot');
  const index = TIER_ORDER.indexOf(current.tier as Tier);
  if (index < 0 || index >= TIER_ORDER.length - 1) {
    throw new Error('Affix is already at the highest tier');
  }
  const nextTier = TIER_ORDER[index + 1] ?? 'gold';
  return rng.pick(affixPoolForTier(nextTier));
}

export function affixSlotLabel(slot: AffixSlot): string {
  if (!slot.affixId) return '[空槽]';
  const affix = AFFIX_BY_ID.get(slot.affixId);
  if (!affix) return `[未知:${slot.affixId}]`;
  return `${TIER_SYMBOL[affix.tier] ?? '?'}${affix.name}${slot.locked ? ' 🔒' : ''}`;
}

export function affixShortSymbols(creature: Creature): string {
  if (creature.affixSlots.length === 0) return '无';
  return creature.affixSlots
    .map((slot) => {
      const affix = slot.affixId ? AFFIX_BY_ID.get(slot.affixId) : undefined;
      return affix ? (TIER_SYMBOL[affix.tier] ?? '?') : '·';
    })
    .join('');
}

export function costLabel(cost: Record<string, number>): string {
  const parts = Object.entries(cost).map(([id, count]) => `${itemName(id)}×${count}`);
  return parts.length > 0 ? parts.join(' / ') : '免费';
}

export function rerollCost(): Record<string, number> {
  return { ...BALANCE.workshop.reroll_cost };
}

export function upgradeCost(tier: string): Record<string, number> {
  const tiers = BALANCE.workshop.upgrade_cost_by_tier;
  const entry = tiers[Math.min(tierIndex(tier), tiers.length - 1)];
  return { ...(entry ?? {}) };
}

export function sealCost(): Record<string, number> {
  return { ...BALANCE.workshop.seal_cost };
}

export function unsealCost(): Record<string, number> {
  return { ...BALANCE.workshop.unseal_cost };
}

export function canAfford(state: TamerState, cost: Record<string, number>): boolean {
  return Object.entries(cost).every(([id, count]) => (state.items[id] ?? 0) >= count);
}

export function payCost(state: TamerState, cost: Record<string, number>): void {
  for (const [id, count] of Object.entries(cost)) {
    const have = state.items[id] ?? 0;
    const next = have - count;
    if (next <= 0) delete state.items[id];
    else state.items[id] = next;
  }
}

export type WorkshopOp = 'reroll' | 'upgrade' | 'seal' | 'unseal';

export interface WorkshopResult {
  ok: boolean;
  message: string;
}

export function workshopAction(
  state: TamerState,
  rng: Rng,
  op: WorkshopOp,
  slotIndex: number,
): WorkshopResult {
  if (state.selectedCreature === null) {
    return { ok: false, message: '先在工坊里选择一只虾米。' };
  }
  const creature = state.party[state.selectedCreature];
  if (!creature) return { ok: false, message: '工坊目标无效。' };
  const slot = creature.affixSlots[slotIndex];
  if (!slot) return { ok: false, message: `无效的词条槽序号：${slotIndex + 1}` };

  if (op === 'reroll') {
    if (slot.locked) return { ok: false, message: '该词条已封印，先解封才能重投。' };
    if (!slot.affixId) return { ok: false, message: '该词条槽为空，无法重投。' };
    const cost = rerollCost();
    if (!canAfford(state, cost))
      return { ok: false, message: `材料不足：需要 ${costLabel(cost)}。` };
    const next = rerollAffixSlot(creature, slotIndex, rng);
    payCost(state, cost);
    slot.affixId = next.id;
    return {
      ok: true,
      message: `重投成功：${creatureName(creature)} 槽${slotIndex + 1} → ${next.name}（${next.tier}）`,
    };
  }

  if (op === 'upgrade') {
    if (!slot.affixId) return { ok: false, message: '该词条槽为空，无法升阶。' };
    const current = AFFIX_BY_ID.get(slot.affixId);
    if (!current) return { ok: false, message: '找不到该词条数据。' };
    if (tierIndex(current.tier) >= TIER_ORDER.length - 1) {
      return { ok: false, message: '该词条已是最高品阶（gold），无法继续升阶。' };
    }
    const cost = upgradeCost(current.tier);
    if (!canAfford(state, cost))
      return { ok: false, message: `材料不足：需要 ${costLabel(cost)}。` };
    const next = upgradeAffixSlot(creature, slotIndex, rng);
    payCost(state, cost);
    slot.affixId = next.id;
    return {
      ok: true,
      message: `升阶成功：${current.name}（${current.tier}）→ ${next.name}（${next.tier}）`,
    };
  }

  if (op === 'seal') {
    if (slot.locked) return { ok: false, message: '该词条已经封印。' };
    if (!slot.affixId) return { ok: false, message: '空槽无法封印。' };
    const cost = sealCost();
    if (!canAfford(state, cost))
      return { ok: false, message: `材料不足：需要 ${costLabel(cost)}。` };
    payCost(state, cost);
    slot.locked = true;
    return { ok: true, message: '词条已封印，不会被重投覆盖。' };
  }

  if (!slot.locked) return { ok: false, message: '该词条没有被封印。' };
  const cost = unsealCost();
  if (!canAfford(state, cost)) return { ok: false, message: `材料不足：需要 ${costLabel(cost)}。` };
  payCost(state, cost);
  slot.locked = false;
  return { ok: true, message: '封印已解除。' };
}

export function creatureName(creature: Creature): string {
  return displayName(creature);
}
