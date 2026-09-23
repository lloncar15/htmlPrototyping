# _template — visual direction

Non-binding. Nothing here is read by code; only `config/theme.json`
(palette, font, radius, spacing) is. This file exists so a look can be
agreed on without any of it leaking into prototype code.

Replace every section when you copy this template.

## Mood

Three or four words. What should someone feel in the first ten seconds?

_Placeholder: neutral, flat, obviously unfinished. The template should
never look finished enough to argue about._

## Reference

Drop images in this folder and link them, with one line each on what you
are pointing at — the palette, the layout, the type, the density. A link
without that line is noise.

- _(none yet)_

## What it should not look like

Usually the more useful list. Name specific games or styles and say what
about them is wrong for this one.

- _Placeholder: not a polished commercial card game. Polish invites
  feedback on the art instead of the rules._

## Look frame

One aspirational mockup of a single screen, at the fidelity the finished
game would have. It is a target for the Unity build, not for this
prototype.

- _(none yet)_

## Tokens in play

What `config/theme.json` currently carries. A designer can change any of
these without touching code.

| Token | Now | Controls |
|---|---|---|
| `bg` | `#14161a` | Page background |
| `panel` | `#1d2027` | Card/panel surface |
| `accent` | `#6ea8fe` | Playable cards |
| `text` | `#e6e8eb` | Body text |
| `radius` | `12` | Corner rounding, in px |
| `font` | `16px system-ui, sans-serif` | Body type |
