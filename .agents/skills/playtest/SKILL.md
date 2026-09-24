---
name: playtest
description: Run a prototype headlessly with its seeded smoke replay, capture screenshots and console errors, and report pass or fail. Use after any gameplay or UI change, or when asked to playtest or verify a prototype. Do not use for balance analysis; use tuning-pass for that. Do not use to accept a rules change; that needs the user's say-so.
---

# Playtest

1. If the prototype was not named, ask which one (a folder name in `prototypes/`, e.g. `_template`).
2. Check its testing mode: `"mode"` in `prototypes/<slug>/config/verify.json`, also stated on the `Testing:` line of its AGENTS.md. It decides what this check can prove (below).
3. Run `pnpm playtest <slug>`. It starts the dev server, runs `replays/smoke.json` in a headless browser, saves screenshots to `.screens/<slug>/`, and exits non-zero on failure.
4. Read the JSON report it prints: `failures` lists what went wrong, each with the step or tick it happened at.
5. If you can view images, look at the screenshots in the report for obvious rendering problems (blank page, overlapping UI, missing elements).
6. Report pass or fail with the specific evidence: the final line of output, and each failure verbatim. Say which mode it ran in.

## What each mode checks

**`replay` mode** — replays a recorded action list and compares checkpoint hashes. It catches any change in behaviour, on top of invariant failures, thrown actions and console errors. A pass means the rules still produce exactly the same game.

**`smoke` mode** — runs a short hand-written input script and checks only that nothing broke: no thrown errors, no console errors, no invariant failures, and not a blank canvas. It does **not** compare hashes.

A smoke pass means the prototype boots and runs. It does **not** mean the game still behaves correctly, that a rules change did what was intended, or that anything is fun. Say that plainly when reporting; do not describe a smoke pass as verifying gameplay. If the change needs judging, tell the user it needs a human playtest, and say which behaviour you could not check.

## Updating

`--update` re-records the replay and only applies to `replay` mode. If the only failures are hash mismatches and the user deliberately changed the rules, say so and ask before running `pnpm playtest <slug> --update`. Show the old and new final hash when you do.

In `smoke` mode there is nothing to re-record: the script is hand-written. If the smoke script no longer exercises the part that matters, say so and propose the specific edit to `replays/smoke.json`.

Fallback: if something can't be checked this way (e.g. an interaction the smoke replay never reaches, or a visual question the screenshots don't answer), you may use the Playwright MCP browser against `pnpm dev <slug>` to look. Say you did, and why. It supplements this check; `pnpm verify` still decides whether a change is done.

Do not edit game code while running this skill.
