# 01-cozy-solitaire

Validates: Does an unhurried, forgiving Klondike keep someone playing a second and third deal in one sitting?

Renderer: plain DOM (no Phaser/Pixi; the board is cards in a grid).
Testing: replay — deterministic, checked against checkpoint hashes.
Rules in src/sim.ts — Klondike, one player, draw one, unlimited passes.
Config: config/sim.json, config/replay.json, config/verify.json,
config/ui.json. Theme: config/theme.json. Invariants: src/invariants.ts.
Smoke replay: replays/smoke.json, recorded by src/smoke.ts.
Batch metrics: src/metrics.ts, wired for `pnpm sim` by src/batch.ts.

Done when:
- 20 seeded deals sweep clean: deck conserved, no invalid states, same
  seed gives the same hashes, replays reproduce.
- `pnpm sim` reports a win rate for the greedy bot, so a tuning change
  can be argued from a number rather than a feeling.
- Three people each play three deals in a sitting and say whether they
  wanted a fourth. That is the question above; nothing automated
  answers it.
- docs/design.md is current.

Local rules:
- Cards are integers: suit = card / ranks, rank = card % ranks, rank 0
  is the ace. Colour is suit % 2, so suits 0 and 2 share a colour and
  1 and 3 share the other. Suit symbols and rank letters are renderer
  business and live in src/main.ts, not in the sim or in config.
- The bot in src/bot.ts is greedy, not optimal. Its win rate is a floor:
  a deal it wins is certainly winnable, a deal it loses may not be.
  Never quote it as "the" win rate.
- moveLimit is a safety net so every deal terminates, not a rule anyone
  should hit. Raising it from 500 to 1500 changed no outcome.
- Undo in the renderer replays the deal minus its last action. It still
  goes through applyAction only; do not add a rewind to the sim.
