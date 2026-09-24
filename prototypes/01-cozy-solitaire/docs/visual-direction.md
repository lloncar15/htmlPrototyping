# 01-cozy-solitaire — visual direction

Non-binding. Nothing here is read by code; only `config/theme.json`
(palette, card size, fanning, font) is. This file exists so a look can be
agreed on without any of it leaking into prototype code.

## Mood

Warm, quiet, unhurried. Afternoon light on a wooden table.

The game should feel like something you'd leave open in a corner of the
screen. Nothing blinks, nothing counts down, nothing congratulates you
loudly. Winning says one line and stops.

## Reference

Drop images in this folder and link them, with one line each on what you
are pointing at — the palette, the layout, the type, the density.

- _(none yet)_ — the palette below was picked directly in
  `config/theme.json`, not from a reference. Worth replacing with a real
  one before anyone judges the look.

## What it should not look like

- **Casino green felt.** The default solitaire palette reads as a
  time-killer on a work machine. Warm paper instead.
- **Mobile free-to-play solitaire.** No coins, no streak meter, no
  celebration particles, no daily challenge.
- **High-contrast black-on-white cards.** Pure white cards on a dark
  table are legible but cold; cream on tan is the point.

## Look frame

One aspirational mockup of a finished screen, at the fidelity the Unity
build would have. A target for that build, not for this prototype.

- _(none yet)_

## Tokens in play

What `config/theme.json` currently carries. A designer can change any of
these without touching code.

| Token | Now | Controls |
|---|---|---|
| `bg` | `#f4e4cd` | Page behind the table |
| `table` | `#e6cdaa` | The table the cards sit on |
| `panel` | `#fdf6ea` | Message strip, button text |
| `cardFace` | `#fffaf1` | Card front |
| `cardBack` / `cardBackTrim` | `#c2703f` / `#9d5730` | The striped back |
| `slot` | `#d8bb95` | Empty pile outline |
| `ink` / `inkSoft` | `#4b3a2c` / `#96826d` | Text, and quieter text |
| `suitWarm` / `suitCool` | `#bf3f2f` / `#3f5a51` | The two card colours. Cool is a deep green rather than black, to stay warm |
| `accent` | `#d98324` | Buttons, and the card you're holding |
| `highlight` | `#f6c185` | Piles that will take the card you're holding |
| `radius` | `10` | Corner rounding, in px |
| `cardWidth` / `cardHeight` | `62` / `88` | Card size, in px |
| `fanUp` / `fanDown` | `26` / `13` | How far face-up and face-down cards peek out of a column |
| `gap` | `12` | Spacing between piles |
| `font` | `16px ui-rounded, Avenir, system-ui` | Body type. Rounded on purpose |

## Open questions

- The two card colours are red and deep green, not red and black. It
  keeps the palette warm, but it takes a moment to read as "the other
  colour". Worth testing with someone who has not been told.
- Cards are small (62×88) so the whole board fits without scrolling.
  If that reads as cramped, `cardWidth`/`cardHeight` are sliders.
