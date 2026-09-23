# _template

Validates: the workspace boots and the template sim is fully deterministic.

Renderer: plain DOM placeholder (Phaser/PixiJS chosen per prototype).
Rules in src/sim.ts (placeholder two-player card game, hotseat).
Config: config/sim.json, config/replay.json. Theme: config/theme.json.

Done when:
- `pnpm test` passes: 20 seeds replay to identical checkpoint hashes.
- `pnpm dev _template` plays a full game with no console errors.

Local rules:
- Run a specific deal with `?seed=<uint32>`; the seed is logged on start,
  and the full replay JSON is logged when a game ends.
