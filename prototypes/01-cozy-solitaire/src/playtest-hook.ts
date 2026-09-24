// Installs globalThis.__playtest for tools/scripts/playtest.mjs when the
// page is opened with ?playtest. Replayed actions go through the same
// dispatch path as real input, and every step is checked against the
// replay's checkpoint hashes and the invariants.
import { hashState, type Replay, type ReplayMismatch } from "@proto/core";
import { invariants } from "./invariants";
import type { Action, State } from "./sim";

export type PlaytestApp = {
  configVersion: string;
  reset(seed: number): void;
  dispatch(playerId: string, action: Action): void;
  state(): State;
};

export type PlaytestResult = {
  steps: number;
  configVersion: string;
  finalHash: string;
  mismatches: ReplayMismatch[];
  invariantFailures: string[];
  error: string | null;
};

export function installPlaytestHook(app: PlaytestApp): void {
  let replay: Replay<Action> | null = null;
  let index = 0;
  let actual: Record<string, string> = {};
  let invariantFailures: string[] = [];
  let error: string | null = null;

  const checkpoint = () => {
    const state = app.state();
    const key = String(index);
    if (replay && key in replay.checkpointHashes) actual[key] = hashState(state);
    for (const inv of invariants) {
      const reason = inv.check(state);
      if (reason !== null) invariantFailures.push(`step ${index} [${inv.name}] ${reason}`);
    }
  };

  const hook = {
    load(r: Replay<Action>): void {
      replay = r;
      index = 0;
      actual = {};
      invariantFailures = [];
      error = null;
      app.reset(r.seed);
      checkpoint();
    },
    step(): { index: number; done: boolean } {
      if (!replay) throw new Error("__playtest.load(replay) was not called");
      const entry = replay.actions[index];
      if (entry && error === null) {
        try {
          app.dispatch(entry.playerId, entry.action);
          index++;
          checkpoint();
        } catch (err) {
          error = `step ${index + 1}: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
      return { index, done: error !== null || index >= replay.actions.length };
    },
    result(): PlaytestResult {
      if (!replay) throw new Error("__playtest.load(replay) was not called");
      const finalHash = hashState(app.state());
      const mismatches: ReplayMismatch[] = [];
      if (replay.configVersion !== app.configVersion) {
        mismatches.push({ checkpoint: "configVersion", expected: replay.configVersion, actual: app.configVersion });
      }
      for (const [key, expected] of Object.entries(replay.checkpointHashes)) {
        const got = key === "final" ? finalHash : (actual[key] ?? "(not reached)");
        if (got !== expected) mismatches.push({ checkpoint: key, expected, actual: got });
      }
      return { steps: index, configVersion: app.configVersion, finalHash, mismatches, invariantFailures, error };
    },
  };
  (globalThis as { __playtest?: typeof hook }).__playtest = hook;
}
