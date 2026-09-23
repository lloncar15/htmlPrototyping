# Agent Setup

Claude Code and Codex follow the same rules (`AGENTS.md`) and share the same skills (`.agents/skills/`). This file covers only what is specific to each tool. Git hooks and Git app setup are in `docs/HOW-TO-USE.md`.

---

## Claude Code

Tested with Claude Code 2.1.185 (CLI and desktop app).

### Instructions

Every `CLAUDE.md` contains one line, `@AGENTS.md`, so Claude reads the same rules as Codex. Nested prototype `AGENTS.md` files load when Claude works in that folder.

### Skills

`.claude/skills` is a symlink to `../.agents/skills`. Invoke a skill by name (`/playtest`, `/new-prototype`, …), or just describe the task and Claude picks the skill. Type `/` in a session to see them all.

| Skill | Wraps | Available |
|---|---|---|
| playtest | `pnpm playtest <slug>` | now |
| extract-design-doc | reads code + config | now |
| extract-shared-module | moves duplicated code into `packages/` | now |
| port-to-unity | transliterates sim + tests to C# | now |
| new-prototype | `pnpm new-proto <slug>` | Stage 5 |
| tuning-pass | `pnpm sim <slug> --seeds N` | Stage 5 |
| log-change | `pnpm log-change <slug>` | Stage 5 |

The Stage 5 skills stop and say so if their command doesn't exist yet.

**Windows:** Git only creates the symlink if symlinks are enabled. Turn on Developer Mode, then in the repo run `git config core.symlinks true` and `git checkout -- .claude/skills`. If `.claude/skills` is a small text file instead of a folder, this is why.

### Settings (`.claude/settings.json`, committed)

Permissions:

- **Allowed without asking:** `pnpm install`, `dev`, `test`, `typecheck`, `check-rules`, `playtest`, `sim`, `verify`, `new-proto`, `log-change`, `format`, and `git status` / `diff` / `log`.
- **Always asks:** `pnpm add`, `pnpm remove`, and `pnpm playtest <slug> --update` (it re-records the smoke replay, so it should only follow an intentional rules change).
- **Denied:** `git commit`, `git push`, `git reset --hard`, `git clean`, `rm -rf`, and reading `.env` files. The user commits and pushes; agents never do.

Hooks, which call pnpm scripts only:

- **PostToolUse on Edit/Write** runs `pnpm format:edited`, which formats the file Claude just edited with Prettier. It skips Markdown, `.claude/`, generated replays, and anything outside the repo, and never blocks Claude.
- **Stop** runs `pnpm agent:status`, which shows `git status --short` when Claude finishes, so you can see what's left to review and commit.

Personal overrides go in `.claude/settings.local.json` (gitignored). "Always asks" and "denied" rules in the project file take priority over a personal "allowed" rule.

To review or temporarily disable hooks, use `/hooks` in a Claude Code session.

### MCP: Playwright (fallback)

`.mcp.json` registers the Playwright MCP server (`npx @playwright/mcp@latest`, downloaded from npm on first use). Claude asks you to approve it the first time you start a session in the repo.

It's a **fallback**: agents use `pnpm playtest` first and reach for the MCP browser only when the scripted replay can't check something (an interaction the smoke replay never reaches, a visual question the screenshots don't answer). They must say when they used it. `pnpm verify` still decides whether a change is done.

To add it again or remove it:

```
claude mcp add --scope project playwright -- npx @playwright/mcp@latest
claude mcp remove playwright -s project
```

### Checking the setup

Start a fresh session at the repo root and run `/playtest` on `_template`. It should report `playtest _template: PASS`.

---

## Codex

_Not written yet. A Codex agent fills this in by following `docs/PLAN-codex.md`._
