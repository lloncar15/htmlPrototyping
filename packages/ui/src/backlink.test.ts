// The DOM half of the back link is covered by the browser playtest; the
// decision worth pinning is when it appears at all, because a stray link
// to "/" under `pnpm dev <slug>` would reload the prototype, not leave it.
import { describe, expect, it } from "vitest";
import { shouldShowBackLink } from "./backlink";

describe("shouldShowBackLink", () => {
  it("shows under the one-server launcher paths", () => {
    expect(shouldShowBackLink("/prototypes/01-cozy-solitaire/")).toBe(true);
    expect(shouldShowBackLink("/prototypes/_template/index.html")).toBe(true);
  });

  it("hides when the prototype is served as its own root", () => {
    expect(shouldShowBackLink("/")).toBe(false);
    expect(shouldShowBackLink("/index.html")).toBe(false);
  });

  it("does not match a lookalike path", () => {
    expect(shouldShowBackLink("/prototypes-old/x/")).toBe(false);
  });
});
