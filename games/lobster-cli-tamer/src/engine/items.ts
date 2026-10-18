/**
 * Item catalogue, material currency and drop tables.
 *
 * `data/items.json` only ships nets, potions and the plague cure. The workshop
 * currency (甲核 / 灵晶 / 潮石 / 深渊灵晶) lives only in `balance.json` and
 * `tower_config.json` drop names, so this module adds those four materials as
 * first-class items instead of letting the drops silently vanish.
 */
import type { Rng } from '@gameclaw/gamekit';

import { BALANCE, ITEM_LIST, type Item, TOWER } from './species';
import type { TamerState } from './state';

export const MATERIAL_IDS = ['jihe_core', 'spirit_crystal', 'tide_stone', 'abyss_crystal'] as const;

const MATERIAL_ITEMS: Item[] = [
  { id: 'jihe_core', name: '甲核', type: 'material', description: '词条重投货币' },
  { id: 'spirit_crystal', name: '灵晶', type: 'material', description: '词条升阶货币' },
  { id: 'tide_stone', name: '潮石', type: 'material', description: '词条封印 / 解封货币' },
  { id: 'abyss_crystal', name: '深渊灵晶', type: 'material', description: '深层深渊稀有货币' },
];

export const ITEMS: ReadonlyMap<string, Item> = new Map(
  [...ITEM_LIST, ...MATERIAL_ITEMS].map((item) => [item.id, item]),
);

/** Drop tables in the data use Chinese names; map them back to stable ids. */
const DROP_ID_BY_NAME: Record<string, string> = {
  甲核: 'jihe_core',
  灵晶: 'spirit_crystal',
  潮石: 'tide_stone',
  深渊灵晶: 'abyss_crystal',
  净疫盐: 'cure_plague',
  甲网: 'net_basic',
  精甲网: 'net_fine',
  灵甲网: 'net_spirit',
  灵光球: 'shiny_trap',
};

export interface Drop {
  id: string;
  name: string;
  count: number;
  guaranteed?: boolean;
}

export function itemOf(itemId: string): Item | null {
  return ITEMS.get(itemId) ?? null;
}

export function itemName(itemId: string): string {
  return ITEMS.get(itemId)?.name ?? itemId.replaceAll('_', ' ');
}

export function itemCount(state: TamerState, itemId: string): number {
  return state.items[itemId] ?? 0;
}

export function addItem(state: TamerState, itemId: string, count = 1): void {
  if (count <= 0) return;
  state.items[itemId] = itemCount(state, itemId) + count;
}

export function consumeItem(state: TamerState, itemId: string, count = 1): boolean {
  const have = itemCount(state, itemId);
  if (have < count) return false;
  if (have === count) delete state.items[itemId];
  else state.items[itemId] = have - count;
  return true;
}

export function isCaptureTool(itemId: string | undefined): boolean {
  if (!itemId) return false;
  return itemId.startsWith('net_') || itemId === 'shiny_trap';
}

/** Capture items currently owned, strongest first. */
export function captureInventory(state: TamerState): Item[] {
  return [...ITEMS.values()]
    .filter((item) => item.type === 'capture' && itemCount(state, item.id) > 0)
    .sort((a, b) => (b.multiplier ?? 1) - (a.multiplier ?? 1));
}

/** The ball `catch:ball` throws: strongest owned, shiny trap included. */
export function bestCaptureItem(state: TamerState): Item | null {
  return captureInventory(state)[0] ?? null;
}

export function potionInventory(state: TamerState): Item[] {
  return [...ITEMS.values()].filter(
    (item) => item.type === 'heal' && itemCount(state, item.id) > 0,
  );
}

function captureToolForPity(state: TamerState, droppedItemId: string | undefined): Drop | null {
  if (isCaptureTool(droppedItemId)) {
    state.pity = 0;
    return null;
  }
  if (state.pity >= 2) {
    state.pity = 0;
    return { id: 'net_basic', name: itemName('net_basic'), count: 1, guaranteed: true };
  }
  state.pity += 1;
  return null;
}

/** Python's battle loot: pick the highest-count candidate, then force a net on pity. */
export function rollBattleLoot(state: TamerState, rng: Rng): Drop | null {
  const candidates: Drop[] = [];
  for (const [itemId, cfg] of Object.entries(BALANCE.world.battle_loot)) {
    if (!rng.chance(cfg.chance)) continue;
    const [min, max] = cfg.count;
    const count = rng.int(min, max);
    if (count <= 0) continue;
    candidates.push({ id: itemId, name: itemName(itemId), count });
  }
  candidates.sort((a, b) => b.count - a.count || b.id.localeCompare(a.id));
  const chosen = candidates[0] ?? null;
  const guaranteed = captureToolForPity(state, chosen?.id);
  return guaranteed ?? chosen;
}

function candidatesFor(rng: Rng, drops: Record<string, [number, number]>): Drop[] {
  const candidates: Drop[] = [];
  for (const [name, range] of Object.entries(drops)) {
    const itemId = DROP_ID_BY_NAME[name] ?? name;
    const count = rng.int(range[0], range[1]);
    if (count <= 0) continue;
    candidates.push({ id: itemId, name: itemName(itemId), count });
  }
  if (candidates.length > 0) return candidates;
  // Fallback: the fixed floor drop list.
  for (const drop of TOWER.floor_drops) {
    if (rng.chance(drop.chance)) {
      return [{ id: drop.item_id, name: itemName(drop.item_id), count: drop.count }];
    }
  }
  return [];
}

export function rollAbyssDrop(state: TamerState, rng: Rng, floorKind: string): Drop | null {
  const table = TOWER.drops[floorKind] ?? {};
  const candidates = candidatesFor(rng, table);
  const chosen = candidates.length > 0 ? rng.pick(candidates) : null;
  const guaranteed = captureToolForPity(state, chosen?.id);
  return guaranteed ?? chosen;
}

export function materialRows(state: TamerState): { id: string; name: string; count: number }[] {
  return [...MATERIAL_IDS, 'cure_plague'].map((id) => ({
    id,
    name: itemName(id),
    count: itemCount(state, id),
  }));
}
