// What `pnpm sim _template-3d --seeds N` measures. Pure, like sim.ts.
// `outcome` is counted as a share of matches; every number in `metrics`
// is reported as mean/min/max. For a movement game the useful numbers
// are about reach — how much of the arena a run actually covered.
import type { State } from "./sim";
import { distance } from "./vec";

/** One bucket per match: did the run finish the objective or run out of ticks? */
export function outcome(state: State): string {
  return state.winner ?? "unfinished";
}

export function metrics(state: State): Record<string, number> {
  const me = state.players.p1;
  const remaining = state.pickups.filter((p) => !p.taken);
  const nearest = remaining.length === 0 ? 0 : Math.min(...remaining.map((p) => distance(me.position, p.position)));
  return {
    ticks: state.tick,
    seconds: (state.tick * state.config.tickMs) / 1000,
    collected: me.collected,
    /** How close the run ended to its next pickup: a rough "was it nearly there?". */
    nearestPickup: nearest,
  };
}
