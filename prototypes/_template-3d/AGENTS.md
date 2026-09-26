# _template-3d

Validates: the 3D workspace boots and a fixed-tick real-time sim is fully
deterministic.

Renderer: three.js (graybox primitives) in src/main.ts and src/view/**.
Testing: replay — deterministic, checked against checkpoint hashes.
Rules in src/sim.ts (placeholder collect-em-up, one player, one arena).
Vector math: src/vec.ts, plain {x,y,z} objects — never THREE.Vector3.
Config: config/sim.json, config/replay.json, config/verify.json,
config/ui.json. Theme: config/theme.json. Invariants: src/invariants.ts.
Smoke replay: replays/smoke.json, recorded by src/smoke.ts.
Batch metrics: src/metrics.ts, wired for `pnpm sim` by src/batch.ts.

Done when:
- `pnpm test` passes: 20 seeds replay to identical checkpoint hashes,
  which is the claim that a real-time sim can be replay-tested at all.
- `pnpm playtest _template-3d` passes: hashes match and the screenshots
  show the arena, not a blank frame.
- `pnpm dev _template-3d` plays a full run with no console errors.

Local rules:
- Every tick is an action: `{ type: "tick", input: { moveX, moveZ } }`.
  Step length is config.tickMs, never the frame's dt. main.ts drives it
  with createFixedStep/advance from @proto/core.
- three.js is allowed in src/main.ts and src/view/** only. src/sim.ts
  uses plain {x,y,z}: hashState throws on class instances.
- The sim uses only +, -, *, / and Math.sqrt/min/max/abs. Math.sin,
  cos, pow and exp are not exactly specified and would break replays.
- Colours reach WebGL as JS values read from config/theme.json, because
  CSS custom properties do not. src/view/scene.ts re-applies them when
  the tuning panel edits a colour.
- Run a specific layout with `?seed=<uint32>`; the seed is logged on
  start, and the full session JSON is logged when a run ends.
- The designer layer (tuning panel, version stamp, note box, theme,
  back link) comes from @proto/ui and is wired in src/main.ts only.
  Ticking pauses while the panel or the note box is open.
