// Installs globalThis.__playtest for tools/scripts/playtest.mjs when the
// page is opened with ?playtest. Replayed actions go through the same
// dispatch path as real input.
//
// Two shapes are accepted, matching the two testing modes:
//   replay — { actions, checkpointHashes }: every step is checked
//            against the checkpoint hashes and the invariants.
//   smoke  — { ticks, inputs: [{ fromTick, playerId, action }] }: each
//            entry is held until the next replaces it, and only the
//            invariants and thrown errors are checked. No hashes.
// This prototype ships in replay mode; the smoke branch is here so that
// flipping config/verify.json is the only change a copy has to make.
import { hashState, type Replay, type ReplayMismatch } from "@proto/core";
import type { InputScript } from "@proto/testkit";
import { invariants } from "./invariants";
import type { Action, State } from "./sim";

export type SmokeScript = InputScript<Action>;
export type SmokeInput = SmokeScript["inputs"][number];

export type PlaytestScript = Replay<Action> | SmokeScript;

export type PlaytestApp = {
  configVersion: string;
  reset(seed: number): void;
  dispatch(playerId: string, action: Action): void;
  state(): State;
  /**
   * Draw the current state right now. A real-time prototype renders from
   * a rAF clock, which under playtest would make screenshots depend on
   * how fast the machine is; the hook drives drawing instead.
   */
  render?(): void;
};

export type PlaytestResult = {
  mode: "replay" | "smoke";
  steps: number;
  configVersion: string;
  finalHash: string;
  mismatches: ReplayMismatch[];
  invariantFailures: string[];
  error: string | null;
};

function isSmoke(script: PlaytestScript): script is SmokeScript {
  return Array.isArray((script as SmokeScript).inputs);
}

export function installPlaytestHook(app: PlaytestApp): void {
  let replay: Replay<Action> | null = null;
  let smoke: SmokeScript | null = null;
  let index = 0;
  let actual: Record<string, string> = {};
  let invariantFailures: string[] = [];
  let error: string | null = null;

  const checkpoint = (): void => {
    const state = app.state();
    const key = String(index);
    if (replay && key in replay.checkpointHashes) actual[key] = hashState(state);
    for (const inv of invariants) {
      const reason = inv.check(state);
      if (reason !== null) invariantFailures.push(`step ${index} [${inv.name}] ${reason}`);
    }
  };

  /** The smoke entry in force at `tick`: the last one that has started. */
  const inputAt = (tick: number): SmokeInput | undefined => {
    let current: SmokeInput | undefined;
    for (const entry of smoke?.inputs ?? []) {
      if (entry.fromTick <= tick) current = entry;
    }
    return current;
  };

  const total = (): number => (smoke ? smoke.ticks : (replay?.actions.length ?? 0));

  /** One action, guarded. Returns false when it threw and the run should stop. */
  const applyOne = (playerId: string, action: Action): boolean => {
    try {
      app.dispatch(playerId, action);
      index++;
      checkpoint();
      return true;
    } catch (err) {
      error = `step ${index + 1}: ${err instanceof Error ? err.message : String(err)}`;
      return false;
    }
  };

  const hook = {
    load(script: PlaytestScript): void {
      replay = isSmoke(script) ? null : script;
      smoke = isSmoke(script) ? script : null;
      index = 0;
      actual = {};
      invariantFailures = [];
      error = null;
      app.reset(script.seed);
      checkpoint();
      app.render?.();
    },
    /** Advance up to `count` steps. A batch keeps a 900-tick run from being 900 round-trips. */
    step(count = 1): { index: number; done: boolean } {
      if (!replay && !smoke) throw new Error("__playtest.load(script) was not called");
      for (let i = 0; i < Math.max(1, count) && error === null && index < total(); i++) {
        if (smoke) {
          const entry = inputAt(index);
          if (!entry) {
            error = `step ${index + 1}: smoke script has no input for tick ${index}; add one at fromTick 0`;
            break;
          }
          if (!applyOne(entry.playerId, entry.action)) break;
        } else {
          const entry = replay?.actions[index];
          if (!entry) break;
          if (!applyOne(entry.playerId, entry.action)) break;
        }
      }
      app.render?.();
      return { index, done: error !== null || index >= total() };
    },
    result(): PlaytestResult {
      if (!replay && !smoke) throw new Error("__playtest.load(script) was not called");
      const finalHash = hashState(app.state());
      const mismatches: ReplayMismatch[] = [];
      // Smoke mode compares nothing: the point is that it boots, runs and
      // renders, not that it lands on a known state.
      if (replay) {
        if (replay.configVersion !== app.configVersion) {
          mismatches.push({ checkpoint: "configVersion", expected: replay.configVersion, actual: app.configVersion });
        }
        for (const [key, expected] of Object.entries(replay.checkpointHashes)) {
          const got = key === "final" ? finalHash : (actual[key] ?? "(not reached)");
          if (got !== expected) mismatches.push({ checkpoint: key, expected, actual: got });
        }
      }
      return {
        mode: smoke ? "smoke" : "replay",
        steps: index,
        configVersion: app.configVersion,
        finalHash,
        mismatches,
        invariantFailures,
        error,
      };
    },
  };
  (globalThis as { __playtest?: typeof hook }).__playtest = hook;
}
