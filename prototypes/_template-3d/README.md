# _template-3d

Tests: the 3D workspace boots and a fixed-tick real-time sim is fully
deterministic.

This is the starting point for three.js prototypes, the way `_template`
is for DOM ones. Its game is a placeholder: slide a capsule around a
square arena and run over the glowing shapes. It exists to exercise the
machinery — ticks as actions, replay hashes, graybox rendering, the
designer layer — not because it is a design. Replace the rules.

## How to play

```bash
pnpm dev _template-3d
```

Or `pnpm dev` and click it in the launcher.

Collect four pickups before the 45-second clock runs out. There is no
losing beyond running out of time.

## Controls

| Key / action | Does |
|---|---|
| `W` `A` `S` `D`, or the arrow keys | Move |
| `` ` `` | Show or hide the tuning panel (ticking pauses while it is open) |
| `N` | Open the note box — Enter saves it against the current tick |
| `?seed=12345` in the URL | Play a specific pickup layout again |

The bottom-left corner shows the seed, config version and build. Quote
all three when you report something.

## Tuning

Numbers live in `config/`; nothing is hard-coded. Open the panel with
`` ` ``, move a slider, hit **Export JSON**, and save the file over
`prototypes/_template-3d/config/<name>.json`. Editing a `sim` value
restarts the run on the same seed, so you see the same layout under the
new feel. Colours, fog and the arena palette are in `config/theme.json`
and apply live.

## What is fake

- The "game" is a placeholder. Do not judge the loop.
- There is no jumping, no collision beyond the arena walls, no physics
  engine. Rapier is opt-in per prototype and this template does not use it.
- The visuals are graybox on purpose: primitives, flat colours, one
  light. Polish belongs in a prototype whose question is about visuals.

## Why it is in `replay` mode

Real-time does not mean untestable. Every tick is an action carrying the
input that was held for it, and the step length comes from
`config/sim.json` (`tickMs`), never from the frame's `dt`. So the same
seed and the same actions reproduce the same state, and this prototype
is checked against checkpoint hashes exactly like a card game —
including across runtimes: `pnpm test` runs the sim in Node and
`pnpm playtest` runs it in Chromium, and both must land on the same
final hash.

That only holds because the sim's arithmetic is limited to `+ - * /` and
`Math.sqrt/min/max/abs`, which IEEE 754 specifies exactly. Reach for
`Math.sin`, `Math.pow` or a physics engine and the hashes will drift —
that is when a prototype belongs in `smoke` mode instead.

## Checking it

```bash
pnpm playtest _template-3d
pnpm sim _template-3d --seeds 200
pnpm verify
```
