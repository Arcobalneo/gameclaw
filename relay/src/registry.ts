import { generateRoomCode, isRoomCode, isSessionId, normalizeRoomCode } from './ids';

export interface CodeStore {
  getSession(code: string): Promise<string | undefined>;
  getCode(sessionId: string): Promise<string | undefined>;
  bind(code: string, sessionId: string): Promise<void>;
}

/** In-memory short-code index, used by the Bun server and unit tests. */
export class MemoryStore implements CodeStore {
  readonly #byCode = new Map<string, string>();
  readonly #bySession = new Map<string, string>();

  async getSession(code: string): Promise<string | undefined> {
    return this.#byCode.get(normalizeRoomCode(code));
  }

  async getCode(sessionId: string): Promise<string | undefined> {
    return this.#bySession.get(sessionId);
  }

  async bind(code: string, sessionId: string): Promise<void> {
    const normalized = normalizeRoomCode(code);
    this.#byCode.set(normalized, sessionId);
    this.#bySession.set(sessionId, normalized);
  }
}

export async function assignCode(store: CodeStore, sessionId: string): Promise<string> {
  if (!isSessionId(sessionId)) throw new Error('invalid session id');
  const existing = await store.getCode(sessionId);
  if (existing) return existing;
  for (let i = 0; i < 16; i += 1) {
    const code = generateRoomCode();
    if (await store.getSession(code)) continue;
    await store.bind(code, sessionId);
    return code;
  }
  throw new Error('could not allocate a room code');
}

export async function resolveCode(store: CodeStore, code: string): Promise<string | undefined> {
  if (!isRoomCode(code)) return undefined;
  const session = await store.getSession(code);
  return session && isSessionId(session) ? session : undefined;
}
