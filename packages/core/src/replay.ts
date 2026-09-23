// Replay record/playback. A replay is the contract
// seed + config version + ordered actions -> checkpoint hashes.
// Checkpoint keys are the number of actions applied ("0" is the
// initial state) plus "final".
import { hashState } from "./hash";

export interface Sim<S, A, C> {
  init(seed: number, config: C): S;
  applyAction(state: S, playerId: string, action: A): S;
  configVersion(config: C): string;
}

export type ReplayEntry<A> = { playerId: string; action: A };

export type Replay<A> = {
  buildHash: string;
  configVersion: string;
  seed: number;
  /** Step length in ms for fixed-timestep sims, null for turn-based. */
  timestep: number | null;
  actions: ReplayEntry<A>[];
  checkpointHashes: Record<string, string>;
};

export type RecorderOptions = {
  seed: number;
  buildHash: string;
  timestep: number | null;
  /** Record a checkpoint hash every N actions. */
  checkpointEvery: number;
};

export type Recorder<S, A> = {
  readonly state: S;
  apply(playerId: string, action: A): S;
  finish(): Replay<A>;
};

export function createRecorder<S, A, C>(sim: Sim<S, A, C>, config: C, opts: RecorderOptions): Recorder<S, A> {
  if (!Number.isInteger(opts.checkpointEvery) || opts.checkpointEvery < 1) {
    throw new Error(`checkpointEvery must be an integer >= 1, got ${opts.checkpointEvery}`);
  }
  let state = sim.init(opts.seed, config);
  const actions: ReplayEntry<A>[] = [];
  const checkpointHashes: Record<string, string> = { "0": hashState(state) };

  return {
    get state() {
      return state;
    },
    apply(playerId, action) {
      state = sim.applyAction(state, playerId, action);
      actions.push(structuredClone({ playerId, action }));
      if (actions.length % opts.checkpointEvery === 0) {
        checkpointHashes[String(actions.length)] = hashState(state);
      }
      return state;
    },
    finish() {
      return {
        buildHash: opts.buildHash,
        configVersion: sim.configVersion(config),
        seed: opts.seed,
        timestep: opts.timestep,
        actions: structuredClone(actions),
        checkpointHashes: { ...checkpointHashes, final: hashState(state) },
      };
    },
  };
}

export type ReplayMismatch = { checkpoint: string; expected: string; actual: string };

export type PlaybackResult<S> = {
  state: S;
  finalHash: string;
  /** Every checkpoint (or config version) that did not match; empty means the replay reproduced. */
  mismatches: ReplayMismatch[];
};

/** Re-run a replay and compare against its checkpoint hashes. */
export function playReplay<S, A, C>(sim: Sim<S, A, C>, config: C, replay: Replay<A>): PlaybackResult<S> {
  const mismatches: ReplayMismatch[] = [];
  const actualVersion = sim.configVersion(config);
  if (actualVersion !== replay.configVersion) {
    mismatches.push({ checkpoint: "configVersion", expected: replay.configVersion, actual: actualVersion });
  }

  const actual: Record<string, string> = {};
  let state = sim.init(replay.seed, config);
  if ("0" in replay.checkpointHashes) actual["0"] = hashState(state);
  replay.actions.forEach(({ playerId, action }, i) => {
    state = sim.applyAction(state, playerId, action);
    const key = String(i + 1);
    if (key in replay.checkpointHashes) actual[key] = hashState(state);
  });
  const finalHash = hashState(state);
  actual.final = finalHash;

  for (const [key, expected] of Object.entries(replay.checkpointHashes)) {
    const got = actual[key] ?? "(not reached)";
    if (got !== expected) mismatches.push({ checkpoint: key, expected, actual: got });
  }
  return { state, finalHash, mismatches };
}
