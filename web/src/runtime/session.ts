import {
  generateSessionId,
  isRoomCode,
  isSessionId,
  normalizeRoomCode,
} from '../../../relay/src/ids';

const ID_KEY = 'gameclaw:session:id';
const CODE_KEY = 'gameclaw:session:code';

export interface LocalSession {
  id: string;
  code: string | null;
}

const listeners = new Set<(session: LocalSession) => void>();

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

function emit(session: LocalSession): void {
  for (const fn of listeners) fn(session);
}

export function loadOrCreateSession(): LocalSession {
  let id = read(ID_KEY);
  if (!id || !isSessionId(id)) {
    id = generateSessionId();
    write(ID_KEY, id);
    write(CODE_KEY, '');
  }
  const raw = read(CODE_KEY);
  const code = raw && isRoomCode(raw) ? normalizeRoomCode(raw) : null;
  return { id, code };
}

export function rememberCode(code: string): LocalSession {
  const session = loadOrCreateSession();
  const normalized = normalizeRoomCode(code);
  if (!isRoomCode(normalized)) return session;
  write(CODE_KEY, normalized);
  const next = { id: session.id, code: normalized };
  emit(next);
  return next;
}

export function adoptSession(id: string, code: string | null): LocalSession {
  if (!isSessionId(id)) throw new Error('invalid session id');
  write(ID_KEY, id);
  const normalized = code && isRoomCode(code) ? normalizeRoomCode(code) : null;
  write(CODE_KEY, normalized ?? '');
  const next = { id, code: normalized };
  emit(next);
  return next;
}

export function onSession(fn: (session: LocalSession) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export { isRoomCode, isSessionId, normalizeRoomCode };
