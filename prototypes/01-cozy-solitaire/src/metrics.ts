// What `pnpm sim 01-cozy-solitaire --seeds N` measures. Pure, like sim.ts.
//
// Read these as a floor, not a forecast: the bot plays random legal
// moves, so its win rate says how often a deal falls out on its own, not
// how often a person would win it.
import { foundationCount, type State } from "./sim";

export function outcome(state: State): string {
  return state.result ?? "unfinished";
}

export function metrics(state: State): Record<string, number> {
  return {
    cardsHome: foundationCount(state),
    moves: state.moves,
    passes: state.passes,
    facedown: state.tableau.reduce((sum, pile) => sum + pile.down.length, 0),
  };
}
