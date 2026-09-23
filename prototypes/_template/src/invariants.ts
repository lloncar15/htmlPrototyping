// Rules that must hold after every action. Used by the seed sweep in
// sim.test.ts and by the in-browser playtest. Pure, like sim.ts.
import type { Invariant } from "@proto/testkit";
import { PLAYERS, type State } from "./sim";

export const invariants: Invariant<State>[] = [
  {
    name: "hand-size",
    check(s) {
      const bad = PLAYERS.find((id) => s.players[id].hand.length !== s.config.handSize);
      return bad ? `${bad} has ${s.players[bad].hand.length} cards, expected ${s.config.handSize}` : null;
    },
  },
  {
    name: "card-range",
    check(s) {
      for (const id of PLAYERS) {
        const card = s.players[id].hand.find(
          (c) => !Number.isInteger(c) || c < s.config.minCard || c > s.config.maxCard,
        );
        if (card !== undefined) return `${id} holds ${card}, outside ${s.config.minCard}..${s.config.maxCard}`;
      }
      return null;
    },
  },
  {
    name: "turn-range",
    check: (s) =>
      s.turn >= 1 && s.turn <= s.config.maxTurns ? null : `turn ${s.turn} outside 1..${s.config.maxTurns}`,
  },
  {
    name: "score-bounds",
    check(s) {
      // A player can have played at most `turn` cards, each worth at most maxCard.
      const max = s.turn * s.config.maxCard;
      const bad = PLAYERS.find((id) => {
        const score = s.players[id].score;
        return !Number.isInteger(score) || score < 0 || score > max;
      });
      return bad ? `${bad} score ${s.players[bad].score} outside 0..${max} on turn ${s.turn}` : null;
    },
  },
  {
    name: "winner-consistent",
    check(s) {
      if (s.winner === null) return null;
      const { p1, p2 } = s.players;
      const expected = p1.score === p2.score ? "draw" : p1.score > p2.score ? "p1" : "p2";
      if (s.turn !== s.config.maxTurns) return `winner set on turn ${s.turn}, before maxTurns ${s.config.maxTurns}`;
      return s.winner === expected ? null : `winner is ${s.winner} but scores are ${p1.score}-${p2.score}`;
    },
  },
];
