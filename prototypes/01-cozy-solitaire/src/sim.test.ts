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
const deckSize = config.suits * config.ranks;

/** Play until the deal ends, always taking the first legal action. */
function playOut(state: sim.State): sim.State {
  let s = state;
  while (!sim.isOver(s)) s = sim.applyAction(s, "p1", sim.legalActions(s, "p1")[0]!);
  return s;
}

describe("cozy solitaire sim", () => {
  it(`${verifyConfig.seedCount} seeded full deals: invariants hold, same seed -> same hashes, replays reproduce`, () => {
    const result = sweepSeeds(sim, config, {
      seeds,
      maxActions: verifyConfig.maxActions,
      checkpointEvery: replayConfig.checkpointEvery,
      invariants,
    });
    assertNoViolations(result);
    // Every deal ends: won, stuck, or out of moves. None runs forever.
    expect(result.matches.every((m) => m.state?.result !== null)).toBe(true);
  });

  it("different seeds deal different games", () => {
    const hashes = new Set(seeds.map((s) => hashState(sim.init(s, config))));
    expect(hashes.size).toBe(seeds.length);
  });

  it("the committed smoke replay matches the current rules", () => {
    expect(
      recordSmoke().checkpointHashes,
      "Rules changed? Re-record with: pnpm playtest 01-cozy-solitaire --update",
    ).toEqual(smoke.checkpointHashes);
  });

  it("deals the whole deck, once, in the classic shape", () => {
    const state = sim.init(1, config);
    const dealt = (config.tableauPiles * (config.tableauPiles + 1)) / 2;
    expect(state.tableau).toHaveLength(config.tableauPiles);
    state.tableau.forEach((pile, i) => {
      expect(pile.down).toHaveLength(i);
      expect(pile.up).toHaveLength(1);
    });
    expect(state.stock).toHaveLength(deckSize - dealt);
    expect(state.waste).toHaveLength(0);
    expect(state.foundations.flat()).toHaveLength(0);
  });

  it("applyAction never mutates its input", () => {
    const state = sim.init(1, config);
    const before = JSON.stringify(state);
    sim.applyAction(state, "p1", { type: "draw" });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("rejects illegal actions with a readable reason", () => {
    const state = sim.init(1, config);
    expect(() => sim.applyAction(state, "p9", { type: "draw" })).toThrow("Unknown player");
    expect(() =>
      sim.applyAction(state, "p1", {
        type: "move",
        from: { kind: "tableau", index: 0 },
        to: { kind: "stock", index: 0 },
        count: 1,
      }),
    ).toThrow("does not accept");
    expect(() =>
      sim.applyAction(state, "p1", {
        type: "move",
        from: { kind: "tableau", index: 0 },
        to: { kind: "tableau", index: 1 },
        count: 9,
      }),
    ).toThrow("Cannot take 9");
    expect(() =>
      sim.applyAction(state, "p1", {
        type: "move",
        from: { kind: "stock", index: 0 },
        to: { kind: "tableau", index: 1 },
        count: 1,
      }),
    ).toThrow("Cannot take 1 from stock");
    const done = playOut(state);
    expect(() => sim.applyAction(done, "p1", { type: "draw" })).toThrow("Deal is over");
  });

  it("only takes a card onto a foundation in suit, from the ace up", () => {
    const state = sim.init(1, config);
    // A hand-built position beats hunting for one: the rules are what is under test.
    const ace = 0; // suit 0, rank 0
    const two = 1;
    const posed: sim.State = {
      ...structuredClone(state),
      tableau: state.tableau.map((_, i) => (i === 0 ? { down: [], up: [two] } : { down: [], up: [] })),
      foundations: [[], [], [], []],
    };
    const toFoundation = (index: number) => ({
      type: "move" as const,
      from: { kind: "tableau" as const, index: 0 },
      to: { kind: "foundation" as const, index },
      count: 1,
    });
    // The two cannot go home before its ace, nor onto another suit's pile.
    expect(() => sim.applyAction(posed, "p1", toFoundation(0))).toThrow("does not accept");
    expect(() => sim.applyAction(posed, "p1", toFoundation(1))).toThrow("does not accept");
    const withAce: sim.State = { ...posed, foundations: [[ace], [], [], []] };
    expect(sim.applyAction(withAce, "p1", toFoundation(0)).foundations[0]).toEqual([ace, two]);
  });

  it("stacks the tableau down in rank and alternating in colour", () => {
    const state = sim.init(1, config);
    // Colour is suit % 2, so suits 0 and 2 share one colour, 1 and 3 the other.
    const seven = 2 * config.ranks + 6; // suit 2, colour 0
    const sixOpposite = 1 * config.ranks + 5; // suit 1, colour 1
    const sixSameColour = 0 * config.ranks + 5; // suit 0, colour 0
    const posed: sim.State = {
      ...structuredClone(state),
      tableau: [
        { down: [], up: [seven] },
        { down: [], up: [sixOpposite] },
        { down: [], up: [sixSameColour] },
        ...state.tableau.slice(3).map(() => ({ down: [], up: [] as number[] })),
      ],
    };
    const move = (from: number) => ({
      type: "move" as const,
      from: { kind: "tableau" as const, index: from },
      to: { kind: "tableau" as const, index: 0 },
      count: 1,
    });
    expect(sim.applyAction(posed, "p1", move(1)).tableau[0]!.up).toEqual([seven, sixOpposite]);
    expect(() => sim.applyAction(posed, "p1", move(2))).toThrow("does not accept");
  });

  it("only a king starts an empty pile, and uncovering is automatic", () => {
    const state = sim.init(1, config);
    const king = config.ranks - 1; // suit 0, king
    const queen = 1 * config.ranks + config.ranks - 2; // suit 1, queen
    const buried = 5;
    const posed: sim.State = {
      ...structuredClone(state),
      tableau: [
        { down: [], up: [] },
        { down: [buried], up: [king] },
        { down: [], up: [queen] },
        ...state.tableau.slice(3).map(() => ({ down: [], up: [] as number[] })),
      ],
    };
    const move = (from: number) => ({
      type: "move" as const,
      from: { kind: "tableau" as const, index: from },
      to: { kind: "tableau" as const, index: 0 },
      count: 1,
    });
    expect(() => sim.applyAction(posed, "p1", move(2))).toThrow("does not accept");
    const after = sim.applyAction(posed, "p1", move(1));
    expect(after.tableau[0]!.up).toEqual([king]);
    // The card the king was sitting on turns over by itself.
    expect(after.tableau[1]).toEqual({ down: [], up: [buried] });
  });

  it("draws one at a time and turns the waste back over in order", () => {
    const state = sim.init(1, config);
    const drawn: number[] = [];
    let s = state;
    while (s.stock.length > 0) {
      s = sim.applyAction(s, "p1", { type: "draw" });
      drawn.push(s.waste[s.waste.length - 1]!);
    }
    expect(drawn).toEqual([...state.stock].reverse());
    expect(s.passes).toBe(0);
    // With the stock spent, one more draw turns the waste back over.
    const recycled = sim.applyAction(s, "p1", { type: "draw" });
    expect(recycled.waste).toEqual([]);
    expect(recycled.stock).toEqual(state.stock);
    expect(recycled.passes).toBe(1);
  });

  it("ends the deal as won when every card is home", () => {
    const state = sim.init(1, config);
    const lastCard = deckSize - 1;
    const posed: sim.State = {
      ...structuredClone(state),
      stock: [],
      waste: [],
      foundations: [0, 1, 2, 3].map((suit) =>
        Array.from({ length: config.ranks }, (_, rank) => suit * config.ranks + rank).slice(
          0,
          suit === 3 ? config.ranks - 1 : config.ranks,
        ),
      ),
      tableau: [{ down: [], up: [lastCard] }, ...state.tableau.slice(1).map(() => ({ down: [], up: [] as number[] }))],
    };
    const won = sim.applyAction(posed, "p1", {
      type: "move",
      from: { kind: "tableau", index: 0 },
      to: { kind: "foundation", index: 3 },
      count: 1,
    });
    expect(won.result).toBe("won");
    expect(sim.foundationCount(won)).toBe(deckSize);
    expect(sim.legalActions(won, "p1")).toEqual([]);
  });

  it("viewFor hides the face-down cards, the stock order and the RNG", () => {
    const state = sim.init(1, config);
    const view = sim.viewFor(state, "p1");
    expect(view.stockCount).toBe(state.stock.length);
    expect(JSON.stringify(view)).not.toMatch(/rng|"seed"/);
    view.tableau.forEach((pile, i) => {
      expect(Object.keys(pile).sort()).toEqual(["downCount", "up"]);
      expect(pile.downCount).toBe(state.tableau[i]!.down.length);
      expect(pile.up).toEqual(state.tableau[i]!.up);
    });
    const hidden = new Set([...state.stock, ...state.tableau.flatMap((p) => p.down)]);
    const shown = [...view.waste, ...view.foundations.flat(), ...view.tableau.flatMap((p) => p.up)];
    expect(shown.filter((card) => hidden.has(card))).toEqual([]);

    const onlooker = sim.viewFor(state, "someone-else");
    expect(onlooker.you).toBeNull();
    expect(onlooker.tableau.every((pile) => pile.up.length === 0)).toBe(true);
  });
});
