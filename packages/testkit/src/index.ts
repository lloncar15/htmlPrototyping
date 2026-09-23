// Headless sim testing: bots, invariants, seed sweeps. Pure: no DOM,
// no renderer, no Math.random(). Every failure is reported as a
// Violation with the seed and step, so it can be reproduced exactly.
import {
  createRecorder,
  createRng,
  hashState,
  pick,
  playReplay,
  type Recorder,
  type Replay,
  type Sim,
} from "@proto/core";

/** A sim a bot can play: the core Sim plus turn/legality queries. */
export interface PlayableSim<S, A, C> extends Sim<S, A, C> {
  /** Players who may act now, in a stable order. */
  activePlayers(state: S): string[];
  legalActions(state: S, playerId: string): A[];
  isOver(state: S): boolean;
}

/** Returns null when the invariant holds, otherwise a readable reason. */
export type Invariant<S> = { name: string; check(state: S): string | null };

export type Policy<S, A> = (state: S, playerId: string, legal: A[]) => A;

export type ViolationKind = "invariant" | "threw" | "stuck" | "max-actions" | "json" | "nondeterministic";

export type Violation = { seed: number; step: number; kind: ViolationKind; name: string; reason: string };

export type MatchOptions<S, A> = {
  seed: number;
  policy: Policy<S, A>;
  maxActions: number;
  checkpointEvery: number;
  invariants?: Invariant<S>[];
  buildHash?: string;
};

export type MatchResult<S, A> = {
  seed: number;
  steps: number;
  state: S | null;
  replay: Replay<A> | null;
  violations: Violation[];
};

// Offset so the bot's RNG stream differs from the sim's for the same seed.
const POLICY_SEED_OFFSET = 0x9e3779b9;

/** Picks uniformly among legal actions using its own seeded RNG. */
export function randomLegalBot<S, A>(seed: number): Policy<S, A> {
  const rng = createRng((seed + POLICY_SEED_OFFSET) >>> 0);
  return (_state, _playerId, legal) => pick(rng, legal);
}

/** Plays a fixed list of actions in order, then throws. */
export function scriptedBot<S, A>(script: readonly A[]): Policy<S, A> {
  let i = 0;
  return () => {
    if (i >= script.length) throw new Error(`Scripted bot ran out of actions after ${script.length}`);
    return script[i++] as A;
  };
}

