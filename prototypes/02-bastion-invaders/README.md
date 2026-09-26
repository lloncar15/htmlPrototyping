# 02-bastion-invaders

Tests: Does Space Invaders still read and play clearly from a Bastion-style tilted isometric camera, on a floating diorama that assembles itself from tiles?

## How to play

```bash
pnpm dev 02-bastion-invaders
```

Or run `pnpm dev` and click it in the launcher.

The island rises out of the void under the Kid. A formation of 32
invaders marches side to side and steps closer every time it reaches an
edge, getting faster as it thins out. Throw shots up the field to clear
them. Four bunkers of island tiles soak up shots from both sides.

- **Win:** clear every invader.
- **Lose:** run out of lives (3), or let the formation reach the red
  line in front of the bunkers.

## Controls

| Key / action | Does |
|---|---|
| A / D or ← / → | Move |
| Space, W or ↑ (hold) | Throw; the cooldown sets the rate |
| R | Restart with a new seed |
| `` ` `` | Show or hide the tuning panel (the game pauses) |
| `N` | Open the note box; Enter saves it against the current tick |
| `?seed=12345` in the URL | Replay a specific run's enemy fire |

The bottom-left corner shows the seed, config version and build. Quote
all three when you report something.

## Tuning

Numbers live in `config/`; nothing is hard-coded. Open the panel with
`` ` ``, move a slider, hit **Export JSON**, and save the file over
`prototypes/02-bastion-invaders/config/<name>.json`. Rules changes
restart the wave on the same seed. Colours, lights, bloom and vignette
are in `config/theme.json` and update live. The camera angle, island
shape and effect timings are in `config/ui.json`.

## What is fake

- The narrator is three HUD lines, not a voice. Bastion's narration is
  a large part of its identity and is not being tested here.
- One wave only; no UFO, no score table, no sound.
- The Kid, the invaders and the props are primitives, not models.

## Checking it

```bash
pnpm playtest 02-bastion-invaders
```

```bash
pnpm sim 02-bastion-invaders --seeds 50
```
