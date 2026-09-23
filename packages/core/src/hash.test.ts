import { describe, expect, it } from "vitest";
import { canonicalJson, hashState } from "./hash";

describe("hash", () => {
  it("ignores object key order", () => {
    expect(hashState({ a: 1, b: { c: 2, d: 3 } })).toBe(hashState({ b: { d: 3, c: 2 }, a: 1 }));
  });

  it("changes when any value changes", () => {
    expect(hashState({ a: [1, 2, 3] })).not.toBe(hashState({ a: [1, 2, 4] }));
    expect(hashState({ a: [1, 2] })).not.toBe(hashState({ a: [2, 1] }));
  });

  it("matches the golden hash (algorithm must not change silently)", () => {
    expect(hashState({ b: [1, 2, { z: "x" }], a: null, c: true })).toBe("a95d5bc9c39ed575");
  });

  it("is stable across a JSON round-trip", () => {
    const state = { turn: 3, hands: { p1: [4, 5], p2: [] }, gone: undefined, neg: -0 };
    expect(hashState(JSON.parse(JSON.stringify(state)))).toBe(hashState(state));
  });

  it("rejects values that would not survive JSON, naming the path", () => {
    expect(() => canonicalJson({ a: { b: NaN } })).toThrow("$.a.b");
    expect(() => canonicalJson({ a: [1, Infinity] })).toThrow("$.a[1]");
    expect(() => canonicalJson({ m: new Map() })).toThrow("Map");
    expect(() => canonicalJson({ f: () => 1 })).toThrow("function");
  });
});
