---
name: new-prototype
description: Create a new prototype from the template, fill in what it validates and when it is done, and register it in the launcher. Use when asked to start, create, or scaffold a new prototype or game idea. Do not use to copy or fork an existing prototype, or for games whose fun is in controls and feel.
---

# New prototype

1. Get two things from the user if they weren't given: a slug like `03-market-day` (number, dash, lowercase words) and the one question the prototype answers, phrased so a playtest can answer yes or no.
2. Check the genre gate (docs/PLAN.md section 1). If the fun is in feel (platformer, action, physics, 3D, controller timing), say it belongs in Unity and stop unless the user insists.
3. Run `pnpm new-proto <slug>`. If that script is not in the root `package.json`, stop and say it arrives in Stage 5 of docs/PLAN.md. Do not scaffold by hand.
4. In `prototypes/<slug>/AGENTS.md`, fill in `Validates:` with the question and `Done when:` with measurable conditions. Leave the rest of the template as is.
5. Run `pnpm verify` and report its final line.
6. Tell the user how to open it: `pnpm dev <slug>`.
