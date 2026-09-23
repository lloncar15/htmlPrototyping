import { describe, expect, it } from "vitest";
import { createRecorder, playReplay, type Sim } from "./replay";
import { createRng, nextInt, type RngState } from "./rng";

// Minimal sim: each "roll" adds a random number to the roller's total.
type State = { rng: RngState; totals: Record<string, number> };
type Action = { type: "roll" };
type Config = { version: number; sides: number };

const dice: Sim<State, Action, Config> = {
  init: (seed) => ({ rng: createRng(seed), totals: {} }),
  applyAction(state, playerId) {
    const next = structuredClone(state);
    next.totals[playerId] = (next.totals[playerId] ?? 0) + nextInt(next.rng, 1, 6);
    return next;
  },
  configVersion: (config) => `dice@${config.version}`,
};
const config: Config = { version: 1, sides: 6 };

function record(seed: number, n: number) {
  const rec = createRecorder(dice, config, { seed, buildHash: "test", timestep: null, checkpointEvery: 5 });
  for (let i = 0; i < n; i++) rec.apply(i % 2 ? "p2" : "p1", { type: "roll" });
  return rec.finish();
}

describe("replay", () => {
  it("replay -> same hash", () => {
    const replay = record(123, 23);
    const result = playReplay(dice, config, replay);
    expect(result.mismatches).toEqual([]);
    expect(result.finalHash).toBe(replay.checkpointHashes.final);
  });

  it("records the initial state, every N actions, and final", () => {
    expect(Object.keys(record(1, 12).checkpointHashes).sort()).toEqual(["0", "10", "5", "final"]);
  });

  it("survives a JSON round-trip of the replay file", () => {
    const replay = JSON.parse(JSON.stringify(record(5, 10)));
    expect(playReplay(dice, config, replay).mismatches).toEqual([]);
  });

  it("detects a changed action at the first affected checkpoint", () => {
    const replay = record(9, 10);
    replay.actions[7] = { playerId: "p3", action: { type: "roll" } };
    const { mismatches } = playReplay(dice, config, replay);
    expect(mismatches.map((m) => m.checkpoint)).toEqual(["10", "final"]);
  });

  it("detects a different seed or config version", () => {
    const replay = record(9, 10);
    expect(playReplay(dice, config, { ...replay, seed: 10 }).mismatches[0]?.checkpoint).toBe("0");
    expect(playReplay(dice, { ...config, version: 2 }, replay).mismatches[0]?.checkpoint).toBe("configVersion");
  });
});