export function seedRange(count: number, first = 1): number[] {
  return Array.from({ length: count }, (_, i) => first + i);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Play one match headlessly, checking invariants after init and every action. Stops at the first violation. */
export function runMatch<S, A, C>(sim: PlayableSim<S, A, C>, config: C, opts: MatchOptions<S, A>): MatchResult<S, A> {
  const { seed } = opts;
  const violations: Violation[] = [];
  const fail = (step: number, kind: ViolationKind, name: string, reason: string) =>
    violations.push({ seed, step, kind, name, reason });

  let recorder: Recorder<S, A>;
  try {
    recorder = createRecorder(sim, config, {
      seed,
      buildHash: opts.buildHash ?? "test",
      timestep: null,
      checkpointEvery: opts.checkpointEvery,
    });
  } catch (err) {
    fail(0, "threw", "init", `init threw: ${message(err)}`);
    return { seed, steps: 0, state: null, replay: null, violations };
  }

  const check = (step: number) => {
    const state = recorder.state;
    for (const inv of opts.invariants ?? []) {
      let reason: string | null;
      try {
        reason = inv.check(state);
      } catch (err) {
        reason = `invariant threw: ${message(err)}`;
      }
      if (reason !== null) fail(step, "invariant", inv.name, reason);
    }
    try {
      hashState(state);
    } catch (err) {
      fail(step, "json", "json-safe", message(err));
    }
  };

  let steps = 0;
  check(0);
  while (violations.length === 0 && !sim.isOver(recorder.state)) {
    if (steps >= opts.maxActions) {
      fail(steps, "max-actions", "max-actions", `Game not over after ${opts.maxActions} actions`);
      break;
    }
    const state = recorder.state;
    const active = sim.activePlayers(state);
    const playerId = active.find((p) => sim.legalActions(state, p).length > 0);
    if (playerId === undefined) {
      fail(
        steps,
        "stuck",
        "stuck",
        `Game not over but no active player has a legal action (active: [${active.join(", ")}])`,
      );
      break;
    }
    const action = opts.policy(state, playerId, sim.legalActions(state, playerId));
    try {
      recorder.apply(playerId, action);
    } catch (err) {
      fail(
        steps + 1,
        "threw",
        "applyAction",
        `applyAction(${playerId}, ${JSON.stringify(action)}) threw: ${message(err)}`,
      );
      break;
    }
    steps++;
    check(steps);
  }

  let replay: Replay<A> | null = null;
  try {
    replay = recorder.finish();
  } catch {
    // State is not hashable; already reported as a json violation.
  }
  return { seed, steps, state: recorder.state, replay, violations };
}

export type SweepOptions<S, A> = {
  seeds: number[];
  maxActions: number;
  checkpointEvery: number;
  invariants?: Invariant<S>[];
  /** Defaults to randomLegalBot(seed). Called fresh for every run. */
  makePolicy?: (seed: number) => Policy<S, A>;
};

export type SweepResult<S, A> = { matches: MatchResult<S, A>[]; violations: Violation[] };

/**
 * Run a match per seed, then check determinism two ways: the same seed
 * and bot run again must give identical checkpoint hashes, and the
 * recorded replay (after a JSON round-trip) must reproduce them.
 */
export function sweepSeeds<S, A, C>(sim: PlayableSim<S, A, C>, config: C, opts: SweepOptions<S, A>): SweepResult<S, A> {
  const makePolicy = opts.makePolicy ?? ((seed: number) => randomLegalBot<S, A>(seed));
  const matches: MatchResult<S, A>[] = [];
  const violations: Violation[] = [];

  for (const seed of opts.seeds) {
    const run = () => runMatch(sim, config, { ...opts, seed, policy: makePolicy(seed) });
    const first = run();
    matches.push(first);
    violations.push(...first.violations);
    if (first.violations.length > 0 || first.replay === null) continue;

    const second = run();
    const a = first.replay.checkpointHashes;
    const b = second.replay?.checkpointHashes ?? {};
    const differing = Object.keys(a).find((k) => a[k] !== b[k]);
    if (differing !== undefined) {
      violations.push({
        seed,
        step: differing === "final" ? first.steps : Number(differing),
        kind: "nondeterministic",
        name: "same-seed",
        reason: `Same seed and bot gave different hashes at checkpoint ${differing} (${a[differing]} vs ${b[differing] ?? "missing"}). Something outside the seeded RNG affects the sim.`,
      });
      continue;
    }

    const playback = playReplay(sim, config, JSON.parse(JSON.stringify(first.replay)) as Replay<A>);
    const mismatch = playback.mismatches[0];
    if (mismatch) {
      violations.push({
        seed,
        step: mismatch.checkpoint === "final" ? first.steps : Number(mismatch.checkpoint),
        kind: "nondeterministic",
        name: "replay",
        reason: `Replay did not reproduce checkpoint ${mismatch.checkpoint}: expected ${mismatch.expected}, got ${mismatch.actual}`,
      });
    }
  }
  return { matches, violations };
}

export function formatViolations(violations: Violation[]): string {
  return violations.map((v) => `seed ${v.seed}, step ${v.step} [${v.kind}: ${v.name}] ${v.reason}`).join("\n");
}

/** Throws one readable error listing every violation. */
export function assertNoViolations(result: { violations: Violation[] }): void {
  if (result.violations.length > 0) {
    throw new Error(`${result.violations.length} violation(s):\n${formatViolations(result.violations)}`);
  }
}
