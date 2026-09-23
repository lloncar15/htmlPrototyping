// What `pnpm sim <slug> --seeds N` measures. Pure, like sim.ts.
// `outcome` is counted as a share of matches; every number in `metrics`
// is reported as mean/min/max. Keep these few and meaningful: they are
// what a tuning pass argues from.
import { PLAYERS, type State } from "./sim";

/** One bucket per match. Balance is read off the share of each bucket. */
export function outcome(state: State): string {
  return state.winner ?? "unfinished";
}

export function metrics(state: State): Record<string, number> {
  const [p1, p2] = PLAYERS.map((id) => state.players[id].score) as [number, number];
  return {
    turns: state.turn,
    p1Score: p1,
    p2Score: p2,
    scoreGap: Math.abs(p1 - p2),
  };
}
