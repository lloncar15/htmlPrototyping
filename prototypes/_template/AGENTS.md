# _template

Validates: the workspace boots and the template sim is fully deterministic.

Renderer: plain DOM placeholder (Phaser/PixiJS chosen per prototype).
Rules in src/sim.ts (placeholder two-player card game, hotseat).
Config: config/sim.json, config/replay.json, config/verify.json,
config/ui.json. Theme: config/theme.json. Invariants: src/invariants.ts.
Smoke replay: replays/smoke.json, recorded by src/smoke.ts.
Batch metrics: src/metrics.ts, wired for `pnpm sim` by src/batch.ts.

Done when:
- `pnpm test` passes: 20 seeds replay to identical checkpoint hashes.
- `pnpm dev _template` plays a full game with no console errors.

Local rules:
- Run a specific deal with `?seed=<uint32>`; the seed is logged on start,
  and the full session JSON (replay + notes) is logged when a game ends.
- The designer layer (tuning panel, version stamp, note box, theme) comes
  from @proto/ui and is wired in src/main.ts only. Hotkeys and slider
  ranges live in config/ui.json — no hotkey or bound in code.
- This is the file every new prototype is copied from. A change here is a
  change to every prototype made after it.
