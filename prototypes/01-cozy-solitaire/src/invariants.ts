// Rules that must hold after every action. Used by the seed sweep in
// sim.test.ts and by the in-browser playtest. Pure, like sim.ts.
//
// Conservation is the important one: solitaire is a closed deck, so a
// card that is duplicated or lost means a move applied twice or an
// off-by-one in a splice, which is easy to write and hard to see.
import type { Invariant } from "@proto/testkit";
import { colorOf, foundationCount, PLAYERS, rankOf, suitOf, viewFor, type State } from "./sim";

function allCards(s: State): number[] {
  return [...s.stock, ...s.waste, ...s.foundations.flat(), ...s.tableau.flatMap((pile) => [...pile.down, ...pile.up])];
}

export const invariants: Invariant<State>[] = [
  {
    name: "deck-conserved",
    check(s) {
      const size = s.config.suits * s.config.ranks;
      const cards = allCards(s);
      if (cards.length !== size) return `${cards.length} cards in play, deck has ${size}`;
      const seen = new Set(cards);
      if (seen.size !== cards.length) return `a card appears twice (${cards.length} cards, ${seen.size} distinct)`;
      const stray = cards.find((c) => !Number.isInteger(c) || c < 0 || c >= size);
      return stray === undefined ? null : `card ${stray} is outside 0..${size - 1}`;
    },
  },
  {
    name: "foundation-order",
    check(s) {
      for (let suit = 0; suit < s.foundations.length; suit++) {
        const pile = s.foundations[suit]!;
        for (let rank = 0; rank < pile.length; rank++) {
          const card = pile[rank]!;
          if (suitOf(card, s.config) !== suit || rankOf(card, s.config) !== rank) {
            return `foundation ${suit} holds card ${card} at rank ${rank}`;
          }
        }
      }
      return null;
    },
  },
  {
    name: "tableau-run",
    check(s) {
      for (let i = 0; i < s.tableau.length; i++) {
        const up = s.tableau[i]!.up;
        for (let j = 1; j < up.length; j++) {
          const under = up[j - 1]!;
          const over = up[j]!;
          if (rankOf(over, s.config) !== rankOf(under, s.config) - 1) {
            return `tableau ${i} has ${over} on ${under}, not one rank lower`;
          }
          if (colorOf(over, s.config) === colorOf(under, s.config)) {
            return `tableau ${i} has ${over} on ${under}, same colour`;
          }
        }
      }
      return null;
    },
  },
  {
    name: "tableau-flipped",
    check(s) {
      const i = s.tableau.findIndex((pile) => pile.up.length === 0 && pile.down.length > 0);
      return i === -1 ? null : `tableau ${i} has ${s.tableau[i]!.down.length} face-down cards and nothing face up`;
    },
  },
  {
    name: "move-budget",
    check(s) {
      if (!Number.isInteger(s.moves) || s.moves < 0) return `moves is ${s.moves}`;
      if (s.moves > s.config.moveLimit) return `moves ${s.moves} past the limit of ${s.config.moveLimit}`;
      if (!Number.isInteger(s.passes) || s.passes < 0) return `passes is ${s.passes}`;
      if (s.config.maxPasses > 0 && s.passes > s.config.maxPasses) {
        return `passes ${s.passes} past the limit of ${s.config.maxPasses}`;
      }
      return null;
    },
  },
  {
    name: "result-consistent",
    check(s) {
      const complete = foundationCount(s) === s.config.suits * s.config.ranks;
      if (complete && s.result !== "won") return `every card is home but result is ${s.result}`;
      if (s.result === "won" && !complete) return `result is won with ${foundationCount(s)} cards home`;
      return null;
    },
  },
  {
    name: "no-peeking",
    check(s) {
      // Single player, but the redaction still has to hold: nothing the
      // view shows may be a card that is face down on the table.
      const hidden = new Set([...s.stock, ...s.tableau.flatMap((pile) => pile.down)]);
      const view = viewFor(s, PLAYERS[0]);
      const shown = [...view.waste, ...view.foundations.flat(), ...view.tableau.flatMap((pile) => pile.up)];
      const leaked = shown.find((card) => hidden.has(card));
      return leaked === undefined ? null : `viewFor shows card ${leaked}, which is face down`;
    },
  },
];
