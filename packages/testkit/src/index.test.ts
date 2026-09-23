import { createRng, nextInt, type RngState } from "@proto/core";
import { describe, expect, it } from "vitest";
import {
  assertNoViolations,
  randomLegalBot,
  runMatch,
  scriptedBot,
  seedRange,
  sweepSeeds,
  type Invariant,
  type PlayableSim,
} from "./index";

// Race to a target: players alternate adding a die roll or 1 to their total.
type State = { rng: RngState; turn: number; totals: Record<string, number> };
type Action = { type: "roll" } | { type: "step" };
type Config = { target: number };

function makeSim(overrides: Partial<PlayableSim<State, Action, Config>> = {}): PlayableSim<State, Action, Config> {
  const players = ["p1", "p2"];
  const active = (s: State) => players[s.turn % 2] as string;
  return {
    init: (seed) => ({ rng: createRng(seed), turn: 0, totals: { p1: 0, p2: 0 } }),
    applyAction(state, playerId, action) {
      if (playerId !== active(state)) throw new Error(`Not ${playerId}'s turn`);
      const next = structuredClone(state);
      next.totals[playerId] = (next.totals[playerId] as number) + (action.type === "roll" ? nextInt(next.rng, 1, 6) : 1);
      next.turn++;
      return next;
    },
    configVersion: () => "race@1",
    activePlayers: (s) => [active(s)],
    legalActions: () => [{ type: "roll" }, { type: "step" }],
    isOver: (s) => Object.values(s.totals).some((t) => t >= 20),
    ...overrides,
  };
}

const config: Config = { target: 20 };
const base = { maxActions: 200, checkpointEvery: 5 };

describe("testkit", () => {
  it("a sound sim sweeps clean across seeds", () => {
    const result = sweepSeeds(makeSim(), config, { ...base, seeds: seedRange(20) });
    expect(result.matches).toHaveLength(20);
    assertNoViolations(result);
  });

  it("random-legal bot is deterministic per seed", () => {
    const a = runMatch(makeSim(), config, { ...base, seed: 4, policy: randomLegalBot(4) });
    const b = runMatch(makeSim(), config, { ...base, seed: 4, policy: randomLegalBot(4) });
    expect(a.replay).toEqual(b.replay);
  });

  it("reports an invariant violation with seed, step, and reason", () => {
    const noBigLeads: Invariant<State> = {
      name: "no-big-lead",
      check: (s) => (Math.abs((s.totals.p1 ?? 0) - (s.totals.p2 ?? 0)) > 3 ? `lead is ${s.totals.p1} vs ${s.totals.p2}` : null),
    };
    const result = sweepSeeds(makeSim(), config, { ...base, seeds: [1], invariants: [noBigLeads] });
    expect(result.violations[0]).toMatchObject({ seed: 1, kind: "invariant", name: "no-big-lead" });
    expect(() => assertNoViolations(result)).toThrow(/seed 1, step \d+ \[invariant: no-big-lead\] lead is/);
  });

  it("catches hidden nondeterminism (state outside the seeded RNG)", () => {
    let calls = 0;
    const leaky = makeSim({
      applyAction(state, playerId) {
        const next = structuredClone(state);
        next.totals[playerId] = (next.totals[playerId] as number) + (calls++ % 3) + 1;
        next.turn++;
        return next;
      },
    });
    const result = sweepSeeds(leaky, config, { ...base, seeds: [1] });
    expect(result.violations[0]).toMatchObject({ kind: "nondeterministic" });
  });

  it("scripted bot plays its script in order, then throws", () => {
    const script: Action[] = [{ type: "step" }, { type: "step" }, { type: "roll" }];
    const bot = scriptedBot<State, Action>(script);
    const state = makeSim().init(1, config);
    expect(script.map(() => bot(state, "p1", []))).toEqual(script);
    expect(() => bot(state, "p1", [])).toThrow("ran out");
  });

  it("catches a throwing applyAction, a stuck game, a runaway game, and unhashable state", () => {
    const stuck = runMatch(makeSim({ legalActions: () => [] }), config, { ...base, seed: 1, policy: randomLegalBot(1) });
    expect(stuck.violations[0]?.kind).toBe("stuck");

    const endless = runMatch(makeSim({ isOver: () => false }), config, { ...base, seed: 1, policy: randomLegalBot(1) });
    expect(endless.violations[0]?.kind).toBe("max-actions");

    const nan = makeSim({ applyAction: (s) => ({ ...s, totals: { p1: NaN, p2: 0 } }) });
    const bad = runMatch(nan, config, { ...base, seed: 1, policy: randomLegalBot(1) });
    expect(bad.violations[0]).toMatchObject({ kind: "json", step: 1 });
    expect(bad.violations[0]?.reason).toContain("$.totals.p1");

    const rejecting = makeSim({
      applyAction: () => {
        throw new Error("boom");
      },
    });
    const crash = runMatch(rejecting, config, { ...base, seed: 1, policy: randomLegalBot(1) });
    expect(crash.violations[0]).toMatchObject({ kind: "threw", step: 1 });
    expect(crash.violations[0]?.reason).toContain("boom");
  });
});
