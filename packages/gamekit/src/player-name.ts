/**
 * Display names for the public leaderboard.
 *
 * The only identity stored is this string. Latin case folds into one row;
 * the board shows the casing from the submit that set the best score.
 */

export const PLAYER_NAME_MAX = 16;

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._\-·]*$/u;

/** Returns the stored display form, or null when the name is not acceptable. */
export function normalizePlayerName(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const collapsed = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  const chars = [...collapsed];
  if (chars.length < 1 || chars.length > PLAYER_NAME_MAX) return null;
  if (chars.some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127)) return null;
  if (/https?:|www\.|@/i.test(collapsed)) return null;
  if (!NAME_RE.test(collapsed)) return null;
  return collapsed;
}

/** Identity key. Latin letters fold; everything else is unchanged. */
export function playerNameKey(name: string): string {
  return name.toLocaleLowerCase('en-US');
}
