// The rest of @proto/ui is DOM code and is covered by the browser
// playtest; this is the pure part, and it decides what a designer reads
// off the corner of the screen when comparing two builds.
import { describe, expect, it } from "vitest";
import { configVersionOf } from "./stamp";

describe("configVersionOf", () => {
  it("names every versioned config file", () => {
    expect(configVersionOf({ sim: { version: 2 }, ui: { version: 1 } })).toBe("sim@2,ui@1");
  });

  it("skips files with no version, rather than inventing one", () => {
    expect(configVersionOf({ sim: { version: 2 }, replay: { checkpointEvery: 5 } })).toBe("sim@2");
  });

  it("skips a version that is not a number", () => {
    expect(configVersionOf({ sim: { version: "two" } })).toBe("");
  });

  it("keeps the order it was given, so the stamp is stable", () => {
    expect(configVersionOf({ ui: { version: 1 }, sim: { version: 2 } })).toBe("ui@1,sim@2");
  });
});
