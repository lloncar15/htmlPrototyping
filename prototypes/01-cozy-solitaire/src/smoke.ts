// Records replays/smoke.json: one full game by the random-legal bot.
// Called by `pnpm playtest <slug> --update`; re-run it after an
// intentional rules change and review the diff.
import type { Replay } from "@proto/core";
import { assertNoViolations, randomLegalBot, runMatch } from "@proto/testkit";
import replayConfig from "../config/replay.json";
import config from "../config/sim.json";
import verifyConfig from "../config/verify.json";
import { invariants } from "./invariants";
import * as sim from "./sim";

export function recordSmoke(): Replay<sim.Action> {
  const seed = verifyConfig.smokeSeed;
  const match = runMatch(sim, config, {
    seed,
    policy: randomLegalBot(seed),
    maxActions: verifyConfig.maxActions,
    checkpointEvery: replayConfig.checkpointEvery,
    invariants,
    buildHash: "smoke",
  });
  assertNoViolations(match);
  if (match.replay === null) throw new Error("Smoke match produced no replay");
  return match.replay;
}
