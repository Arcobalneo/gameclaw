import legacyIds from '../../catalog/legacy-ids.json';

/** Canonical web game ids. Used to validate play-count reports. */
export const GAME_IDS = [
  'claw-trek',
  'claw-guard',
  'claw-heist',
  'claw-catch',
  'claw-look',
  'claw-rampage',
  'claw-ink',
  'claw-greens',
  'claw-conquest',
  'claw-leap',
  'claw-burger',
  'claw-stamp',
  'claw-melt',
  'claw-net',
  'claw-beat',
  'claw-count',
  'claw-mask',
  'claw-clock',
  'claw-flip',
  'claw-round',
  'claw-coil',
  'claw-sum',
  'claw-berth',
] as const;

export type GameId = (typeof GAME_IDS)[number];

/**
 * Former `shrimp-*` ids. The live map is `catalog/legacy-ids.json`.
 * Callers accept an old id and store or return the current one.
 */
const LEGACY_TO_CURRENT = legacyIds as Readonly<Record<string, string>>;

export const LEGACY_GAME_IDS: readonly string[] = Object.keys(LEGACY_TO_CURRENT);

export function isGameId(value: string): value is GameId {
  return (GAME_IDS as readonly string[]).includes(value);
}

/** Current id for a legacy id; any other string is returned unchanged. */
export function canonicalGameId(value: string): string {
  return LEGACY_TO_CURRENT[value] ?? value;
}

/** The single former id for a current id, when this rename created one. */
export function legacyGameId(current: string): string | undefined {
  for (const [oldId, next] of Object.entries(LEGACY_TO_CURRENT)) {
    if (next === current) return oldId;
  }
  return undefined;
}

/** Current id when `value` is a shipped game or its legacy alias. */
export function resolveGameId(value: string): GameId | null {
  const id = canonicalGameId(value);
  return isGameId(id) ? id : null;
}

/**
 * Copy a saved snapshot onto the current id when it was stored under the
 * legacy id. `MemorySession.restore` requires `snapshot.game` to match.
 */
export function retagSnapshot<T>(raw: T, currentId: string): T {
  if (!raw || typeof raw !== 'object') return raw;
  const snap = raw as { game?: unknown };
  if (typeof snap.game !== 'string' || snap.game === currentId) return raw;
  if (canonicalGameId(snap.game) !== currentId) return raw;
  return { ...snap, game: currentId } as T;
}
