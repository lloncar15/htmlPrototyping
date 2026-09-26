# 02-bastion-invaders — visual direction

Non-binding. Only `config/theme.json` (palette, lights, post) and the
camera/island/effects blocks of `config/ui.json` are read by code.

## Mood

Warm, hand-built, floating, a little melancholy. A sunlit patch of
ground holding together in a dark void.

## Reference

- Bastion (Supergiant, 2011): the tilted isometric camera, ground that
  assembles under the player, a floating island with rock hanging below,
  a saturated warm palette against a deep teal void. We borrow those,
  not its painted textures.

## What it should not look like

- Neon or synthwave arcade. Glow is only for shots.
- Photoreal PBR, textures or imported models. Primitives and flat
  shading only.
- A flat 2D Invaders board seen from above; the tilt and the depth are
  the point.

## Tokens in play

| Token | Controls |
|---|---|
| `sky`, `fog`, `fogNear`, `fogFar` | The void and how the roots fade into it |
| `tileA`, `tileB`, `tileEdge`, `cliff` | Island tiles, the grassy rim, the hanging rock |
| `bunker` | Bunker blocks (stone) |
| `player`, `playerAccent` | The Kid's head and tunic |
| `invaderBack`, `invaderMid`, `invaderFront`, `eyes` | Invaders by row |
| `shot`, `enemyShot`, `shotGlow` | Shot colours; glow > 1 is what bloom picks up |
| `danger` | The invasion line |
| `motes` | Dust drifting in the void |
| `keyLight`, `keyIntensity`, `hemiSky`, `hemiGround`, `hemiIntensity` | Sun and sky fill |
| `bloomStrength`, `bloomRadius`, `bloomThreshold` | Bloom |
| `vignetteOffset`, `vignetteDarkness` | Vignette; keep darkness ≤ 1 |
| `bg`, `panel`, `accent`, `text`, `radius`, `font` | HUD |

Camera framing (`zoom`, `pitchDeg`, `yawDeg`, ...), island shape and
effect timings are in `config/ui.json`: they change what is seen and
when, not the colours.
