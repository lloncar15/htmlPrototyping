# How to Use This Repo

A guide for designers and programmers. You don't need to know how the repo is built to use it. The technical plan is in `docs/PLAN.md`.

---

## What this is

A place to make quick, rough, playable versions of game ideas in the browser, so we can find out whether a game's rules are fun before building it properly in Unity.

Three things to keep in mind:

- **Prototypes are throwaway.** Their job is to answer one question. When it's answered, the prototype has done its work.
- **Any kind of game can go here**, 2D or 3D, turn-based or real-time. What changes is how it's checked (see below).
- **Feel doesn't transfer.** How a jump feels or how a hit lands can be tried here, but the numbers behind it have to be re-tuned in Unity. What carries over cleanly is rules and balance.
- **Visuals are rough on purpose.** We keep a visual direction for mood, but polish slows iteration down.

### The two testing modes

Every prototype is set to one of these when it's created. It's written on the first few lines of the prototype's `AGENTS.md`.

- **`replay`** — the game is fully repeatable, so the computer can check it. It replays a recorded match and fails if anything about the outcome changed. Best when the fun is in the rules: cards, strategy, economy, puzzles — and turn-based 3D too.
- **`smoke`** — the computer only checks that the game runs: it plays a short scripted input, then fails on errors or a blank screen. It can't tell you whether the game is still *right* — that's your job, by playing it. Best when the fun is in movement or feel, or when physics makes exact repeats impossible.

A prototype can move from `smoke` to `replay` later if it settles down; ask an agent.

---

## First-time setup

