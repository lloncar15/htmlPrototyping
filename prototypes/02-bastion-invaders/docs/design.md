# 02-bastion-invaders — design

The code wins every disagreement: `src/sim.ts`, `src/invariants.ts`,
`config/*.json`. Refresh with the `extract-design-doc` skill.

## Core loop

The player walks a line near the camera and throws shots up the field.
A grid of invaders marches across; when any live invader would pass the
field edge, the whole formation drops `marchStepZ` towards the player
and reverses. The step interval shrinks with the number of survivors.

- **Win (`p1`):** every invader is dead.
- **Lose (`invaders`):** lives reach 0, or a live invader's near edge
  reaches `invasionZ`.
- **`timeout`:** `maxTicks` passes first.

## Time

Every tick is an action: `{ type: "tick", input: { moveX, fire } }`.
A tick is `tickMs` long. Order within a tick: move the player, fire if
held and the cooldown and shot cap allow, move player shots, move enemy
shots, march, maybe enemy fire, then check the end.

| Number | Value | Meaning |
|---|---|---|
| `tickMs` | 50 | 20 ticks per second |
| `maxTicks` | 2400 | 120 s cap |

## Player

| Number | Value | Meaning |
|---|---|---|
| `playerSpeed` | 9 | Units/s, no inertia |
| `lives` | 3 | A hit costs one and clears all enemy shots |
| `shotSpeed` | 24 | Units/s towards −z |
| `shotCooldownTicks` | 6 | Ticks between throws |
| `maxPlayerShots` | 2 | Shots alive at once |

## Invaders

8 × 4 grid, spacing 1.7 × 1.5, back row at `formationStartZ` −8.
Points: front row 10, +10 per row further back (40 for the back row).

| Number | Value | Meaning |
|---|---|---|
| `marchStepX` / `marchStepZ` | 0.5 / 0.8 | Sideways step; drop at an edge |
| `marchIntervalStart` | 12 | Ticks per step with all 32 alive |
| `marchIntervalMin` | 2 | Fastest step, `ceil(start × alive / total)` floored here |
| `enemyFireChance` | 0.06 | Per tick, while under `maxEnemyShots` (3) |
| `enemyShotSpeed` | 9 | Units/s towards +z |
| `invasionZ` | 5.5 | The red line |

The seeded RNG only picks when and from which column the enemy fires;
the front-most live invader of that column shoots.

## Bunkers

4 bunkers of 4 × 2 blocks (0.55 units) at z 4. Any shot, from either
side, destroys the first block it meets. The formation crushes blocks
it overlaps.

## Hits

Shots are tested along the segment swept during the tick, and the
nearest target along it is hit, so fast shots do not tunnel.

## Invariants

Finite numbers; the player stays on the field; shot caps and field
bounds; score equals the points of the dead invaders; lives in range;
the formation never moves back; the tick is in range; the winner is
consistent with the state.

## Balance (random bot, 50 seeds)

Invaders win 84% of runs and the bot wins 16%. It kills 79% of the
wave on average, and runs last 36 s on average.
