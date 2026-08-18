/**
 * Deterministic RNG and math helpers.
 *
 * Everything in the engine derives randomness from mulberry32 seeded
 * either by the league seed or a stable hash, so a league can be
 * replayed bit-for-bit from (seed, action log) on any machine.
 */

export type Rng = () => number;

export function mulberry32(a: number): Rng {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

export const R = (rng: Rng, a: number, b: number): number => a + rng() * (b - a);

export const RI = (rng: Rng, a: number, b: number): number => Math.floor(a + rng() * (b - a + 1));

export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

export function gauss(rng: Rng, mean: number, sd: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** FNV-1a string hash, used to derive per-entity deterministic seeds. */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
