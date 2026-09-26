// Wiring for `pnpm sim 02-bastion-invaders --seeds N`: config, invariants and
// metrics in one place, so the script stays generic. Pure, like sim.ts.
import { runBatch, type BatchResult } from "@proto/testkit";
import replayConfig from "../config/replay.json";
import config from "../config/sim.json";
import verifyConfig from "../config/verify.json";
import { invariants } from "./invariants";
import { metrics, outcome } from "./metrics";
import * as sim from "./sim";

export function runSeeds(seeds: number[]): BatchResult {
  return runBatch(sim, config, {
    seeds,
    maxActions: verifyConfig.maxActions,
    checkpointEvery: replayConfig.checkpointEvery,
    invariants,
    outcome,
    metrics,
  });
}

export function configVersion(): string {
  return sim.configVersion(config);
}
