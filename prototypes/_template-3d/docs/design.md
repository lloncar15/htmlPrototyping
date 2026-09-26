# _template-3d — design

Generated from the code by the `extract-design-doc` skill. The code wins
every disagreement: `src/sim.ts`, `src/invariants.ts`, `config/*.json`.

This is the 3D template's placeholder game. It exists to exercise the
machinery — a real-time loop that is still replay-testable — not because
it is a design. Replace this whole file when you copy the template.

## Core loop

One player slides a capsule around a flat square arena. Pickups are
scattered at the start by the seeded RNG; running over one collects it.

- **Win:** collect `winAt` pickups.
- **Lose:** nothing. The run ends as `timeout` at `maxTicks`.
- There is no other ending, no second player, no failure state.

## Time

Every tick is an action: `{ type: "tick", input: { moveX, moveZ } }`,
carrying the input that was held for that tick. A tick is `tickMs` long
and nothing else advances the sim, so a run is fully described by its
seed plus its list of ticks. `src/main.ts` turns real elapsed time into
whole ticks with `createFixedStep`/`advance`; the frame rate never
reaches the rules.

| Number | Value | Meaning |
|---|---|---|
| `tickMs` | 50 | One tick, i.e. 20 ticks per second |
| `maxTicks` | 900 | 45 seconds before the run times out |

## Entities

| Entity | State |
|---|---|
| Game | `config` (a copy of `sim.json`), `seed`, `rng`, `tick` (0-based), `winner` |
| Player (`p1`) | `position`, `velocity` (both `{x,y,z}`), `collected` |
| Pickup | `id`, `position`, `taken` |

Positions are plain objects, never `THREE.Vector3`: `hashState` throws
on class instances, and a plain `{x,y,z}` ports to a Unity struct with
no translation layer. `y` is the capsule's centre height and is pinned
to `playerRadius` — the game is two-dimensional movement in a
three-dimensional scene.

Taken pickups stay in the array with `taken: true` rather than being
spliced out, so the array length is a fixed part of the hash and the
`pickups-conserved` invariant has something to count.

## Movement

Per tick, with `dt = tickMs / 1000`:

1. Normalize the held input into a direction on the XZ plane.
2. `velocity += direction * moveAccel * dt`
3. `velocity /= 1 + damping * dt` — implicit-Euler damping, stable at
   any `tickMs` and made only of exactly-specified arithmetic.
4. Clamp the speed to `maxSpeed`.
5. `position += velocity * dt`
6. Clamp the position inside `±(arenaHalf - playerRadius)`. Hitting a
   wall zeroes that axis's velocity, so speed is not stored up in the
   wall and released when the player turns around.

| Number | Value | Effect |
|---|---|---|
| `moveAccel` | 70 | How fast it gets going |
| `maxSpeed` | 9 | Top speed, units per second |
| `damping` | 6 | How fast it stops; the feel dial |
| `arenaHalf` | 9 | The floor is 18 × 18 units |
| `playerRadius` | 0.5 | Capsule size, and the wall inset |

## Pickups

`pickupCount` (10) are placed at init by the seeded RNG, uniformly
inside the movement bounds, rejecting any that land within
`pickupMinSpawnDistance` (3) of the player's start so the opening is
never a free point. Rejection is capped at 16 tries per pickup, so a bad
config cannot hang `init`; past the cap the minimum distance is
best-effort.

Collection is a flat-plane distance test against `pickupRadius` (1.2),
ignoring the `y` gap between the pickup on the floor and the capsule's
centre. It is checked after the move, so a fast pass can still tunnel
through a pickup at high speed — a known limitation, and the kind of
thing a real prototype would fix with a swept test.

## Hidden information

There is none: one player, and `viewFor` hides only the RNG state
(which decided the layout and nothing since) and the pickups already
taken. The redaction is kept anyway, because the contract is the same
one the multiplayer prototypes rely on.

## Invariants

Checked after every tick by `pnpm test` and by the in-browser playtest.
For a moving sim these matter more than in a card game: a NaN or an
escaped player is exactly what a wrong number produces, and neither is
visible in a screenshot.

- `finite-positions` — no NaN or Infinity anywhere.
- `inside-arena` — the player is within the clamp bounds.
- `speed-limit` — speed never exceeds `maxSpeed`.
- `resting-on-floor` — `y` is exactly `playerRadius`.
- `pickups-conserved` — the count never changes, and pickups marked
  taken equal the pickups players hold.
- `tick-range` — `0..maxTicks`.
- `winner-consistent` — a win means `winAt` collected; a timeout means
  `maxTicks` reached with fewer.

## Balance, as measured

`pnpm sim _template-3d --seeds 30` with the random-legal bot: about 43%
of runs reach `winAt`, the rest time out. That spread is deliberate for
a template — a bot that always won or always failed would hide a broken
change rather than surface it.

## What is deliberately missing

No jumping, no gravity, no collision between entities, no second player,
no physics engine. Rapier is opt-in per prototype and this template does
not use it: adding it would move the template to `smoke` mode and cost
the determinism it exists to demonstrate.
