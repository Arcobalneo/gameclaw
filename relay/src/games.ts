/** Canonical web game ids. Used to validate play-count reports. */
export const GAME_IDS = [
  'shrimp-trek',
  'shrimp-guard',
  'shrimp-heist',
  'shrimp-catch',
  'shrimp-look',
  'shrimp-rampage',
  'shrimp-ink',
  'shrimp-greens',
  'shrimp-conquest',
  'shrimp-leap',
  'shrimp-burger',
  'claw-stamp',
  'claw-melt',
  'claw-net',
  'claw-beat',
] as const;

export type GameId = (typeof GAME_IDS)[number];

export function isGameId(value: string): value is GameId {
  return (GAME_IDS as readonly string[]).includes(value);
}
