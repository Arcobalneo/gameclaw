import { generateSessionId, isSessionId } from '../../../relay/src/ids';

const KEY = 'gameclaw:player';

/** Durable anonymous play-id, independent of the room/session token. */
export function loadOrCreatePlayer(): string {
  try {
    const existing = globalThis.localStorage?.getItem(KEY);
    if (existing && isSessionId(existing)) return existing;
  } catch {
    /* private mode */
  }
  const id = generateSessionId();
  try {
    globalThis.localStorage?.setItem(KEY, id);
  } catch {
    /* quota / private mode */
  }
  return id;
}