You need [Node.js](https://nodejs.org) (LTS version) and pnpm. After installing Node, run once:

```
corepack enable
```

Then get the repo and install:

```
git clone <repo-url>
cd game-prototypes
pnpm install
```

`pnpm install` also sets up the commit check (see "The rules of the road"). If you skip it, Git will commit without checking anything.

### If you commit from a Git app (Sourcetree, GitHub Desktop, Fork…)

The commit check works in Git apps too, but on a Mac many apps can't find `pnpm`, so **every** commit fails with `pnpm: command not found`, even good ones. Fix it once per computer:

1. In Terminal, run this and note the folder(s) it prints (for example `/opt/homebrew/bin`):

   ```
   dirname "$(command -v node)"; dirname "$(command -v pnpm)"
   ```

2. Create a file called `.lefthookrc` in your home folder, with one line using those folders (separate several with `:`):

   ```
   export PATH="/opt/homebrew/bin:$PATH"
   ```

3. Create a file called `lefthook-local.yml` in the repo folder (Git ignores it, it's just for you):

   ```
   rc: ~/.lefthookrc
   ```

4. In Terminal, in the repo folder, run:

   ```
   pnpm exec lefthook install
   ```

   This rewrites the commit check so it reads your `.lefthookrc`. Skipping this step is the usual reason the fix "doesn't work". (`pnpm install` does not always redo it.)

Commit something small from your Git app to check. If the check fails for a real reason, the app shows the same message you'd see in Terminal.

On Windows this is usually not needed.

---

## Playing a prototype

```
pnpm dev
```

Open the address it prints (usually `http://localhost:5173`). You'll see the **launcher**: a list of every prototype with the question it's testing. Each prototype runs as its own little server, so to play one, stop `pnpm dev` and run `pnpm dev <name>` instead — the launcher tells you the exact command for each.

Every prototype shows its build and config version in a corner. If you're comparing notes with someone, check you're on the same version.

Each prototype has a `README.md` explaining controls and what is currently fake or missing.

---

## Changing the numbers (tuning)

You never need to edit code to change the game's numbers.

**Using the tuning panel:** open a prototype and press the panel toggle (see the README; usually `` ` ``). Move a slider and the game restarts on the same seed with the new numbers — the same deal under the new rules. When you like the result, click **Export JSON** and save the downloaded file over the one in `prototypes/<name>/config/`.

An exported file whose numbers you changed comes back with its `version` bumped by one. That's deliberate: replays and session logs record the version, so the same version must always mean the same numbers.

**Editing directly:** open the files in `prototypes/<name>/config/` in any text editor. The game reloads when you save.

**Changing the look:** colours, fonts and spacing are in `config/theme.json`. Change those freely; the game re-skins without restarting.

**Seeing what a change did:** to measure rather than guess, run

```
pnpm sim <prototype-name> --seeds 200
```

It plays 200 games with a bot and prints who won how often, and the average, lowest and highest of whatever that prototype measures. Run it before and after a change and compare. An agent asked for a "tuning pass" does exactly this.

---

## Playtesting with another designer

**Same computer:** use hotseat mode from the prototype's menu. A cover screen hides your hand when you pass the turn.

**Same office network:** one person runs:

```
pnpm room
pnpm dev:lan <prototype-name>
```

and shares the network address it prints. The other person opens that address.

**Remote:** open the deployed prototype link, create a room, and send the room code to the other player. A third person can join as a spectator and see both hands.

**Leaving notes during play:** press `N`, type what you're thinking ("no answer to lane pressure here"), press Enter. The note is saved against the current turn.

Every match is recorded in `prototypes/<name>/sessions/`. Those files can be replayed step by step later, so "turn 6 felt bad" can actually be looked at.

**Not built yet:** LAN, remote and the `sessions/` files arrive with multiplayer (Stage 7 of `docs/PLAN.md`). Today, hotseat has no cover screen, and a finished match prints its recording — actions plus your notes — to the browser console instead of writing a file.

---

## Working with an AI agent

You can use **Claude Code** or **Codex**. They follow the same rules (from `AGENTS.md` files) and use the same skills, so it doesn't matter which one you pick. Start either from the repo folder:

```
claude     # Claude Code
codex      # Codex
```

Talk to it in plain language. Some examples that work well:

- "Make a new prototype called 03-market-day that tests whether a daily buy-and-sell loop is fun."
- "In 03-market-day, playtest it and tell me if anything is broken."
- "Make apples cheaper and bread more expensive, then show me how that changes the average score."
- "Turn my session notes from yesterday's match into a list of problems."
- "Log that change in the changelog."

### Skills

Skills are named, repeatable workflows. You can mention one by name, or just describe what you want and the agent picks it.

| Skill | What it does | Claude Code | Codex |
|---|---|---|---|
| new-prototype | Creates a new prototype from the template | `/new-prototype` | `$new-prototype` |
| playtest | Plays the game automatically and reports problems | `/playtest` | `$playtest` |
| tuning-pass | Changes numbers only and measures the effect | `/tuning-pass` | `$tuning-pass` |
| log-change | Writes a changelog entry | `/log-change` | `$log-change` |
| extract-design-doc | Updates the design doc from the prototype | `/extract-design-doc` | `$extract-design-doc` |
| extract-shared-module | Moves duplicated code into shared packages | `/extract-shared-module` | `$extract-shared-module` |
| port-to-unity | Prepares logic and tests for the Unity version | `/port-to-unity` | `$port-to-unity` |

### Tips

- **One task per session.** Start a fresh session for each new piece of work. The agent reads the rules from files, so nothing is lost.
- **Name the prototype** in your request so it doesn't have to guess.
- **Trust `pnpm verify`, not the agent's summary.** If the agent says it's done, it should show you that verify passed.
- **Say "numbers only"** when you want a balance change and nothing else.

---

## The rules of the road

1. **A change is finished when `pnpm verify` passes.** It checks the code, runs the game rules across many random seeds, and plays the game in a hidden browser. You can run it yourself any time. Git will refuse to commit if it fails.
2. **Log every change that lands.** After a change is verified and pushed, run `pnpm log-change <prototype-name>` (or ask the agent to). Write *why* you changed it, not just what.

A good changelog entry:

```
## 2026-09-20 — cards@13
- Ember Scout cost 3 → 2. Early lane pressure was unanswerable (session a7f3, turn 6).
```

---

## Starting a new prototype

```
pnpm new-proto 04-your-idea
```

or ask an agent. Then fill in, in `prototypes/04-your-idea/`:

- `AGENTS.md` — the one question this prototype answers, and what "done" means.
- `README.md` — how to play it.
- `docs/visual-direction.md` — reference images, mood, and what it should *not* look like.

Before you start, ask: is the fun in the rules or in the feel? That decides the testing mode — `replay` for rules, `smoke` for feel (see "The two testing modes" above). An agent will ask you this, along with 2D or 3D. Either answer is fine; it only changes how the prototype is checked.

---

## When a prototype is ready for Unity

A prototype "graduates" when its question has been answered yes by real playtests, the fun holds up over several sessions, and its design doc is current. The full checklist is in `docs/PLAN.md` section 12.

What goes to the Unity team from a `replay` prototype: the design doc, the config files (unchanged), the rules code and its tests, recorded sessions, and a list of everything that must be built fresh in Unity (controls, animation, effects).

From a `smoke` prototype, less: the design doc, the config as a starting point, and the build-fresh list. The rules code isn't handed over, because nothing proved it behaves identically every time. That's the trade for being able to prototype feel here at all.

---

## Common problems

| Problem | Try |
|---|---|
| `pnpm: command not found` | Run `corepack enable`, then reopen the terminal. |
| Launcher is empty or old | Stop `pnpm dev` (Ctrl+C) and start it again. |
| The other player can't connect on LAN | Check you're on the same network and your firewall allows the port. |
| Players see different things | Compare the version stamps in the corner; both need the same build. |
| Git won't let me commit | `pnpm verify` failed. Run it to see why, or ask the agent to fix it. |
| Git app says `pnpm: command not found` on commit | Do the one-time Git app setup under "First-time setup". |
| Agent seems to ignore the rules | Start a new session from the repo folder. For Claude Code, make sure it's up to date. |
| Skills missing on Windows | Symlinks may be off. See `docs/agent-setup.md`. |

---

## Glossary

- **Prototype** — a rough, playable test of one game idea.
- **Seed** — a number that makes the random parts of the game repeat exactly. Same seed, same shuffle.
- **Replay / session log** — a recording of every action in a match that can be played back.
- **Tuning / config** — the numbers that define the game (costs, damage, drop rates), kept in JSON files.
- **Verify** — the automatic check every change must pass.
- **Graduate** — a prototype that proved its idea and moves to Unity.
- **Agent** — Claude Code or Codex, an AI that reads and edits the repo on request.
