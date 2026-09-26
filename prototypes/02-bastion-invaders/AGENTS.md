# 02-bastion-invaders

Validates: Does Space Invaders still read and play clearly from a Bastion-style tilted isometric camera, on a floating diorama that assembles itself from tiles?

Renderer: three.js in src/main.ts and src/view/** — stylized graybox (primitives, flat shading) plus a light post chain (bloom, vignette, OutputPass), agreed because the question is partly about the look.
Testing: replay — deterministic, checked against checkpoint hashes.
Rules in src/sim.ts (one wave of invaders, bunkers, three lives).
Config: config/sim.json, config/replay.json, config/verify.json,
config/ui.json. Theme: config/theme.json. Invariants: src/invariants.ts.
Smoke replay: replays/smoke.json, recorded by src/smoke.ts.
Batch metrics: src/metrics.ts, wired for `pnpm sim` by src/batch.ts.

Done when:
- `pnpm verify` passes: 20 seeded full runs with no invariant failures,
  identical hashes on re-run, and the smoke replay matches.
- `pnpm playtest 02-bastion-invaders` screenshots show the island, the
  formation and the bunkers in every frame after the island has risen.
- `pnpm sim 02-bastion-invaders --seeds 50`: the random bot clears the
  wave in 5–40% of runs (the game is winnable, but not by accident).
- Three playtesters each finish at least one wave and answer the
  Validates question; notes are logged with the note box (N).
- docs/design.md is current

Local rules:
- Every tick is an action: `{ type: "tick", input: { moveX, fire } }`.
  Step length is config.tickMs, never the frame's dt.
- Shots are tested along the segment they swept in a tick
  (`firstHit`), so no speed setting lets them tunnel through targets.
- The view is timed in ticks (`tick + alpha`), never wall-clock ms: the
  island assembly, march hop, debris and camera shake are all functions
  of the tick clock, so playtest screenshots repeat. View "randomness"
  is `hash01` in src/view/scene.ts, never Math.random().
- Colours, lights and post numbers are theme tokens; camera, island
  shape, effect timings and render toggles are in config/ui.json.
