import { describe, expect, it } from "vitest";
import { createRng, nextFloat, nextInt, nextU32, pick, shuffle } from "./rng";

const draw = (seed: number, n: number) => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => nextU32(rng));
};

describe("rng", () => {
  it("same seed -> same sequence", () => {
    expect(draw(918273645, 100)).toEqual(draw(918273645, 100));
  });

  it("different seeds -> different sequences", () => {
    expect(draw(1, 10)).not.toEqual(draw(2, 10));
  });

  it("matches the golden sequence (algorithm must not change silently)", () => {
    expect(draw(42, 5)).toEqual([2784860155, 1560037678, 3290702580, 4065216088, 3716837297]);
  });

  it("serializes: a JSON round-trip mid-stream continues identically", () => {
    const rng = createRng(7);
    for (let i = 0; i < 10; i++) nextU32(rng);
    const restored = JSON.parse(JSON.stringify(rng));
    const a = Array.from({ length: 20 }, () => nextU32(rng));
    const b = Array.from({ length: 20 }, () => nextU32(restored));
    expect(a).toEqual(b);
  });

  it("rejects seeds that are not uint32", () => {
    expect(() => createRng(-1)).toThrow();
    expect(() => createRng(1.5)).toThrow();
    expect(() => createRng(2 ** 32)).toThrow();
  });

  it("nextFloat stays in [0, 1) and nextInt stays in [min, max]", () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const f = nextFloat(rng);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = nextInt(rng, 1, 6);
      expect(Number.isInteger(n) && n >= 1 && n <= 6).toBe(true);
      seen.add(n);
    }
    expect(seen.size).toBe(6);
  });

  it("shuffle returns a permutation and leaves the input alone", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(createRng(9), input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(input);
  });

  it("pick throws on empty input", () => {
    expect(() => pick(createRng(1), [])).toThrow();
  });
});
