---
name: extract-shared-module
description: Move code that is already duplicated in two or more prototypes into a shared package in packages/. Use when asked to deduplicate or share code between prototypes. Do not use for code that exists in only one prototype, or to design a new shared API, unless the user explicitly says it is a deliberate shared system.
---

# Extract shared module

1. Find the duplication and show it to the user: file paths in each prototype and how closely they match. If it lives in only one prototype and the user hasn't called it a deliberate shared system, stop and say so (AGENTS.md rule).
2. Propose the package name (`@proto/<name>`) and the exact functions it will export. Get a yes before writing.
3. Create `packages/<name>/` following `packages/core`: `package.json` with `"exports": { ".": "./src/index.ts" }`, `src/index.ts`, tests beside the source, and a `CHANGELOG.md`.
4. Keep it pure: no DOM, no renderer, no `Math.random()`. `pnpm check-rules` enforces this.
5. Point each prototype at it (`"@proto/<name>": "workspace:*"`), delete the duplicates, and run `pnpm install`.
6. Run `pnpm verify --all`. Hashes must not change. If they do, the extraction changed behaviour: fix it rather than re-recording replays.
7. Report the moved code, the new package's API, and verify's output.
