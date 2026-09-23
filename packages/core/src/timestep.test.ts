import { describe, expect, it } from "vitest";
import { advance, alpha, createFixedStep } from "./timestep";

describe("fixed timestep", () => {
  it("runs one step per whole stepMs and carries the remainder", () => {
    const clock = createFixedStep(10, 100);
    let steps = 0;
    expect(advance(clock, 25, () => steps++)).toBe(2);
    expect(alpha(clock)).toBeCloseTo(0.5);
    expect(advance(clock, 5, () => steps++)).toBe(1);
    expect(steps).toBe(3);
  });

  it("step count depends only on total time, not frame slicing", () => {
    const run = (frames: number[]) => {
      const clock = createFixedStep(16, 1000);
      let steps = 0;
      frames.forEach((ms) => advance(clock, ms, () => steps++));
      return steps;
    };
    expect(run([160])).toBe(run(Array.from({ length: 10 }, () => 16)));
  });

  it("caps steps per advance and drops the backlog", () => {
    const clock = createFixedStep(10, 3);
    expect(advance(clock, 1000, () => {})).toBe(3);
    expect(clock.accumulatorMs).toBe(0);
  });
});
