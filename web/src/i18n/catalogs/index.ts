import { canonicalGameId } from '../../../../relay/src/games';
import claw_beat from './claw-beat.json';
import claw_burger from './claw-burger.json';
import claw_catch from './claw-catch.json';
import claw_clock from './claw-clock.json';
import claw_conquest from './claw-conquest.json';
import claw_count from './claw-count.json';
import claw_flip from './claw-flip.json';
import claw_greens from './claw-greens.json';
import claw_guard from './claw-guard.json';
import claw_heist from './claw-heist.json';
import claw_ink from './claw-ink.json';
import claw_leap from './claw-leap.json';
import claw_look from './claw-look.json';
import claw_mask from './claw-mask.json';
import claw_melt from './claw-melt.json';
import claw_net from './claw-net.json';
import claw_rampage from './claw-rampage.json';
import claw_stamp from './claw-stamp.json';
import claw_trek from './claw-trek.json';
import type { GameCatalog } from './types';

export type { GameCatalog, Pattern } from './types';

const EMPTY: GameCatalog = { terms: {}, exact: {}, patterns: [] };

const registry = new Map<string, GameCatalog>();

export function registerCatalog(id: string, catalog: GameCatalog): void {
  registry.set(id, catalog);
}

export function getCatalog(gameId: string): GameCatalog {
  return registry.get(canonicalGameId(gameId)) ?? EMPTY;
}

export function allCatalogs(): ReadonlyMap<string, GameCatalog> {
  return registry;
}

registerCatalog('claw-beat', claw_beat as GameCatalog);
registerCatalog('claw-burger', claw_burger as GameCatalog);
registerCatalog('claw-catch', claw_catch as GameCatalog);
registerCatalog('claw-clock', claw_clock as GameCatalog);
registerCatalog('claw-conquest', claw_conquest as GameCatalog);
registerCatalog('claw-count', claw_count as GameCatalog);
registerCatalog('claw-flip', claw_flip as GameCatalog);
registerCatalog('claw-greens', claw_greens as GameCatalog);
registerCatalog('claw-guard', claw_guard as GameCatalog);
registerCatalog('claw-heist', claw_heist as GameCatalog);
registerCatalog('claw-ink', claw_ink as GameCatalog);
registerCatalog('claw-leap', claw_leap as GameCatalog);
registerCatalog('claw-look', claw_look as GameCatalog);
registerCatalog('claw-mask', claw_mask as GameCatalog);
registerCatalog('claw-melt', claw_melt as GameCatalog);
registerCatalog('claw-net', claw_net as GameCatalog);
registerCatalog('claw-rampage', claw_rampage as GameCatalog);
registerCatalog('claw-stamp', claw_stamp as GameCatalog);
registerCatalog('claw-trek', claw_trek as GameCatalog);
