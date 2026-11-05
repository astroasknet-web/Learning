/** Seeded random numbers. The same seed always gives the same sequence, so a question is just (skill, difficulty, seed). */
export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [lo, hi] (inclusive). */
  int(lo: number, hi: number): number;
  /** One element of a non-empty array. */
  pick<T>(xs: readonly T[]): T;
  /** True with probability p. */
  chance(p: number): boolean;
  /** A shuffled copy. */
  shuffle<T>(xs: readonly T[]): T[];
}

/** mulberry32: small, fast, good enough for question selection (not for anything secret). */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next(); // the first output of a small seed is correlated with the seed; discard it
  const int = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1));
  return {
    next,
    int,
    pick: (xs) => xs[int(0, xs.length - 1)],
    chance: (p) => next() < p,
    shuffle: (xs) => {
      const out = [...xs];
      for (let i = out.length - 1; i > 0; i--) { const j = int(0, i); [out[i], out[j]] = [out[j], out[i]]; }
      return out;
    },
  };
}

/** Mix a few integers into one 32-bit seed (FNV-1a over the numbers). */
export function mixSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    let x = p >>> 0;
    for (let i = 0; i < 4; i++) { h ^= x & 0xff; h = Math.imul(h, 0x01000193) >>> 0; x >>>= 8; }
  }
  return h >>> 0;
}

/** A stable 32-bit hash of a string (used to turn a skill id into a seed component). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** Integer between lo and hi scaled by difficulty d (1..10): d=1 gives lo, d=10 gives hi. */
export const scale = (d: number, lo: number, hi: number): number => Math.round(lo + ((Math.min(10, Math.max(1, d)) - 1) / 9) * (hi - lo));

/** A random integer with exactly `n` digits (no leading zero; one digit means 0..9). */
export const digits = (r: Rng, n: number): number => r.int(n === 1 ? 0 : 10 ** (n - 1), 10 ** n - 1);
