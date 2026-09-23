import { hashState } from "@proto/core";
import { assertNoViolations, seedRange, sweepSeeds } from "@proto/testkit";
import { describe, expect, it } from "vitest";
import replayConfig from "../config/replay.json";
import config from "../config/sim.json";
import verifyConfig from "../config/verify.json";
import smoke from "../replays/smoke.json";
import { invariants } from "./invariants";
import { recordSmoke } from "./smoke";
import * as sim from "./sim";

const seeds = seedRange(verifyConfig.seedCount);

describe("template sim", () => {
  it(`${verifyConfig.seedCount} seeded full games: invariants hold, same seed -> same hashes, replays reproduce`, () => {
    const result = sweepSeeds(sim, config, {
      seeds,
      maxActions: verifyConfig.maxActions,
      checkpointEvery: replayConfig.checkpointEvery,
      invariants,
    });
    assertNoViolations(result);
    expect(result.matches.every((m) => m.state?.winner !== null)).toBe(true);
  });

  it("different seeds deal different games", () => {
    const hashes = new Set(seeds.map((s) => hashState(sim.init(s, config))));
    expect(hashes.size).toBe(seeds.length);
  });

  it("the committed smoke replay matches the current rules", () => {
    expect(recordSmoke().checkpointHashes, "Rules changed? Re-record with: pnpm playtest _template --update").toEqual(
      smoke.checkpointHashes,
    );
  });

  it("applyAction never mutates its input", () => {
    const state = sim.init(1, config);
    const before = JSON.stringify(state);
    sim.applyAction(state, "p1", { type: "play", index: 0 });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("rejects illegal actions with a readable reason", () => {
    const state = sim.init(1, config);
    expect(() => sim.applyAction(state, "p2", { type: "play", index: 0 })).toThrow("Not p2's turn");
    expect(() => sim.applyAction(state, "p9", { type: "play", index: 0 })).toThrow("Unknown player");
    expect(() => sim.applyAction(state, "p1", { type: "play", index: config.handSize })).toThrow("out of range");
    let s = state;
    while (!sim.isOver(s)) s = sim.applyAction(s, s.active, { type: "play", index: 0 });
    expect(() => sim.applyAction(s, s.active, { type: "play", index: 0 })).toThrow("Game is over");
  });

  it("viewFor hides the opponent's hand and the RNG", () => {
    const state = sim.init(1, config);
    const view = sim.viewFor(state, "p1");
    expect(view.players.p1.hand).toEqual(state.players.p1.hand);
    expect(view.players.p2.hand).toBeNull();
    expect(view.players.p2.handCount).toBe(config.handSize);
    expect(JSON.stringify(view)).not.toMatch(/rng|seed/);
    const spectator = sim.viewFor(state, "spectator");
    expect(spectator.you).toBeNull();
    expect(spectator.players.p1.hand).toBeNull();
  });
});
