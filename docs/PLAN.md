# Game Prototypes Repo — Plan

This repo holds throwaway HTML5 prototypes used to find out whether a game's *systems* are fun before building the real game in Unity. Prototypes are disposable. What survives a prototype is validated design knowledge: a design doc, tuning data, an action schema, and test cases.

The repo is agent-agnostic. Claude Code and Codex follow the same rules from the same files. Anything specific to Codex lives in `docs/PLAN-codex.md` and is set up by a Codex agent. Humans should read `docs/HOW-TO-USE.md`.

---

## 1. When to use this repo (the genre gate)

Decide per game, before starting a prototype.

**Prototype here** when the fun lives in rules and numbers: card and deck-builders, turn-based tactics, roguelike systems, idle/incremental, puzzle, economy/management, UI-heavy and narrative games.

**Do not prototype here** when the fun lives in feel: platformers, action, anything 3D, physics-driven, controller-driven, or VR. Game feel (input latency, coyote time, hit-stop, physics constants, animation timing) is tuned against a specific engine and does not transfer. Graybox those directly in Unity.

Rule of thumb: this repo answers "are the systems fun?", never "does it feel good to control?"

---

## 2. Core decisions

- **Stack:** pnpm workspaces, Vite, TypeScript (`strict`). Phaser is the default renderer; PixiJS when a prototype wants a thin renderer over its own logic. Avoid physics libraries for anything feel-related.
- **Logic is pure.** Game rules live in a deterministic simulation with no renderer, DOM, or `Math.random()` imports. The renderer is a shell around it.
- **Numbers live in JSON.** All tuning in `config/*.json`, hot-reloaded, never hard-coded. JSON carries over to Unity verbatim.
- **Verification lives in the repo, not the agent.** `pnpm verify` decides whether work is acceptable. Git hooks and CI run it for every change, whoever made it.
- **One source of agent rules.** `AGENTS.md` everywhere; `CLAUDE.md` files contain only `@AGENTS.md`.
- **Shared code is earned.** Packages hold only code that is already reused, or a domain system a programmer has deliberately designed for reuse (see 5.5).
- **Everything a designer needs works without an agent and without a code editor.**

---

## 3. Repository layout

```
game-prototypes/
├── AGENTS.md                    # all agent rules (source of truth)
├── CLAUDE.md                    # contains only: @AGENTS.md
├── CHANGELOG.md                 # shared-package changes only
├── package.json                 # workspace scripts (section 7)
├── pnpm-workspace.yaml          # packages: ["prototypes/*", "packages/*", "tools/*"]
├── tsconfig.base.json
├── lefthook.yml                 # git hooks -> pnpm verify
├── .github/workflows/verify.yml # CI -> pnpm verify
├── .agents/skills/              # canonical skills (both agents)
├── .claude/
│   ├── skills -> ../.agents/skills   # symlink
│   └── settings.json            # Claude-only conveniences
├── .codex/                      # Codex-only conveniences (see PLAN-codex.md)
├── packages/
│   ├── core/                    # RNG, fixed timestep, state hashing, replay
│   ├── testkit/                 # seeded sim runner, invariant helpers, bots
│   ├── ui/                      # tuning panel, debug overlay, note box, theme loader
│   ├── net/                     # transports + room server (only when needed)
│   └── card-engine/             # event-based resolution (when written)
├── tools/
│   ├── scripts/                 # new-proto, log-change, playtest runner
│   └── launcher/                # index page listing every prototype
├── prototypes/
│   ├── _template/
│   └── 01-<slug>/
└── docs/
    ├── PLAN.md                  # this file
    ├── PLAN-codex.md            # Codex-only setup
    ├── HOW-TO-USE.md            # human guide
    └── agent-setup.md           # per-tool MCP/settings notes (written in Stage 4)
```

**Prototype layout** (`prototypes/_template/`):

```
AGENTS.md            # what this prototype validates, done-when, local rules
CLAUDE.md            # @AGENTS.md
README.md            # plain-language: what it tests, how to play, what's fake
CHANGELOG.md
index.html
src/main.ts          # renderer + input only
src/sim.ts           # pure rules
config/*.json        # tuning
config/theme.json    # palette, type, spacing
replays/smoke.json   # seeded replay used by playtest
sessions/            # multiplayer session logs
docs/design.md       # grows into the Unity handoff
docs/visual-direction.md
```

