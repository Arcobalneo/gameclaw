/**
 * Deterministic PRNG (sfc32) with a serialisable 4x uint32 state.
 *
 * Every game stores `rng` in its save file and restores it before resolving an
 * action, so a fixed seed + fixed action sequence always produces the same run.
 */

export type RngState = [number, number, number, number];

function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

export class Rng {
  #a: number;
  #b: number;
  #c: number;
  #d: number;

  private constructor(state: RngState, warmup: boolean) {
    this.#a = state[0] | 0;
    this.#b = state[1] | 0;
    this.#c = state[2] | 0;
    this.#d = state[3] | 0;
    // sfc32 needs a warm-up before its output is well mixed. Restored states are
    // already warm, so they must not be advanced or replays would diverge.
    if (warmup) for (let i = 0; i < 12; i += 1) this.nextUint32();
  }

  static fromSeed(seed: number): Rng {
    const mix = splitmix32(seed);
    return new Rng([mix(), mix(), mix(), mix()], true);
  }

  static restore(state: readonly number[]): Rng {
    if (state.length !== 4 || state.some((value) => !Number.isFinite(value))) {
      throw new Error('Invalid RNG state: expected four finite numbers');
    }
    return new Rng([state[0]! >>> 0, state[1]! >>> 0, state[2]! >>> 0, state[3]! >>> 0], false);
  }

  serialize(): RngState {
    return [this.#a >>> 0, this.#b >>> 0, this.#c >>> 0, this.#d >>> 0];
  }

  nextUint32(): number {
    const t = (((this.#a + this.#b) | 0) + this.#d) | 0;
    this.#d = (this.#d + 1) | 0;
    this.#a = this.#b ^ (this.#b >>> 9);
    this.#b = (this.#c + (this.#c << 3)) | 0;
    this.#c = (this.#c << 21) | (this.#c >>> 11);
    this.#c = (this.#c + t) | 0;
    return t >>> 0;
  }

  /** Uniform float in [0, 1). */
  float(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  /** Uniform integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`Invalid range: ${min}..${max}`);
    return min + Math.floor(this.float() * (max - min + 1));
  }

  chance(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.float() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from an empty array');
    return items[Math.floor(this.float() * items.length)]!;
  }

  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const result: T[] = [];
    const take = Math.min(count, pool.length);
    for (let i = 0; i < take; i += 1) {
      const index = Math.floor(this.float() * pool.length);
      result.push(pool.splice(index, 1)[0]!);
    }
    return result;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.float() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }
}
