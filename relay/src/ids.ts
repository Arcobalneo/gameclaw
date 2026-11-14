/**
 * Session identifiers: a high-entropy secret and a short, typable room code.
 * The secret is the MCP bearer token; the room code is only a lookup handle.
 */

export const SESSION_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
export const SESSION_LENGTH = 22;

/** No 0/O, 1/I/L — easier to read out and type. */
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 7;

const SESSION_RE = /^[A-Za-z0-9_-]{22}$/;
const CODE_RE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}$/;

export type Bytes = (n: number) => Uint8Array;

export function defaultRandom(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

function randomString(alphabet: string, length: number, random: Bytes): string {
  const out: string[] = [];
  const max = 256 - (256 % alphabet.length);
  while (out.length < length) {
    const buf = random(Math.max(24, (length - out.length) * 2));
    for (const byte of buf) {
      if (byte >= max) continue;
      out.push(alphabet[byte % alphabet.length]!);
      if (out.length === length) break;
    }
  }
  return out.join('');
}

export function generateSessionId(random: Bytes = defaultRandom): string {
  return randomString(SESSION_ALPHABET, SESSION_LENGTH, random);
}

export function generateRoomCode(random: Bytes = defaultRandom): string {
  return randomString(CODE_ALPHABET, CODE_LENGTH, random);
}

export function isSessionId(value: string): boolean {
  return SESSION_RE.test(value);
}

export function normalizeRoomCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[-_\s]/g, '');
}

export function isRoomCode(value: string): boolean {
  return CODE_RE.test(normalizeRoomCode(value));
}
