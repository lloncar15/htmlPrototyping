# _template

The starting point every new prototype is copied from. Its placeholder
game exists to prove the machinery works end to end — rules, seeds,
replays, tuning, verification — not because it is fun.

New prototype: `pnpm new-proto 03-your-idea`, then replace the rules in
`src/sim.ts` and the numbers in `config/`.

## What it tests

That the workspace boots and the sim is fully deterministic: the same
seed and config always produce the same game.

## How to play

```bash
pnpm dev _template
```

Two players share one screen (hotseat). On your turn, click a card: its
value is added to your score and you draw a replacement. After 10 turns
the higher score wins.

## Controls

| Key / action | Does |
|---|---|
| Click a card | Play it |
| `` ` `` | Show or hide the tuning panel |
| `N` | Open the note box — type, Enter saves it against the current turn |
| `?seed=12345` in the URL | Play a specific deal again |

The bottom-left corner always shows the seed, the config version and the
build. Quote all three when you report something.

## Tuning

Open the panel with `` ` ``, move a slider, and the game restarts on the
same seed with the new numbers — the same deal under the new rules.
**Export JSON** downloads the file; save it over
`prototypes/_template/config/<name>.json`. An exported file whose values
you changed comes back with its `version` bumped, so a replay recorded
against the old numbers can't claim the new ones.

| File | Holds |
|---|---|
| `config/sim.json` | The rules' numbers: hand size, card range, turn count |
| `config/theme.json` | Colours, spacing, font — the only visual file code reads |
| `config/ui.json` | Hotkeys and the slider ranges the panel offers |
| `config/replay.json` | How often a replay records a checkpoint hash |
| `config/verify.json` | How many seeds `pnpm test` and `pnpm sim` run |

## What is fake

- **The game.** It is a placeholder for the machinery, not a design.
- **Hotseat has no cover screen.** Both hands are one click apart; the
  pass-to-opponent screen arrives with multiplayer (Stage 7).
- **Notes are not saved to disk.** They are logged to the console and
  included in the session JSON printed when a game ends. Real session
  files in `sessions/` arrive with multiplayer.
- **Visuals are deliberately rough.** See `docs/visual-direction.md`.

## Checking it

```bash
pnpm playtest _template     # replays replays/smoke.json in a real browser
pnpm sim _template --seeds 200   # 200 bot matches, balance metrics
pnpm verify                 # the arbiter: everything above
```
