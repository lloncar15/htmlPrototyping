---
name: tuning-pass
description: Change a prototype's numbers (config/*.json only) and measure the effect with batch bot matches, reporting metrics before and after. Use for balance or tuning requests like "make X cheaper" or "see what happens if Y is 7". Do not use when the request needs new rules or code changes; say so instead.
---

# Tuning pass

1. If the prototype or the change wasn't named, ask.
2. Run `pnpm sim <slug> --seeds 200` and keep its metrics as the baseline. If `sim` is not in the root `package.json`, stop and say it arrives in Stage 5 of docs/PLAN.md.
3. Edit only files in `prototypes/<slug>/config/`, not `theme.json` unless asked. If the change can't be made through config, stop and explain what code change it would need.
4. Increase `version` in each config file you changed, so replays and logs show which numbers were in effect.
5. Run the same `pnpm sim` command again.
6. Report a before/after table of the metrics that moved, plus the exact config diff.
7. Run `pnpm verify`. A tuning change usually changes the smoke replay's hashes: report that, and ask before running `pnpm playtest <slug> --update`.
