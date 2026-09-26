# _template-3d — visual direction

Non-binding. Nothing here is read by code; only `config/theme.json`
(palette, fog, radius, font) is. This file exists so a look can be
agreed on without any of it leaking into prototype code.

Replace every section when you copy this template.

## Mood

Three or four words. What should someone feel in the first ten seconds?

_Placeholder: flat, diagrammatic, obviously unfinished. A 3D prototype
is the easiest place in this repo to accidentally make something that
looks finished, and then get feedback on the lighting instead of the
loop._

## Reference

Drop images in this folder and link them, with one line each on what you
are pointing at — the palette, the silhouette, the camera, the scale. A
link without that line is noise.

- _(none yet)_

## What it should not look like

Usually the more useful list. Name specific games or styles and say what
about them is wrong for this one.

- _Placeholder: no postprocessing, no shadows, no shader polish, no
  textures, no imported models. Graybox primitives only, unless the
  prototype's question is itself about visuals._

## Look frame

One aspirational mockup of a single screen, at the fidelity the finished
game would have. It is a target for the Unity build, not for this
prototype.

- _(none yet)_

## Tokens in play

What `config/theme.json` currently carries. A designer can change any of
these without touching code. The three-dimensional ones reach WebGL as
JS values (see `src/view/scene.ts`); the rest become CSS custom
properties for the HUD, exactly as in the 2D template.

| Token | Now | Controls |
|---|---|---|
| `bg` | `#0e1014` | Page background behind the canvas |
| `panel` | `#1d2027` | HUD surface |
| `accent` | `#6ea8fe` | HUD highlight |
| `text` | `#e6e8eb` | HUD text |
| `radius` | `12` | Corner rounding, in px |
| `font` | `16px system-ui, sans-serif` | HUD type |
| `sky` | `#141922` | Scene background |
| `ground` | `#232a35` | Arena floor |
| `grid` | `#394354` | Floor grid lines — the main read on speed |
| `player` | `#6ea8fe` | The capsule |
| `pickup` | `#f0b858` | Collectables |
| `fog`, `fogNear`, `fogFar` | `#141922`, `18`, `46` | Distance falloff; also how big the arena feels |

Camera framing (`fov`, `height`, `distance`, `follow`, `lookAhead`) is
not a theme token — it is in `config/ui.json`, because it changes what
the player can see rather than how it looks.
