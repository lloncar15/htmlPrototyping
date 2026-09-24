// Wiring for `pnpm sim 01-cozy-solitaire --seeds N`: config, invariants
// and metrics in one place, so the script stays generic. Pure, like sim.ts.
import { runBatch, type BatchResult } from "@proto/testkit";
import replayConfig from "../config/replay.json";
import config from "../config/sim.json";
import verifyConfig from "../config/verify.json";
import { greedyBot } from "./bot";
import { invariants } from "./invariants";
import { metrics, outcome } from "./metrics";
import * as sim from "./sim";

export function runSeeds(seeds: number[]): BatchResult {
  return runBatch(sim, config, {
    seeds,
    maxActions: verifyConfig.maxActions,
    checkpointEvery: replayConfig.checkpointEvery,
    invariants,
    // The greedy bot, not the random one: see src/bot.ts for why.
    makePolicy: greedyBot,
    outcome,
    metrics,
  });
}

export function configVersion(): string {
  return sim.configVersion(config);
}