---

## 4. Architecture rules

1. `src/sim.ts` and `packages/*` logic import nothing from Phaser, PixiJS, or the DOM.
2. All randomness goes through the seeded RNG in `@proto/core`. Every run records its seed.
3. Simulation advances on a fixed timestep (or discrete turns). Rendering never mutates sim state.
4. State changes only through `applyAction(state, playerId, action)`. Actions are plain JSON.
5. Clients see state only through `viewFor(state, playerId)`, which redacts hidden information.
6. The same seed + config version + action list must always produce the same state hash.
7. Tuning values live in `config/*.json`. Visual tokens live in `config/theme.json`.
8. Keep prototypes small. Past roughly 2,000 lines or a few weeks, graduate it or kill it.

---

## 5. Shared packages

### 5.1 `@proto/core`
Seeded, serializable PRNG; fixed-timestep loop; stable state hashing; replay record/playback. Nothing game-specific.

### 5.2 `@proto/testkit`
Runs a sim headlessly across N seeds, checks invariants (no NaNs, conservation rules, no invalid states), compares checkpoint hashes, and provides bot policies (random-legal, scripted) for batch simulation.

### 5.3 `@proto/ui`
Tuning panel (Tweakpane) bound to `config/*.json` with an "Export JSON" button; debug overlay; hotkey note box for playtests; build/config version stamp; theme loader.

### 5.4 `@proto/net` (build only for the first PvP prototype)
One transport interface, three implementations:
- `memory` — all players in one process; used by every automated test.
- `local` — WebSocket over LAN.
- `remote` — the same server deployed, joined by room code.

The room server imports the prototype's `sim.ts` unchanged. One room, two seats, optional spectator who sees both hands. No accounts, matchmaking, lobbies, or reconnection logic; refreshing rejoins by code. Time-box to one or two days.

### 5.5 `@proto/card-engine` (and other deliberate domain systems)
Allowed in `packages/` even before a second consumer exists, because a programmer designed it for reuse. Conditions:
- Its own package, not folded into `core`.
- Its own tests and `CHANGELOG.md`.
- Versioned once a second prototype depends on it; prototypes pin versions.
- Owns resolution order, the event queue/stack, triggers, and priority. Individual card effects stay in each prototype.
- Written to port: pure, explicit event queue, no closures over renderer state. It is the most valuable thing in the repo to transliterate to C#.

---

## 6. Agent rules and skills

### 6.1 Instruction files
`AGENTS.md` is the only place rules are written. Every `CLAUDE.md` contains one line: `@AGENTS.md`. This works on every Claude Code version and deployment; Codex reads `AGENTS.md` natively and concatenates nested files from root to leaf.

Keep root `AGENTS.md` under ~150 lines. For each line ask: would the agent get this wrong without it? Grow the file from real mistakes, not speculation. Starter content is in Appendix A.

### 6.2 Skills
Canonical location: `.agents/skills/<name>/SKILL.md` (read by Codex). `.claude/skills` is a symlink to it (read by Claude Code).

Portability rules for every skill:
- Frontmatter has both `name` and `description`. The description says when to use it *and when not to*.
- No tool-specific features (`allowed-tools`, `$ARGUMENTS`). Ask for arguments in plain words.
- The real work is a script in `tools/scripts/` or beside the skill. The skill says "run this, interpret the output". That way designers can run the same thing without an agent.

| Skill | Wraps | Purpose |
|---|---|---|
| `new-prototype` | `pnpm new-proto <slug>` | Scaffold from `_template`, fill the validate/done-when lines, register in launcher |
| `playtest` | `pnpm playtest <slug>` | Headless seeded replay, screenshots, console errors, hash check |
| `tuning-pass` | `pnpm sim <slug> --seeds N` | Change only `config/*.json`, report metric deltas before/after |
| `log-change` | `pnpm log-change <slug>` | Append a verified changelog entry |
| `extract-design-doc` | — | Refresh `docs/design.md` from sim + config |
| `extract-shared-module` | — | Move already-duplicated code into `packages/` |
| `port-to-unity` | — | Transliterate pure sim + config + tests to C# |

Example (`.agents/skills/playtest/SKILL.md`):

