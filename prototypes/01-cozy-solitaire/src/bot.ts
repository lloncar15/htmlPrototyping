// A greedy solitaire player, for `pnpm sim`. Pure, like sim.ts.
//
// The random-legal bot in @proto/testkit never wins Klondike — it shuffles
// cards between piles until the move limit — so it can't answer the only
// balance question this game has: how often does a deal come out? This
// one plays the obvious priorities, in order, and gives a floor: a real
// person plays better, so a deal this bot wins is certainly winnable.
import type { Policy } from "@proto/testkit";
import { createRng, nextInt } from "@proto/core";
import type { Action, Pile, State } from "./sim";

function isMove(action: Action): action is Extract<Action, { type: "move" }> {
  return action.type === "move";
}

function tableauAt(state: State, pile: Pile) {
  return pile.kind === "tableau" ? state.tableau[pile.index] : undefined;
}

/** True when the move empties its source pile down to a face-down card, turning it over. */
function uncovers(state: State, action: Extract<Action, { type: "move" }>): boolean {
  const from = tableauAt(state, action.from);
  return from !== undefined && from.up.length === action.count && from.down.length > 0;
}

/** True when the move clears a tableau pile completely, opening a king slot. */
function empties(state: State, action: Extract<Action, { type: "move" }>): boolean {
  const from = tableauAt(state, action.from);
  return from !== undefined && from.up.length === action.count && from.down.length === 0;
}

const reversed = (a: Extract<Action, { type: "move" }>, b: Extract<Action, { type: "move" }>): boolean =>
  a.from.kind === b.to.kind && a.from.index === b.to.index && a.to.kind === b.from.kind && a.to.index === b.from.index;

// Offset so the bot's tie-breaking stream differs from the sim's for one seed.
const POLICY_SEED_OFFSET = 0x6d2b79f5;

/**
 * Priorities, highest first: send a card home; turn over a face-down
 * card; clear a pile; play the drawn card onto the tableau; turn the
 * stock. Ties break on a seeded RNG, and the immediate reverse of the
 * last move is skipped so the bot can't rock one card back and forth.
 */
export function greedyBot(seed: number): Policy<State, Action> {
  const rng = createRng((seed + POLICY_SEED_OFFSET) >>> 0);
  let last: Extract<Action, { type: "move" }> | null = null;

  return (state, _playerId, legal) => {
    const moves = legal.filter(isMove).filter((m) => last === null || !reversed(m, last));
    const draw = legal.find((a) => a.type === "draw");

    const tiers: Extract<Action, { type: "move" }>[][] = [
      moves.filter((m) => m.to.kind === "foundation"),
      moves.filter((m) => uncovers(state, m)),
      moves.filter((m) => empties(state, m) && m.from.kind === "tableau"),
      moves.filter((m) => m.from.kind === "waste" && m.to.kind === "tableau"),
    ];
    for (const tier of tiers) {
      if (tier.length === 0) continue;
      const choice = tier[nextInt(rng, 0, tier.length - 1)]!;
      last = choice;
      return choice;
    }
    if (draw !== undefined) {
      last = null;
      return draw;
    }
    // Nothing productive and no stock left: take any legal move rather than stall.
    const fallback = (moves.length > 0 ? moves : legal.filter(isMove))[0];
    if (fallback === undefined) throw new Error("greedyBot was given no legal actions");
    last = fallback;
    return fallback;
  };
}
