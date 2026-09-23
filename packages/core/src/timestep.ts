// Fixed-timestep accumulator. The caller feeds real elapsed time; the
// sim only ever sees whole steps, so it stays deterministic regardless
// of frame rate. No clock is read here.

export type FixedStep = {
  stepMs: number;
  maxStepsPerAdvance: number;
  accumulatorMs: number;
};

export function createFixedStep(stepMs: number, maxStepsPerAdvance: number): FixedStep {
  if (!(stepMs > 0)) throw new Error(`stepMs must be > 0, got ${stepMs}`);
  if (!Number.isInteger(maxStepsPerAdvance) || maxStepsPerAdvance < 1) {
    throw new Error(`maxStepsPerAdvance must be an integer >= 1, got ${maxStepsPerAdvance}`);
  }
  return { stepMs, maxStepsPerAdvance, accumulatorMs: 0 };
}

/**
 * Add elapsed time and run `step` once per whole step. Mutates clock.
 * Time beyond maxStepsPerAdvance is dropped (avoids a catch-up spiral
 * after a tab was backgrounded). Returns the number of steps run.
 */
export function advance(clock: FixedStep, elapsedMs: number, step: () => void): number {
  if (!(elapsedMs >= 0)) throw new Error(`elapsedMs must be >= 0, got ${elapsedMs}`);
  clock.accumulatorMs += elapsedMs;
  let steps = 0;
  while (clock.accumulatorMs >= clock.stepMs && steps < clock.maxStepsPerAdvance) {
    step();
    clock.accumulatorMs -= clock.stepMs;
    steps++;
  }
  if (clock.accumulatorMs >= clock.stepMs) clock.accumulatorMs = 0;
  return steps;
}

/** Fraction of a step left in the accumulator, for render interpolation. */
export function alpha(clock: FixedStep): number {
  return clock.accumulatorMs / clock.stepMs;
}
