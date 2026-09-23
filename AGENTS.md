# Game Prototypes

Throwaway HTML5 prototypes that test whether game systems are fun before
building in Unity. Prototypes are disposable. Full plan: docs/PLAN.md.

## Commands
- pnpm dev <slug> / pnpm test / pnpm typecheck
- pnpm playtest <slug>   headless seeded replay + screenshots
- pnpm sim <slug> --seeds N   batch bot matches, balance metrics
- pnpm new-proto <slug> / pnpm log-change <slug>
- pnpm verify            must pass before any change is done
- pnpm playtest <slug> --update   re-record replays/smoke.json, only
  after an intentional rules change; say so and show the hash diff
- Playwright MCP (browser) is a fallback for checks pnpm playtest
  can't make. Say when you used it; it never replaces pnpm verify.

## Rules
- Game logic lives in src/sim.ts and packages/*. It must not import
  Phaser, PixiJS, or the DOM, and must not call Math.random().
- Use the seeded RNG from @proto/core. Record the seed of every run.
- State changes only via applyAction(state, playerId, action).
  Clients see state only via viewFor(state, playerId).
- Every tunable number lives in config/*.json. No magic numbers.
- Visual tokens live in config/theme.json. Keep visuals rough.
- The designer layer (tuning panel, version stamp, note box, theme)
  comes from @proto/ui and is wired in src/main.ts only. Hotkeys and
  slider ranges live in config/ui.json. @proto/ui is the one package
  allowed the DOM; it holds no game rules.
- Do not add dependencies without asking.
- Do not add code to packages/ unless it is already duplicated in
  two prototypes, or the user says it is a deliberate shared system.
- A change is done only when pnpm verify passes. Report its output.
- After a verified, pushed change, run pnpm log-change <slug>.
- Never commit. Do not run git commit, git push, or any command that
  creates a commit. Leave all changes staged/unstaged for the user to
  review and commit themselves.

## Cross-platform
- Scripts in tools/scripts/ are Node or TypeScript, never bash.
- Import paths must match file name casing exactly. macOS is
  case-insensitive; CI is not.
- Hook commands call pnpm scripts only, never shell one-liners.

Each prototype has its own AGENTS.md with what it validates.
