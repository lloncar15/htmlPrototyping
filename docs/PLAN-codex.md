# Codex Setup — for a Codex agent

**Who runs this:** a Codex agent, after Stage 4 of `docs/PLAN.md` is finished in Claude Code.

**Why a Codex agent does this part:** Codex's configuration format, sandbox rules, and MCP setup change between releases. Codex can check its own current documentation, confirm what it actually loaded, and prove parity by running the same smoke tasks Claude Code already passed. A different agent writing Codex config blind is the most likely way for the two tools to drift apart.

**Scope:** only Codex-specific configuration. Do not change `AGENTS.md`, skills, scripts, or game code. If a shared file needs to change for Codex to work, stop and report it instead — shared files are owned by the main plan.

---

## Context you need

- Rules: root `AGENTS.md`, plus a nested `AGENTS.md` in each prototype.
- Skills: `.agents/skills/<name>/SKILL.md` (shared with Claude Code, which reads them through a symlink).
- All real work is done by `pnpm` scripts (see `docs/PLAN.md` section 7). `pnpm verify` is the definition of done.
- Headless playtests run Playwright as a library via `pnpm playtest <slug>`; no MCP server is needed for that.

---

## Tasks

### C1 — Confirm instructions load
- Start Codex at the repo root. Confirm it has loaded root `AGENTS.md`.
- `cd prototypes/_template` and confirm the nested `AGENTS.md` is also applied.
- Report the rules you see, briefly, so the human can compare with Claude Code.

### C2 — Confirm skills are discovered
- List skills (e.g. `/skills`). All skills in `.agents/skills/` must appear.
- Confirm none fail frontmatter validation (each needs `name` and `description`).
- If any skill uses a Claude-only feature, report it; do not edit it.

### C3 — Sandbox and approvals
Configure Codex for this project so that, without prompting, it can:
- run `pnpm install`, `pnpm test`, `pnpm typecheck`, `pnpm verify`, `pnpm playtest`, `pnpm sim`, `pnpm new-proto`, `pnpm log-change`;
- write inside the repo;
- start the local Vite dev server and launch a headless browser against `localhost` (needed by `pnpm playtest`).

It must still ask before: `git push`, adding dependencies, network access beyond localhost and the package registry, and anything outside the repo.

Use project-scoped configuration if the installed Codex version supports it (commit it under `.codex/`); otherwise document the user-level settings needed in `docs/agent-setup.md`. Check the current Codex docs for the exact keys rather than relying on memory.

### C4 — MCP (optional)
- Add Playwright MCP for interactive exploration, matching the Claude Code setup. Use the current Codex method (`codex mcp add …` or the config file).
- Confirm it connects and can open `pnpm dev`'s URL.

### C5 — Parity smoke tests
Run each task exactly as a human would phrase it and confirm the result matches Claude Code's:

1. "Run the playtest skill on the template." → `pnpm playtest _template` passes; screenshots written.
2. "Create a prototype called 99-codex-smoke that validates whether a coin-flip loop is fun." → scaffolded, registered in launcher, `pnpm verify` passes.
3. "Change the starting coins in 99-codex-smoke to 7 using a tuning pass." → only `config/*.json` changed; metrics reported.
4. Deliberately break `99-codex-smoke/src/sim.ts` → `pnpm verify` fails and the commit is blocked by the git hook.
5. Delete `99-codex-smoke` and leave the tree clean.

### C6 — Document
Add a **Codex** section to `docs/agent-setup.md`:
- Codex version tested.
- Config files and their location, or user-level settings required.
- How to invoke skills (`$skill-name`) and list them.
- MCP setup commands.
- Any differences from Claude Code found during C5.

---

## Done when

- [ ] C1–C5 pass with evidence (command output) in your final report.
- [ ] No shared files (`AGENTS.md`, skills, scripts, source) were changed.
- [ ] `docs/agent-setup.md` has a Codex section.
- [ ] `git status` is clean apart from Codex config and the doc update, committed together.