```markdown
---
name: playtest
description: Run a prototype headlessly with its seeded smoke replay, capture screenshots and console errors, and report pass or fail. Use after any gameplay or UI change, or when asked to playtest or verify a prototype. Do not use for balance analysis; use tuning-pass for that.
---
# Playtest
1. If the prototype was not named, ask which one.
2. Run `pnpm playtest <slug>`. It starts the dev server, replays
   `replays/smoke.json`, saves screenshots to `.screens/`, and exits
   non-zero on failure.
3. Read the JSON report it prints: console errors, invariant failures,
   final hash vs expected.
4. If you can view images, check the screenshots for obvious rendering
   problems (blank canvas, overlapping UI, missing elements).
5. Report pass or fail with the specific evidence.
Do not edit game code while running this skill.
```

---

## 7. Commands (identical for humans and agents)

| Command | Does |
|---|---|
| `pnpm dev` | Launcher with every prototype |
| `pnpm dev <slug>` | One prototype, hot reload |
| `pnpm dev:lan <slug>` | Same, reachable on the local network |
| `pnpm room` | Local multiplayer room server |
| `pnpm test` | All unit and sim tests |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |
| `pnpm playtest <slug>` | Headless seeded replay + screenshots |
| `pnpm sim <slug> --seeds N` | Batch bot matches, prints balance metrics |
| `pnpm verify` | typecheck + test + playtest for changed prototypes |
| `pnpm new-proto <slug>` | Scaffold a prototype |
| `pnpm log-change <slug>` | Append a changelog entry interactively |

`pnpm playtest` uses Playwright as a library, so it runs without any MCP server. Playwright MCP is optional, for interactive exploration by an agent.

---

## 8. Verification

A change is done only when `pnpm verify` passes. Layers, fastest first:

1. **Typecheck.**
2. **Deterministic sim tests** — N seeds per prototype, invariants hold, checkpoint hashes match.
3. **Hidden-information tests** (PvP) — `viewFor(p)` never contains another player's private data.
4. **Headless playtest** — seeded replay in a real browser, screenshots, zero console errors.
5. **Multi-client test** (PvP) — one Playwright test opening two browser contexts over the `memory` or `local` transport.

Enforcement: `lefthook` runs `pnpm verify` on commit; CI runs it on push. Agent hooks, if any, only call these commands.

**Replay format** (`replays/*.json`): `{ buildHash, configVersion, seed, timestep, actions: [...], checkpointHashes }`. A seed alone is not enough — config version and action order are part of the contract.

---

## 9. Changelogs

One `CHANGELOG.md` per prototype; the root one covers shared packages. Entries are written **after** `pnpm verify` passes and the change is pushed, via `pnpm log-change`. Newest first.

```markdown
## 2026-09-20 — cards@13
- Ember Scout cost 3 → 2. Early lane pressure was unanswerable (session a7f3, turn 6).
- Added mulligan-to-5. Unverified with two players.
```

Each entry has: date, config version, one line per change with the *why*, a session reference when a playtest motivated it, and an explicit "unverified" note where true.

---

## 10. Designer-friendly layer

- **Launcher** — one URL, every prototype listed with its one-line "validates" goal.
- **Tuning panel** — live sliders bound to config, "Export JSON" to save. Designers never need to edit code.
- **Per-prototype README** — what it tests, how to play, controls, what is fake.
- **Version stamp** — build hash and config version always visible in a corner.
- **Note box** — hotkey (`N`) opens a text box; notes are stamped with the turn and saved to the session log.
- **Visual direction** — `docs/visual-direction.md` holds reference images, mood, tone, and what the game should *not* look like, plus one aspirational "look frame" mockup. It is non-binding. Only `config/theme.json` (palette, fonts, radius, spacing) is read by code, so a designer can reskin without touching logic. Polish stays out of the prototype.

---

## 11. Multiplayer playtests (two designers, PvP)

Staged by effort; use the lowest one that works:
1. **Hotseat** — one machine, a "pass to opponent" screen hides the board between turns.
2. **LAN** — `pnpm room` + `pnpm dev:lan <slug>`; the other designer opens the LAN URL.
3. **Remote** — room server deployed to a small Node host (Fly, Railway, Render), static client anywhere, join by room code.

Between matches, the server can reload `config/*.json` so a tuning change is replayable immediately.

**Session log** — one file per match in `prototypes/<slug>/sessions/`:

