import { createRecorder, createRng, hashState, pick, playReplay } from "@proto/core";
import { describe, expect, it } from "vitest";
import config from "../config/sim.json";
import * as sim from "./sim";

const SEED_COUNT = 20;
const seeds = Array.from({ length: SEED_COUNT }, (_, i) => i + 1);

/** Play a full game choosing random legal actions from a separate policy RNG. */
function playFullGame(seed: number) {
  const policy = createRng(seed);
  const rec = createRecorder(sim, config, { seed, buildHash: "test", timestep: null, checkpointEvery: 5 });
  while (rec.state.winner === null) {
    const actions = sim.legalActions(rec.state, rec.state.active);
    rec.apply(rec.state.active, pick(policy, actions));
  }
  return { state: rec.state, replay: rec.finish() };
}

describe("template sim", () => {
  it.each(seeds)("seed %i: same seed + actions -> same final hash", (seed) => {
    const a = playFullGame(seed);
    const b = playFullGame(seed);
    expect(hashState(a.state)).toBe(hashState(b.state));
    expect(a.replay).toEqual(b.replay);
  });

  it.each(seeds)("seed %i: replay reproduces every checkpoint", (seed) => {
    const { replay } = playFullGame(seed);
    const roundTripped = JSON.parse(JSON.stringify(replay));
    expect(playReplay(sim, config, roundTripped).mismatches).toEqual([]);
  });

  it.each(seeds)("seed %i: invariants hold every turn", (seed) => {
    const policy = createRng(seed);
    let state = sim.init(seed, config);
    let played = { p1: 0, p2: 0 };
    while (state.winner === null) {
      const who = state.active;
      const action = pick(policy, sim.legalActions(state, who));
      const card = state.players[who].hand[action.index] as number;
      state = sim.applyAction(state, who, action);
      played = { ...played, [who]: played[who] + card };
      for (const id of sim.PLAYERS) {
        const p = state.players[id];
        expect(p.hand).toHaveLength(config.handSize);
        expect(p.hand.every((c) => Number.isInteger(c) && c >= config.minCard && c <= config.maxCard)).toBe(true);
        expect(p.score).toBe(played[id]);
      }
    }
    expect(state.turn).toBe(config.maxTurns);
  });

  it("different seeds deal different games", () => {
    const hashes = new Set(seeds.map((s) => hashState(sim.init(s, config))));
    expect(hashes.size).toBe(SEED_COUNT);
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
    const { state: finished } = playFullGame(1);
    expect(() => sim.applyAction(finished, finished.active, { type: "play", index: 0 })).toThrow("Game is over");
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
