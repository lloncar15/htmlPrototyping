import { hashState } from "@proto/core";
import { assertNoViolations, seedRange, sweepSeeds } from "@proto/testkit";
import { describe, expect, it } from "vitest";
import replayConfig from "../config/replay.json";
import config from "../config/sim.json";
import verifyConfig from "../config/verify.json";
import { invariants } from "./invariants";
import * as sim from "./sim";

// Everything here holds in both testing modes. The checks that need a
// recorded replay live in ./replay.test.ts, which a smoke-mode copy of
// this template deletes.

const seeds = seedRange(verifyConfig.seedCount);

describe("template-3d sim", () => {
  it(`${verifyConfig.seedCount} seeded full runs: invariants hold, same seed -> same hashes, replays reproduce`, () => {
    const result = sweepSeeds(sim, config, {
      seeds,
      maxActions: verifyConfig.maxActions,
      checkpointEvery: replayConfig.checkpointEvery,
      invariants,
    });
    assertNoViolations(result);
    expect(result.matches.every((m) => m.state?.winner !== null)).toBe(true);
  });

  it("different seeds scatter pickups differently", () => {
    const hashes = new Set(seeds.map((s) => hashState(sim.init(s, config))));
    expect(hashes.size).toBe(seeds.length);
  });

  it("applyAction never mutates its input", () => {
    const state = sim.init(1, config);
    const before = JSON.stringify(state);
    sim.applyAction(state, "p1", { type: "tick", input: { moveX: 1, moveZ: 0 } });
    expect(JSON.stringify(state)).toBe(before);
  });

  // The whole point of a tick action: the sim's step length comes from
  // config, so wall-clock time and frame rate cannot reach it.
  it("a tick always advances by tickMs, whatever the caller is doing", () => {
    let state = sim.init(7, config);
    for (let i = 0; i < 10; i++) state = sim.applyAction(state, "p1", { type: "tick", input: { moveX: 0, moveZ: -1 } });
    expect(state.tick).toBe(10);
    expect((state.tick * config.tickMs) / 1000).toBeCloseTo(0.5, 10);
  });

  it("the same held input from the same seed lands in the same place", () => {
    const run = (): sim.State => {
      let state = sim.init(42, config);
      for (let i = 0; i < 60; i++)
        state = sim.applyAction(state, "p1", { type: "tick", input: { moveX: 1, moveZ: -1 } });
      return state;
    };
    expect(hashState(run())).toBe(hashState(run()));
  });

  it("walls stop the capsule instead of storing speed in it", () => {
    let state = sim.init(3, config);
    for (let i = 0; i < 400; i++) state = sim.applyAction(state, "p1", { type: "tick", input: { moveX: 1, moveZ: 0 } });
    const limit = config.arenaHalf - config.playerRadius;
    expect(state.players.p1.position.x).toBeCloseTo(limit, 10);
    expect(state.players.p1.velocity.x).toBe(0);
  });

  it("a run always ends, even if the player never moves", () => {
    let state = sim.init(5, config);
    while (!sim.isOver(state)) state = sim.applyAction(state, "p1", { type: "tick", input: { moveX: 0, moveZ: 0 } });
    expect(state.winner).toBe("timeout");
    expect(state.tick).toBe(config.maxTicks);
  });

  it("rejects illegal actions with a readable reason", () => {
    const state = sim.init(1, config);
    const tick = { type: "tick", input: { moveX: 0, moveZ: 0 } } as const;
    expect(() => sim.applyAction(state, "p9", tick)).toThrow("Unknown player");
    expect(() => sim.applyAction(state, "p1", { type: "jump" } as unknown as sim.Action)).toThrow(
      "Unknown action type",
    );
    expect(() => sim.applyAction(state, "p1", { type: "tick", input: { moveX: Number.NaN, moveZ: 0 } })).toThrow(
      "moveX must be a finite number",
    );
    let over = state;
    while (!sim.isOver(over)) over = sim.applyAction(over, "p1", tick);
    expect(() => sim.applyAction(over, "p1", tick)).toThrow("Run is over");
  });

  it("legalActions offers every held-input combination while the run is live", () => {
    const state = sim.init(1, config);
    expect(sim.legalActions(state, "p1")).toHaveLength(9);
    expect(sim.legalActions(state, "p9")).toEqual([]);
  });

  it("state is plain data: no THREE classes, nothing hashState would reject", () => {
    let state = sim.init(1, config);
    state = sim.applyAction(state, "p1", { type: "tick", input: { moveX: 1, moveZ: 1 } });
    expect(() => hashState(state)).not.toThrow();
    expect(Object.getPrototypeOf(state.players.p1.position)).toBe(Object.prototype);
  });

  it("viewFor hides the RNG and the pickups already taken", () => {
    let state = sim.init(1, config);
    // Walk onto the nearest pickup so at least one is gone from the view.
    const target = state.pickups[0]!.position;
    for (let i = 0; i < config.maxTicks && state.players.p1.collected === 0; i++) {
      const to = { x: target.x - state.players.p1.position.x, z: target.z - state.players.p1.position.z };
      state = sim.applyAction(state, "p1", {
        type: "tick",
        input: { moveX: Math.sign(to.x), moveZ: Math.sign(to.z) },
      });
    }
    const view = sim.viewFor(state, "p1");
    expect(state.players.p1.collected).toBeGreaterThan(0);
    expect(view.pickups.length).toBe(config.pickupCount - state.players.p1.collected);
    expect(JSON.stringify(view)).not.toMatch(/rng|seed/);
    const spectator = sim.viewFor(state, "spectator");
    expect(spectator.you).toBeNull();
  });
});
