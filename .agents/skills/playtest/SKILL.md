---
name: playtest
description: Run a prototype headlessly with its seeded smoke replay, capture screenshots and console errors, and report pass or fail. Use after any gameplay or UI change, or when asked to playtest or verify a prototype. Do not use for balance analysis; use tuning-pass for that. Do not use to accept a rules change; that needs the user's say-so.
---

# Playtest

1. If the prototype was not named, ask which one (a folder name in `prototypes/`, e.g. `_template`).
2. Run `pnpm playtest <slug>`. It starts the dev server, replays `replays/smoke.json` in a headless browser, saves screenshots to `.screens/<slug>/`, and exits non-zero on failure.
3. Read the JSON report it prints: `failures` lists hash mismatches, invariant failures, thrown actions, and console errors, each with the step it happened at.
4. If you can view images, look at the screenshots in the report for obvious rendering problems (blank page, overlapping UI, missing elements).
5. Report pass or fail with the specific evidence: the final line of output, and each failure verbatim.

If the only failures are hash mismatches and the user deliberately changed the rules, say so and ask before running `pnpm playtest <slug> --update`. Show the old and new final hash when you do.

Fallback: if something can't be checked this way (e.g. an interaction the smoke replay never reaches, or a visual question the screenshots don't answer), you may use the Playwright MCP browser against `pnpm dev <slug>` to look. Say you did, and why. It supplements this check; `pnpm verify` still decides whether a change is done.

Do not edit game code while running this skill.
