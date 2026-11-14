import claw_beat from './claw-beat.json';
import claw_melt from './claw-melt.json';
import claw_net from './claw-net.json';
import claw_stamp from './claw-stamp.json';
import shrimp_burger from './shrimp-burger.json';
import shrimp_catch from './shrimp-catch.json';
import shrimp_conquest from './shrimp-conquest.json';
import shrimp_greens from './shrimp-greens.json';
import shrimp_guard from './shrimp-guard.json';
import shrimp_heist from './shrimp-heist.json';
import shrimp_ink from './shrimp-ink.json';
import shrimp_leap from './shrimp-leap.json';
import shrimp_look from './shrimp-look.json';
import shrimp_rampage from './shrimp-rampage.json';
import shrimp_trek from './shrimp-trek.json';
import type { GameCatalog } from './types';

export type { GameCatalog, Pattern } from './types';

const EMPTY: GameCatalog = { terms: {}, exact: {}, patterns: [] };

const registry = new Map<string, GameCatalog>();

export function registerCatalog(id: string, catalog: GameCatalog): void {
  registry.set(id, catalog);
}

export function getCatalog(gameId: string): GameCatalog {
  return registry.get(gameId) ?? EMPTY;
}

export function allCatalogs(): ReadonlyMap<string, GameCatalog> {
  return registry;
}

registerCatalog('claw-beat', claw_beat as GameCatalog);
registerCatalog('claw-melt', claw_melt as GameCatalog);
registerCatalog('claw-net', claw_net as GameCatalog);
registerCatalog('claw-stamp', claw_stamp as GameCatalog);
registerCatalog('shrimp-burger', shrimp_burger as GameCatalog);
registerCatalog('shrimp-catch', shrimp_catch as GameCatalog);
registerCatalog('shrimp-conquest', shrimp_conquest as GameCatalog);
registerCatalog('shrimp-greens', shrimp_greens as GameCatalog);
registerCatalog('shrimp-guard', shrimp_guard as GameCatalog);
registerCatalog('shrimp-heist', shrimp_heist as GameCatalog);
registerCatalog('shrimp-ink', shrimp_ink as GameCatalog);
registerCatalog('shrimp-leap', shrimp_leap as GameCatalog);
registerCatalog('shrimp-look', shrimp_look as GameCatalog);
registerCatalog('shrimp-rampage', shrimp_rampage as GameCatalog);
registerCatalog('shrimp-trek', shrimp_trek as GameCatalog);
