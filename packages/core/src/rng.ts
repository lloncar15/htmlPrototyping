// Seeded, serializable PRNG (sfc32, seeded via splitmix32).
// State is plain JSON so it can live inside sim state and be hashed,
// saved, and restored. Functions mutate the RngState they are given:
// only call them on a state you own (applyAction clones first).

export type RngState = { a: number; b: number; c: number; d: number };

const UINT32_RANGE = 0x1_0000_0000;
const WARMUP_ROUNDS = 12;

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

/** Create an RNG from a uint32 seed. Record the seed of every run. */
export function createRng(seed: number): RngState {
  if (!Number.isInteger(seed) || seed < 0 || seed >= UINT32_RANGE) {
    throw new Error(`Seed must be an integer in [0, 2^32), got ${seed}`);
  }
  const next = splitmix32(seed);
  const rng = { a: next(), b: next(), c: next(), d: next() };
  for (let i = 0; i < WARMUP_ROUNDS; i++) nextU32(rng);
  return rng;
}

/** Next uint32. Mutates rng. */
export function nextU32(rng: RngState): number {
  const { a, b, c } = rng;
  const d = (rng.d + 1) >>> 0;
  const t = (a + b + d) >>> 0;
  rng.a = (b ^ (b >>> 9)) >>> 0;
  rng.b = (c + (c << 3)) >>> 0;
  rng.c = ((((c << 21) | (c >>> 11)) >>> 0) + t) >>> 0;
  rng.d = d;
  return t;
}

/** Float in [0, 1). Mutates rng. */
export function nextFloat(rng: RngState): number {
  return nextU32(rng) / UINT32_RANGE;
}

/** Integer in [min, max], both inclusive. Mutates rng. */
export function nextInt(rng: RngState, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error(`nextInt needs integers with min <= max, got ${min}..${max}`);
  }
  return min + Math.floor(nextFloat(rng) * (max - min + 1));
}

/** Uniformly pick one item. Mutates rng. */
export function pick<T>(rng: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick from empty array");
  return items[nextInt(rng, 0, items.length - 1)] as T;
}

/** Shuffled copy (Fisher-Yates). Does not mutate items; mutates rng. */
export function shuffle<T>(rng: RngState, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, 0, i);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
