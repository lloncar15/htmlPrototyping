# How to Use This Repo

A guide for designers and programmers. You don't need to know how the repo is built to use it. The technical plan is in `docs/PLAN.md`.

---

## What this is

A place to make quick, rough, playable versions of game ideas in the browser, so we can find out whether a game's rules are fun before building it properly in Unity.

Three things to keep in mind:

- **Prototypes are throwaway.** Their job is to answer one question. When it's answered, the prototype has done its work.
- **It tests systems, not feel.** Card games, strategy, economy, puzzles: yes. How a jump feels, how a hit lands: no, that has to be tested in Unity.
- **Visuals are rough on purpose.** We keep a visual direction for mood, but polish slows iteration down.

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

---

## Playing a prototype

```
pnpm dev
```

Open the address it prints (usually `http://localhost:5173`). You'll see the **launcher**: a list of every prototype with the question it's testing. Click one to play.

Every prototype shows its build and config version in a corner. If you're comparing notes with someone, check you're on the same version.

Each prototype has a `README.md` explaining controls and what is currently fake or missing.

---

## Changing the numbers (tuning)

You never need to edit code to change the game's numbers.

**Using the tuning panel:** open a prototype and press the panel toggle (see the README; usually `` ` ``). Move the sliders and the game updates live. When you like the result, click **Export JSON** and save the file over the one in `prototypes/<name>/config/`.

**Editing directly:** open the files in `prototypes/<name>/config/` in any text editor. The game reloads when you save.

**Changing the look:** colours, fonts and spacing are in `config/theme.json`. Change those freely.

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

Before you start, ask: is the fun in the rules or in the feel? If it's feel (a platformer, an action game, anything 3D), prototype it in Unity instead.

---

## When a prototype is ready for Unity

A prototype "graduates" when its question has been answered yes by real playtests, the fun holds up over several sessions, and its design doc is current. The full checklist is in `docs/PLAN.md` section 12.

What goes to the Unity team: the design doc, the config files (unchanged), the rules code and its tests, recorded sessions, and a list of everything that must be built fresh in Unity (controls, animation, effects).

---

## Common problems

| Problem | Try |
|---|---|
| `pnpm: command not found` | Run `corepack enable`, then reopen the terminal. |
| Launcher is empty or old | Stop `pnpm dev` (Ctrl+C) and start it again. |
| The other player can't connect on LAN | Check you're on the same network and your firewall allows the port. |
| Players see different things | Compare the version stamps in the corner; both need the same build. |
| Git won't let me commit | `pnpm verify` failed. Run it to see why, or ask the agent to fix it. |
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
