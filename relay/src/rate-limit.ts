/** Best-effort token bucket. Per isolate / process — enough to blunt guessing. */

export class TokenBucket {
  readonly #capacity: number;
  readonly #refillPerSec: number;
  readonly #buckets = new Map<string, { tokens: number; at: number }>();

  constructor(capacity: number, refillPerSec: number) {
    this.#capacity = capacity;
    this.#refillPerSec = refillPerSec;
  }

  take(key: string, n = 1): boolean {
    const now = Date.now();
    let bucket = this.#buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.#capacity, at: now };
      this.#buckets.set(key, bucket);
    } else {
      const elapsed = (now - bucket.at) / 1000;
      bucket.tokens = Math.min(this.#capacity, bucket.tokens + elapsed * this.#refillPerSec);
      bucket.at = now;
    }
    if (bucket.tokens < n) return false;
    bucket.tokens -= n;
    if (this.#buckets.size > 4000) this.#prune(now);
    return true;
  }

  #prune(now: number): void {
    for (const [key, bucket] of this.#buckets) {
      if (now - bucket.at > 10 * 60_000) this.#buckets.delete(key);
    }
  }
}

export const codeLookupLimit = new TokenBucket(10, 10 / 60);
export const mcpLimit = new TokenBucket(40, 2);
