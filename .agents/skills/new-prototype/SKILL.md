---
name: new-prototype
description: Create a new prototype from the template, choose its renderer and testing mode, fill in what it validates and when it is done, and register it in the launcher. Use when asked to start, create, or scaffold a new prototype or game idea, 2D or 3D. Do not use to copy or fork an existing prototype.
---

# New prototype

1. Get two things from the user if they weren't given: a slug like `03-market-day` (number, dash, lowercase words) and the one question the prototype answers, phrased so a playtest can answer yes or no.
2. Ask two more, unless the user already said: **2D or 3D**, and **`replay` or `smoke`** (docs/PLAN.md section 1). Recommend, don't decide:
   - `replay` when the fun is in rules and numbers. It is deterministic and auto-tested against checkpoint hashes, so `pnpm verify` can actually tell the user something broke.
   - `smoke` when the fun is in movement or feel, or when physics makes hashes drift. Playtest then only checks that it boots, runs and renders; judging the game is the user's job.
   - Say the trade out loud: `smoke` buys the ability to prototype feel, and costs the automated safety net and the Unity sim port (section 12).
3. Run `pnpm new-proto <slug>`, adding `--3d` for a 3D prototype and `--smoke` for smoke mode. If that script is not in the root `package.json`, stop and say it arrives in Stage 5 of docs/PLAN.md. If `--3d` or `--smoke` is not supported yet, stop and say it arrives in Stage 9. Do not scaffold by hand.
4. In `prototypes/<slug>/AGENTS.md`, fill in `Validates:` with the question and `Done when:` with measurable conditions. Check that `Renderer:` and `Testing:` match what was chosen, and that `Testing:` matches `"mode"` in `config/verify.json`. Leave the rest of the template as is.
5. Run `pnpm verify` and report its final line.
6. Tell the user how to open it: `pnpm dev <slug>`, or `pnpm dev` and click it in the launcher.

Physics (Rapier) is opt-in and a new dependency, so ask before adding it. A prototype using it stays in `smoke` mode.
