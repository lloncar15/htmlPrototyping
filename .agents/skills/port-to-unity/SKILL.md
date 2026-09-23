---
name: port-to-unity
description: Prepare a graduated prototype for Unity by transliterating its pure sim, config, and deterministic tests to C#. Use when a prototype has graduated and the user asks to port it or prepare the Unity handoff. Do not use for prototypes that haven't graduated, or to port rendering, input, or UI code.
---

# Port to Unity

1. Check the graduation checklist in docs/PLAN.md section 12 against the prototype, and report each item as met, not met, or unknown. If any item isn't met, stop and ask the user whether to continue anyway.
2. Ask where the Unity project is. The port goes in that separate repository, never in this one.
3. Port, keeping behaviour identical:
   - `src/sim.ts` becomes plain C# (no `UnityEngine` in the rules), with `ApplyAction` and `ViewFor`.
   - The RNG (`packages/core/src/rng.ts`: sfc32 seeded by splitmix32) and state hash (canonical JSON + cyrb64 in `hash.ts`), bit for bit, using `uint` arithmetic.
   - `config/*.json`, copied unchanged.
   - Tests as NUnit: the golden RNG sequence and golden hash from `packages/core` tests, plus each replay in `replays/` and `sessions/`, which must reach the same checkpoint hashes.
4. Don't port `main.ts`, the renderer, input, or tools. List them, with every feel, animation, and input system, as "build fresh in Unity".
5. Report which tests pass in Unity, and any hash that doesn't match along with the first checkpoint where it diverges.
