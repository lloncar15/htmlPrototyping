import { hashState } from "@proto/core";
import { assertNoViolations, seedRange, sweepSeeds } from "@proto/testkit";
import { describe, expect, it } from "vitest";
import replayConfig from "../config/replay.json";
import config from "../config/sim.json";
import verifyConfig from "../config/verify.json";
import { invariants } from "./invariants";
import * as sim from "./sim";

const seeds = seedRange(verifyConfig.seedCount);
// 20 full waves of ~800 ticks each take a few seconds; vitest's 5 s default
// is too tight when a dev server or browser is also running.
const SWEEP_TIMEOUT_MS = 30_000;
const idle: sim.Action = { type: "tick", input: { moveX: 0, fire: 0 } };
const fire: sim.Action = { type: "tick", input: { moveX: 0, fire: 1 } };

function run(state: sim.State, action: sim.Action, ticks: number): sim.State {
  let s = state;
  for (let i = 0; i < ticks && !sim.isOver(s); i++) s = sim.applyAction(s, "p1", action);
  return s;
}

describe("bastion invaders sim", () => {
  it(`${verifyConfig.seedCount} seeded full runs: invariants hold, same seed -> same hashes, replays reproduce`, () => {
    const result = sweepSeeds(sim, config, {
      seeds,
      maxActions: verifyConfig.maxActions,
      checkpointEvery: replayConfig.checkpointEvery,
      invariants,
    });
    assertNoViolations(result);
    expect(result.matches.every((m) => m.state?.winner !== null)).toBe(true);
  }, SWEEP_TIMEOUT_MS);

  it("the RNG decides enemy fire, so different seeds play out differently", () => {
    const hashes = new Set(seeds.map((s) => hashState(run(sim.init(s, config), idle, 200))));
    expect(hashes.size).toBe(seeds.length);
  });

  it("applyAction never mutates its input", () => {
    const state = sim.init(1, config);
    const before = JSON.stringify(state);
    sim.applyAction(state, "p1", fire);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("a shot fired straight up hits the front invader of the middle column, not the one behind it", () => {
    // Stand under column 3's centre and fire once. Bunkers are placed
    // between columns at the default config, so the lane is clear.
    let state = sim.init(1, { ...config, enemyFireChance: 0, bunkerCount: 0 });
    const col = 3;
    const target = sim.viewFor(state, "p1").invaders.find((i) => i.col === col && i.row === config.invaderRows - 1)!;
    state = { ...state, player: { ...state.player, x: target.x } };
    state = sim.applyAction(state, "p1", fire);
    state = run(state, idle, 40);
    const dead = state.invaders.filter((i) => !i.alive);
    expect(dead.map((i) => [i.col, i.row])).toEqual([[col, config.invaderRows - 1]]);
    expect(state.player.score).toBe(sim.pointsFor(config, config.invaderRows - 1));
  });

  it("fast shots do not tunnel through an invader in one tick", () => {
    // A shot that moves 3 invader-depths per tick must still hit.
    let state = sim.init(1, { ...config, enemyFireChance: 0, bunkerCount: 0, shotSpeed: 60 });
    const target = sim.viewFor(state, "p1").invaders.find((i) => i.row === config.invaderRows - 1)!;
    state = { ...state, player: { ...state.player, x: target.x } };
    state = run(sim.applyAction(state, "p1", fire), idle, 20);
    expect(state.invaders.some((i) => !i.alive)).toBe(true);
  });

  it("bunker blocks stop shots and are destroyed by them", () => {
    let state = sim.init(1, { ...config, enemyFireChance: 0 });
    const block = state.blocks[0]!;
    state = { ...state, player: { ...state.player, x: block.x } };
    state = run(sim.applyAction(state, "p1", fire), idle, 10);
    expect(state.blocks.filter((b) => !b.alive)).toHaveLength(1);
    expect(state.invaders.every((i) => i.alive)).toBe(true);
  });

  it("fire respects the cooldown and the shot cap", () => {
    let state = sim.init(1, { ...config, enemyFireChance: 0 });
    state = sim.applyAction(state, "p1", fire);
    expect(state.playerShots).toHaveLength(1);
    state = sim.applyAction(state, "p1", fire);
    expect(state.playerShots.length).toBeLessThanOrEqual(1);
    expect(state.player.cooldown).toBe(config.shotCooldownTicks - 1);
  });

  it("the formation marches, drops at the edge and speeds up as it thins", () => {
    let state = sim.init(1, { ...config, enemyFireChance: 0 });
    state = run(state, idle, config.marchIntervalStart);
    expect(state.formation.x).toBe(config.marchStepX);
    while (state.formation.z === 0) state = sim.applyAction(state, "p1", idle);
    expect(state.formation.z).toBe(config.marchStepZ);
    expect(state.formation.dir).toBe(-1);
    const total = config.invaderCols * config.invaderRows;
    expect(sim.marchInterval(config, total)).toBe(config.marchIntervalStart);
    expect(sim.marchInterval(config, 1)).toBe(config.marchIntervalMin);
  });

  it("a player who never fires loses to the invasion", () => {
    const state = run(sim.init(5, { ...config, enemyFireChance: 0 }), idle, config.maxTicks);
    expect(state.winner).toBe("invaders");
    expect(state.player.lives).toBe(config.lives);
  });

  it("enemy shots cost lives, and losing them all ends the run", () => {
    // Remove the bunkers and let the formation fire freely at a still player.
    const state = run(sim.init(2, { ...config, enemyFireChance: 1, bunkerCount: 0 }), idle, config.maxTicks);
    expect(state.winner).toBe("invaders");
    expect(state.player.lives).toBeLessThan(config.lives);
  });

  it("rejects illegal actions with a readable reason", () => {
    const state = sim.init(1, config);
    expect(() => sim.applyAction(state, "p9", idle)).toThrow("Unknown player");
    expect(() => sim.applyAction(state, "p1", { type: "jump" } as unknown as sim.Action)).toThrow("Unknown action type");
    expect(() => sim.applyAction(state, "p1", { type: "tick", input: { moveX: Number.NaN, fire: 0 } })).toThrow(
      "moveX must be a finite number",
    );
    const over = run(state, idle, config.maxTicks);
    expect(() => sim.applyAction(over, "p1", idle)).toThrow("Run is over");
  });

  it("legalActions offers every move x fire combination while the run is live", () => {
    const state = sim.init(1, config);
    expect(sim.legalActions(state, "p1")).toHaveLength(6);
    expect(sim.legalActions(state, "p9")).toEqual([]);
  });

  it("state is plain data: no THREE classes, nothing hashState would reject", () => {
    const state = sim.applyAction(sim.init(1, config), "p1", fire);
    expect(() => hashState(state)).not.toThrow();
    expect(Object.getPrototypeOf(state.player)).toBe(Object.prototype);
  });

  it("viewFor hides the RNG and dead invaders", () => {
    const state = sim.init(1, config);
    const view = sim.viewFor(state, "p1");
    expect(view.invaders).toHaveLength(config.invaderCols * config.invaderRows);
    expect(JSON.stringify(view)).not.toMatch(/rng|seed/);
    expect(sim.viewFor(state, "spectator").you).toBeNull();
  });
});
