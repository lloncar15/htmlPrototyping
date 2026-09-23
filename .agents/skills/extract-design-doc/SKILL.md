---
name: extract-design-doc
description: Refresh a prototype's docs/design.md from its actual rules (src/sim.ts), numbers (config/*.json), and invariants. Use when asked to update, write, or check the design doc, and before a prototype graduates. Do not use to design new features or to change code.
---

# Extract design doc

1. If the prototype wasn't named, ask.
2. Read `src/sim.ts`, `src/invariants.ts`, every `config/*.json`, `AGENTS.md`, and the existing `docs/design.md` if there is one.
3. Write or update `prototypes/<slug>/docs/design.md` with these sections, describing what the code actually does:
   - Core loop, and the win and lose conditions.
   - Entities and their state.
   - Actions: each one, who can take it, when it is legal, and what it changes.
   - State machine as a Mermaid diagram (turns, phases, game over).
   - Hidden information: what `viewFor` shows and hides for each viewer.
   - Tuning tables: every config value, what it controls, and its current number.
   - Invariants: the rules that always hold.
4. Where the code and the existing doc disagree, the code wins. List each disagreement for the user. Don't silently change intent.
5. Mark anything you can't tell from the code as "Unknown". Don't guess.
6. Don't edit code or config.
