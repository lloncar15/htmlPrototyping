# 01-cozy-solitaire

Tests: does an unhurried, forgiving Klondike keep you playing a second
and third deal in one sitting?

Ordinary single-player Klondike, dealt one card at a time, with no timer,
no score, and no penalty for going back. Warm paper colours, rounded
cards, nothing flashing.

## How to play

```bash
pnpm dev 01-cozy-solitaire
```

Build four foundation piles, one per suit, ace up to king. Down on the
table, cards stack in descending order with the colours alternating, and
only a king starts an empty column. Turn the stock when you run out of
moves; when the stock is empty, click it again to gather the pile back up
and go round as many times as you like.

## Controls

| Key / action | Does |
|---|---|
| Click a card | Pick it up, along with everything stacked on it |
| Click a pile | Drop what you're holding there, if it fits |
| Click a card you're holding | Send it to its foundation if it can go |
| Click the stock | Turn one card; when empty, gather the pile back up |
| **New deal** | Start a fresh shuffle |
| **Undo** | Take back the last move, as many times as you like |
| `` ` `` | Show or hide the tuning panel |
| `N` | Leave a note against the current move |
| `?seed=12345` in the URL | Play one specific shuffle again |

Piles you can legally drop onto are outlined while you hold a card. The
bottom-left corner shows the seed, the config version and the build —
quote all three when reporting something.

## Tuning

Everything numeric is in `config/sim.json`. Open the panel with `` ` ``,
move a slider, and the deal restarts on the same shuffle under the new
rules.

| Value | Now | Controls |
|---|---|---|
| `drawCount` | 1 | Cards turned per click of the stock. 3 is the harder version |
| `maxPasses` | 0 | Times you may gather the waste back up. 0 means unlimited |
| `tableauPiles` | 7 | Columns on the table |
| `ranks` / `suits` | 13 / 4 | Deck shape. Fewer ranks makes a much quicker game |
| `emptyTableauNeedsKing` | true | Whether only a king may start an empty column |
| `moveLimit` | 500 | Safety net so automated runs always end; not a rule to hit |

Colours, card size and fanning are in `config/theme.json`.

## What is fake

- **Everything is instant.** No dealing animation, no card flip, no
  sound. Those are Unity's job and would be re-done there anyway.
- **No scoring, timer, or streak.** Deliberate: the question is whether
  the game is pleasant without them.
- **No drag and drop.** Click to pick up, click to place. Dragging is
  feel, and feel doesn't transfer out of the browser.
- **Notes aren't written to disk.** They go to the console and into the
  session JSON printed when a deal ends. Real `sessions/` files arrive
  with Stage 7.
- **The bot is not a good player.** `pnpm sim` reports a floor, not a
  human win rate. See `src/bot.ts`.

## Checking it

```bash
pnpm playtest 01-cozy-solitaire      # replays a 500-move deal in a browser
pnpm sim 01-cozy-solitaire --seeds 200   # greedy bot, win rate and metrics
pnpm verify                          # the arbiter
```
