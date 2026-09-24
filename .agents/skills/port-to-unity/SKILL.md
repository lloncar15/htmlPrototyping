---
name: port-to-unity
description: Prepare a graduated prototype for Unity by transliterating its pure sim, config, and deterministic tests to C#. Use when a prototype has graduated and the user asks to port it or prepare the Unity handoff. Do not use for prototypes that haven't graduated, or to port rendering, input, or UI code.
---

# Port to Unity

1. Check the prototype's testing mode (`Testing:` in its AGENTS.md, `"mode"` in `config/verify.json`). **Only `replay`-mode sims are transliterated.** For a `smoke`-mode prototype, say so and stop: hand over `docs/design.md`, `config/*.json` as a starting point, and the build-fresh-in-Unity list, but no sim port — nothing proved the sim behaves identically run to run, and its feel numbers do not transfer. If the user wants it ported, the prototype has to move to `replay` mode and earn the checklist first.
2. Check the graduation checklist in docs/PLAN.md section 12 against the prototype, and report each item as met, not met, or unknown. If any item isn't met, stop and ask the user whether to continue anyway.
3. Ask where the Unity project is. The port goes in that separate repository, never in this one.
4. Port, keeping behaviour identical:
   - `src/sim.ts` becomes plain C# (no `UnityEngine` in the rules), with `ApplyAction` and `ViewFor`.
   - The RNG (`packages/core/src/rng.ts`: sfc32 seeded by splitmix32) and state hash (canonical JSON + cyrb64 in `hash.ts`), bit for bit, using `uint` arithmetic.
   - `config/*.json`, copied unchanged.
   - Tests as NUnit: the golden RNG sequence and golden hash from `packages/core` tests, plus each replay in `replays/` and `sessions/`, which must reach the same checkpoint hashes.
5. For a 3D prototype, convert at the port boundary and nowhere else: three.js is right-handed and Unity is left-handed, both Y-up, so **negate Z** on every position and direction, and flip the sign of rotations about X and Y. Do this in the Unity-side view layer, not inside the ported sim — the sim must keep producing the same hashes as the browser one. Note the convention in the handoff so nobody converts twice.
6. Don't port `main.ts`, `src/view/**`, the renderer, input, or tools. List them, with every feel, animation, and input system, as "build fresh in Unity".
7. Report which tests pass in Unity, and any hash that doesn't match along with the first checkpoint where it diverges.
