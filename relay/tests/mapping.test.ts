import { describe, expect, it } from 'vitest';
import { generateSessionId } from '../src/ids';
import { assignCode, MemoryStore, resolveCode } from '../src/registry';

describe('code registry', () => {
  it('assigns a stable code per session and resolves it back', async () => {
    const store = new MemoryStore();
    const session = generateSessionId();
    const code = await assignCode(store, session);
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}$/);
    expect(await assignCode(store, session)).toBe(code);
    expect(await resolveCode(store, code)).toBe(session);
    expect(await resolveCode(store, code.toLowerCase())).toBe(session);
    expect(await resolveCode(store, `${code.slice(0, 3)}-${code.slice(3)}`)).toBe(session);
  });

  it('does not leak one session into another', async () => {
    const store = new MemoryStore();
    const a = generateSessionId();
    const b = generateSessionId();
    const codeA = await assignCode(store, a);
    const codeB = await assignCode(store, b);
    expect(codeA).not.toBe(codeB);
    expect(await resolveCode(store, codeA)).toBe(a);
    expect(await resolveCode(store, codeB)).toBe(b);
    expect(await resolveCode(store, 'ZZZZZZZ')).toBeUndefined();
    expect(await resolveCode(store, 'nope')).toBeUndefined();
  });

  it('rejects a malformed session id', async () => {
    await expect(assignCode(new MemoryStore(), 'short')).rejects.toThrow(/invalid/);
  });
});