```json
{
  "sessionId": "2026-09-20T14-03-11Z-a7f3",
  "buildHash": "e91c2df",
  "configVersion": "cards@12,economy@5",
  "seed": 918273645,
  "players": { "p1": "designer-a", "p2": "designer-b" },
  "startedAt": "2026-09-20T14:03:11Z",
  "endedAt": "2026-09-20T14:28:40Z",
  "result": { "winner": "p1", "turns": 17, "reason": "opponent-deckout" },
  "actions": [
    { "t": 0,    "turn": 1, "playerId": "p1", "action": { "type": "mulligan", "keep": true } },
    { "t": 4210, "turn": 1, "playerId": "p1", "action": { "type": "play", "card": "ember_scout", "lane": 2 } }
  ],
  "notes": [
    { "turn": 6, "playerId": "p2", "text": "no answer to lane pressure" }
  ],
  "checkpointHashes": { "5": "3f9a...", "10": "b104...", "final": "7cc2..." }
}
```

Every session log is a replay: it can be stepped through afterward and fed to the balance harness.

The transport code does not port to Unity. Only the sim, the config, and the action JSON schema carry over.

---

## 12. Graduation and Unity handoff

A prototype graduates only when:
- [ ] The "validates" question in its `AGENTS.md` is answered yes, with playtest evidence.
- [ ] The fun holds across repeated sessions, not just the first.
- [ ] Sim tests pass across at least 20 seeds with zero invalid states.
- [ ] No magic numbers remain in code.
- [ ] `docs/design.md` is current.
- [ ] A list exists of feel, render, input, and animation systems that must be built fresh in Unity.
- [ ] It is not a feel-driven game. If it is, it should never have been here.

Handoff artifacts:
1. `docs/design.md` — core loop, win/lose, entities, state-machine diagrams (Mermaid), tuning tables.
2. `config/*.json` — carried over unchanged.
3. Action JSON schema (PvP).
4. Pure sim and any shared domain packages — the transliteration source.
5. Deterministic tests with seeds and expected hashes — re-expressed as NUnit tests.
6. Replays and session logs — regression fixtures.
7. The build-fresh-in-Unity list.

The Unity port happens in a separate repository.

---

## 13. Build stages

Do these in order. Do not start a stage until the previous one's "done when" is true. Each stage is one agent session or a few; commit at the end of each.

### Stage 0 — Human setup
- `git init`, `.gitignore` (node_modules, dist, `.screens/`, `.claude/settings.local.json`), one-line README.
- Commit `docs/PLAN.md`, `docs/PLAN-codex.md`, `docs/HOW-TO-USE.md`.
- Create root `AGENTS.md` from Appendix A and `CLAUDE.md` containing `@AGENTS.md`.

**Done when:** the repo has one commit containing the docs and instruction files.

### Stage 1 — Workspace skeleton
- pnpm workspace, `tsconfig.base.json`, Vite.
- `prototypes/_template` renders a placeholder scene.
- `tools/launcher` lists prototypes.
- Scripts: `dev`, `typecheck`.

**Done when:** `pnpm install && pnpm dev` shows the launcher and the template boots.

### Stage 2 — `@proto/core`
- Seeded serializable RNG, fixed timestep, state hashing, replay record/playback.
- Unit tests, including "same seed → same sequence" and "replay → same hash".
- Template `sim.ts` uses it and exposes `applyAction` / `viewFor`.

**Done when:** `pnpm test` passes and the template's sim is fully deterministic.

### Stage 3 — Verification loop (the most important stage)
- `@proto/testkit` with seed sweeps, invariants, random-legal bot.
- `tools/scripts/playtest` (Playwright library): seeded replay, screenshots, JSON report, non-zero exit on failure.
- `pnpm verify`, `lefthook.yml`, CI workflow.

**Done when:** breaking the template's sim on purpose makes `pnpm verify` fail with a readable reason, and the commit is blocked.

### Stage 4 — Agent tooling (Claude Code part)
- Skills from section 6.2 in `.agents/skills/`; `ln -s ../.agents/skills .claude/skills`.
- `.claude/settings.json` (Appendix C): allow the `pnpm` commands, deny destructive ones; a PostToolUse hook that formats edited files; a Stop hook that prints `git status --short`.
- Optional: `claude mcp add --scope project playwright -- npx @playwright/mcp@latest`.
- Write the Claude section of `docs/agent-setup.md`.
- **Then hand `docs/PLAN-codex.md` to a Codex agent** for the Codex half.

