/**
 * Deterministic, dependency-free pseudo random number generator.
 *
 * Every random choice in MathRacing (question values, distractor order, topic rotation) goes through
 * an injected `Rng`, so a session seed reproduces exactly the same content for identical configuration.
 */
export interface Rng {
  /** The seed string this generator was created from (useful for logging/reproduction). */
  readonly seed: string;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** Uniformly pick one element. Throws on an empty list. */
  pick<T>(items: readonly T[]): T;
  /** Fisher-Yates shuffle returning a new array. */
  shuffle<T>(items: readonly T[]): T[];
  /** True with probability p (0..1). */
  chance(p: number): boolean;
  /**
   * Derive an independent generator from this seed and a label. The derived stream depends only on
   * (seed, label), never on how many numbers were already drawn, which keeps per-player streams stable.
   */
  fork(label: string): Rng;
}

/** xmur3 string hash: turns any string into a well-mixed 32-bit seed generator. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** mulberry32: small, fast, good-quality 32-bit generator. */
function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededRng implements Rng {
  readonly seed: string;
  private readonly gen: () => number;

  constructor(seed: string) {
    this.seed = seed;
    this.gen = mulberry32(xmur3(seed)());
  }

  next(): number {
    return this.gen();
  }

  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new RangeError(`SeededRng.int requires integers, got ${min}..${max}`);
    }
    if (min > max) {
      throw new RangeError(`SeededRng.int requires min <= max, got ${min}..${max}`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError('SeededRng.pick called with an empty list');
    }
    return items[this.int(0, items.length - 1)] as T;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  fork(label: string): Rng {
    return new SeededRng(`${this.seed}/${label}`);
  }
}

/** Create a fresh, non-reproducible seed string for a new session (teacher can override it). */
export function createSessionSeed(): string {
  const bytes = new Uint32Array(2);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    bytes[0] = Math.floor(Math.random() * 0xffffffff);
    bytes[1] = Math.floor(Math.random() * 0xffffffff);
  }
  return Array.from(bytes, (n) => n.toString(36))
    .join('')
    .slice(0, 8)
    .toUpperCase();
}
