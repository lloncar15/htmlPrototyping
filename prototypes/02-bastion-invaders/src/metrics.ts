// What `pnpm sim 02-bastion-invaders --seeds N` measures. Pure, like
// sim.ts. `outcome` is counted as a share of matches; every number in
// `metrics` is reported as mean/min/max.
import type { State } from "./sim";

export function outcome(state: State): string {
  return state.winner ?? "unfinished";
}

export function metrics(state: State): Record<string, number> {
  const killed = state.invaders.filter((i) => !i.alive).length;
  return {
    seconds: (state.tick * state.config.tickMs) / 1000,
    score: state.player.score,
    killed,
    killedShare: killed / state.invaders.length,
    livesLeft: state.player.lives,
    blocksLeft: state.blocks.filter((b) => b.alive).length,
    /** How far the formation got towards the player, in march-down steps. */
    stepsDown: state.formation.z / state.config.marchStepZ,
  };
}