**Done when:** in Claude Code, `/playtest` on the template passes; Codex's own done-when in `PLAN-codex.md` is met.

### Stage 5 — Designer layer
- `@proto/ui`: tuning panel with export, version stamp, note box, theme loader.
- `pnpm new-proto`, `pnpm log-change`, `pnpm sim`.
- Template README, `docs/visual-direction.md`, `config/theme.json`.

**Done when:** a designer can scaffold a prototype, tune it with sliders, export JSON, and log a change without opening a code editor.

### Stage 6 — First real prototype
Use `new-prototype`. Keep logic in `sim.ts`, numbers in JSON. Iterate against `pnpm verify`.

### Stage 7 — Multiplayer (only when the first PvP prototype needs it)
`@proto/net`, room server, session logging, hidden-info tests, two-context Playwright test, hotseat mode. Then LAN, then remote deploy.

**Done when:** two designers on different machines finish a match and a valid session log replays to the same final hash.

### Stage 8 — Shared domain systems
`@proto/card-engine` or similar, when a programmer writes one (section 5.5).

---

## 14. Cautions

- Don't tune feel in the browser and trust it in Unity.
- Don't build lobbies, accounts, matchmaking, or reconnection.
- Don't add speculative shared APIs. `extract-shared-module` only moves code that is already duplicated.
- Don't let visual polish into prototype code. Direction lives in docs; tokens live in `theme.json`.
- Keep agent sessions scoped to one stage or one change. Start fresh sessions often; the plan lives on disk.
- Identical rules don't produce identical behaviour across models. `pnpm verify` is the arbiter, not the agent's report.
- Agent tooling changes fast. Re-check skill locations and AGENTS.md support when upgrading either tool.

---

## Appendix A — Root `AGENTS.md` (starter)

```markdown
# Game Prototypes

Throwaway HTML5 prototypes that test whether game systems are fun
before building in Unity. Prototypes are disposable. Full plan: docs/PLAN.md.

## Commands
- pnpm dev <slug> / pnpm test / pnpm typecheck
- pnpm playtest <slug>   headless seeded replay + screenshots
- pnpm verify            must pass before any change is done

## Rules
- Game logic lives in src/sim.ts and packages/*. It must not import
  Phaser, PixiJS, or the DOM, and must not call Math.random().
- Use the seeded RNG from @proto/core. Record the seed of every run.
- State changes only via applyAction(state, playerId, action).
  Clients see state only via viewFor(state, playerId).
- Every tunable number lives in config/*.json. No magic numbers.
- Visual tokens live in config/theme.json. Keep visuals rough.
- Do not add dependencies without asking.
- Do not add code to packages/ unless it is already duplicated in
  two prototypes, or the user says it is a deliberate shared system.
- A change is done only when pnpm verify passes. Report its output.
- After a verified, pushed change, run pnpm log-change <slug>.

Each prototype has its own AGENTS.md with what it validates.
```

## Appendix B — Prototype `AGENTS.md` (template)

```markdown
# <NN>-<slug>

Validates: <one question, answerable yes/no by playtesting>

Renderer: <Phaser | PixiJS>. Rules in src/sim.ts.
Config: config/<files>.json. Theme: config/theme.json.

Done when:
- <measurable condition, e.g. 20 seeded full matches with no invalid states>
- docs/design.md is current

Local rules:
- <anything specific to this game>
```

## Appendix C — `.claude/settings.json` (starter)

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm install)",
      "Bash(pnpm dev:*)",
      "Bash(pnpm test:*)",
      "Bash(pnpm typecheck)",
      "Bash(pnpm playtest:*)",
      "Bash(pnpm sim:*)",
      "Bash(pnpm verify)",
      "Bash(pnpm new-proto:*)",
      "Bash(pnpm log-change:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)"
    ],
    "ask": ["Bash(git push:*)", "Bash(pnpm add:*)"],
    "deny": ["Bash(rm -rf:*)", "Read(./.env)"]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "pnpm -s format:changed" }]
      }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "git status --short" }] }
    ]
  }
}
```

Hook and permission syntax changes between Claude Code versions; verify against the current docs when setting this up.
