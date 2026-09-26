// The tests that only make sense in `replay` mode, kept in their own
// file so `pnpm new-proto <slug> --3d --smoke` can simply delete it
// along with src/smoke.ts. A smoke-mode prototype has no recorded
// replay to compare against — replays/smoke.json is a hand-written
// input script there — but everything in sim.test.ts still applies.
import config from "../config/sim.json";
import smoke from "../replays/smoke.json";
import { describe, expect, it } from "vitest";
import { recordSmoke } from "./smoke";

describe("template-3d replay", () => {
  it("the committed smoke replay matches the current rules", () => {
    expect(
      recordSmoke().checkpointHashes,
      "Rules changed? Re-record with: pnpm playtest _template-3d --update",
    ).toEqual(smoke.checkpointHashes);
  });

  it("records the tick length, so a replay is not read as turn-based", () => {
    expect(recordSmoke().timestep).toBe(config.tickMs);
  });
});
