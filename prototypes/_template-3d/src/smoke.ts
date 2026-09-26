// Records replays/smoke.json: one full run by the random-legal bot.
// Called by `pnpm playtest <slug> --update`; re-run it after an
// intentional rules change and review the diff.
//
// This prototype is in `replay` mode, so the recording is a real replay
// with checkpoint hashes, exactly as for a turn-based prototype — the
// only difference is that every action is a tick and the replay carries
// the step length in `timestep`.
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
    timestep: config.tickMs,
    buildHash: "smoke",
  });
  assertNoViolations(match);
  if (match.replay === null) throw new Error("Smoke match produced no replay");
  return match.replay;
}
