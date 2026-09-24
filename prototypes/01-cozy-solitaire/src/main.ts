// Renderer + input only. All rules live in ./sim; this file only calls
// applyAction (through the recorder) and draws viewFor. The designer
// layer (tuning panel, version stamp, note box, theme) comes from
// @proto/ui and is wired here, never inside the sim.
import { createRecorder, type Recorder } from "@proto/core";
import {
  configVersionOf,
  createBackLink,
  createNoteBox,
  createThemeLoader,
  createTuningPanel,
  createVersionStamp,
  type Note,
} from "@proto/ui";
import replayConfig from "../config/replay.json";
import config from "../config/sim.json";
import theme from "../config/theme.json";
import uiConfig from "../config/ui.json";
import { installPlaytestHook } from "./playtest-hook";
import * as sim from "./sim";

const BUILD_HASH = "dev";
const params = new URLSearchParams(location.search);

// Suits alternate colour by index, so the symbols must too.
const SUITS = ["♥", "♠", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const allConfigVersions = (): string => configVersionOf({ sim: config, ui: uiConfig });

function newRecorder(seed: number): Recorder<sim.State, sim.Action> {
  console.info(`[01-cozy-solitaire] seed=${seed} config=${allConfigVersions()}`);
  return createRecorder(sim, config, {
    seed,
    buildHash: BUILD_HASH,
    timestep: null,
    checkpointEvery: replayConfig.checkpointEvery,
  });
}

// Seed: ?seed=<uint32> to replay a deal, otherwise derived from the clock.
const seedParam = params.get("seed");
let seed = seedParam !== null ? Number(seedParam) : Date.now() >>> 0;
let recorder = newRecorder(seed);
/** Kept so a misclick can be taken back: undo replays all but the last. */
let history: { playerId: string; action: sim.Action }[] = [];
let selection: { pile: sim.Pile; count: number } | null = null;

const root = document.getElementById("app") as HTMLDivElement;
const loadTheme = createThemeLoader(root, theme);

// Only appears under `pnpm dev`'s one-server launcher; a no-op otherwise.
createBackLink();

const stamp = createVersionStamp({ buildHash: BUILD_HASH, configVersion: allConfigVersions(), seed });

const noteBox = createNoteBox({
  hotkey: uiConfig.hotkeys.notes,
  turn: () => recorder.state.moves,
  playerId: () => sim.PLAYERS[0],
  onNote: (note: Note) => console.info("[01-cozy-solitaire] note", JSON.stringify(note)),
});

function deal(nextSeed: number): void {
  seed = nextSeed;
  recorder = newRecorder(seed);
  history = [];
  selection = null;
  stamp.update({ configVersion: allConfigVersions(), seed });
  render();
}

// Tuning changes the numbers a deal was dealt with, so the deal restarts
// on the same seed: the same shuffle under the new rules.
createTuningPanel({
  files: [
    { name: "sim", config, fields: uiConfig.tuning.sim },
    { name: "theme", config: theme, fields: uiConfig.tuning.theme },
  ],
  title: uiConfig.panel.title,
  expanded: uiConfig.panel.expanded,
  hotkey: uiConfig.hotkeys.panel,
  onChange(file) {
    if (file.name === "theme") loadTheme(theme);
    else deal(seed);
  },
});

/** The only way state changes: real input and playtest replays both come through here. */
function dispatch(playerId: string, action: sim.Action): void {
  recorder.apply(playerId, action);
  history.push({ playerId, action });
  selection = null;
  if (recorder.state.result !== null) {
    // Stand-in for the session log of Stage 7: the replay plus the notes
    // taken during it, which is what makes "this deal dragged" reviewable.
    console.info("[01-cozy-solitaire] session", JSON.stringify({ ...recorder.finish(), notes: noteBox.notes() }));
  }
  render();
}

/** Replay every move but the last. Still only applyAction, just fewer of them. */
function undo(): void {
  if (history.length === 0) return;
  const replaying = history.slice(0, -1);
  recorder = newRecorder(seed);
  for (const { playerId, action } of replaying) recorder.apply(playerId, action);
  history = replaying;
  selection = null;
  render();
}

const samePile = (a: sim.Pile, b: sim.Pile): boolean => a.kind === b.kind && a.index === b.index;

function legal(): sim.Action[] {
  return sim.legalActions(recorder.state, sim.PLAYERS[0]);
}

/** Moves available from the current selection, used to light up destinations. */
function movesFromSelection(): sim.Action[] {
  if (!selection) return [];
  return legal().filter((a) => a.type === "move" && samePile(a.from, selection!.pile) && a.count === selection!.count);
}

/**
 * `ok` marks a card the held cards may be dropped on. It goes on the
 * card itself, not the pile: a pile's own outline would be painted over
 * by the cards stacked inside it.
 */
function cardHtml(card: number, pile: sim.Pile, index: number, selected: boolean, ok = false): string {
  const suit = sim.suitOf(card, config);
  const rank = sim.rankOf(card, config);
  const tone = sim.colorOf(card, config) === 0 ? "warm" : "cool";
  const label = `${RANKS[rank] ?? rank + 1}${SUITS[suit] ?? suit}`;
  // Rank and suit sit together in the corner: in a fanned pile the
  // bottom of every card but the top one is covered.
  return `<div class="card ${tone}${selected ? " sel" : ""}${ok ? " ok" : ""}" data-pile="${pile.kind}:${pile.index}"
    data-index="${index}" aria-label="${label}">
      <span class="rank">${RANKS[rank] ?? rank + 1}<i>${SUITS[suit] ?? suit}</i></span>
      <span class="pip">${SUITS[suit] ?? suit}</span>
    </div>`;
}

function faceDownHtml(pile: sim.Pile): string {
  return `<div class="card down" data-pile="${pile.kind}:${pile.index}"></div>`;
}

function slotHtml(pile: sim.Pile, mark: string, ok: boolean): string {
  return `<div class="slot${ok ? " ok" : ""}" data-pile="${pile.kind}:${pile.index}">${mark}</div>`;
}

function render(): void {
  const state = recorder.state;
  const view = sim.viewFor(state, sim.PLAYERS[0]);
  const destinations = movesFromSelection().map((a) => (a as { to: sim.Pile }).to);
  const isOk = (pile: sim.Pile): boolean => destinations.some((to) => samePile(to, pile));

  const stockPile: sim.Pile = { kind: "stock", index: 0 };
  const stock = view.stockCount
    ? `<div class="pile stacked">${faceDownHtml(stockPile)}</div>`
    : `<div class="pile">${slotHtml(stockPile, view.wasteCount > 0 ? "↻" : "", false)}</div>`;

  const wastePile: sim.Pile = { kind: "waste", index: 0 };
  const wasteTop = view.waste[view.waste.length - 1];
  const waste = `<div class="pile">${
    wasteTop === undefined
      ? slotHtml(wastePile, "", false)
      : cardHtml(wasteTop, wastePile, 0, selection?.pile.kind === "waste")
  }</div>`;

  const foundations = view.foundations
    .map((pile, i) => {
      const at: sim.Pile = { kind: "foundation", index: i };
      const top = pile[pile.length - 1];
      const ok = isOk(at);
      const body =
        top === undefined
          ? slotHtml(at, SUITS[i] ?? "", ok)
          : cardHtml(top, at, pile.length - 1, selection?.pile.kind === "foundation" && selection.pile.index === i, ok);
      return `<div class="pile">${body}</div>`;
    })
    .join("");

  const tableau = view.tableau
    .map((pile, i) => {
      const at: sim.Pile = { kind: "tableau", index: i };
      const ok = isOk(at);
      if (pile.downCount === 0 && pile.up.length === 0) {
        return `<div class="pile tableau">${slotHtml(at, "", ok)}</div>`;
      }
      const down = Array.from({ length: pile.downCount }, () => faceDownHtml(at)).join("");
      const selectedFrom =
        selection?.pile.kind === "tableau" && selection.pile.index === i ? pile.up.length - selection.count : Infinity;
      const up = pile.up
        .map((card, j) => cardHtml(card, at, j, j >= selectedFrom, ok && j === pile.up.length - 1))
        .join("");
      return `<div class="pile tableau">${down}${up}</div>`;
    })
    .join("");

  const done =
    view.result === "won"
      ? `<div class="done">All home in ${view.moves} moves. 🌿</div>`
      : view.result === "stuck"
        ? `<div class="done">No moves left — this one didn't come out. Deal again?</div>`
        : view.result === "move-limit"
          ? `<div class="done">That's ${view.moves} moves; calling it here. Deal again?</div>`
          : "";

  root.innerHTML = `
    <div class="board">
      <div class="row">${stock}${waste}<div class="spacer"></div>${foundations}</div>
      <div class="row">${tableau}</div>
    </div>
    <div class="bar">
      <button data-act="new">New deal</button>
      <button data-act="undo" ${history.length === 0 ? "disabled" : ""}>Undo</button>
      <span class="status">${view.won}/${config.suits * config.ranks} home · ${view.moves} move${view.moves === 1 ? "" : "s"}${
        view.passes > 0 ? ` · ${view.passes} time${view.passes === 1 ? "" : "s"} through the stock` : ""
      }</span>
    </div>
    ${done}
    <div class="hint">Click a card to pick it up, then click where it goes. Click the stock to turn a card;
      when it's empty, click again to gather the pile back up. \` opens tuning, N leaves a note.</div>`;
}

function parsePile(value: string): sim.Pile {
  const [kind, index] = value.split(":");
  return { kind: kind as sim.PileKind, index: Number(index) };
}

/** Cards this pile can give, from `index` down to its top. */
function countFrom(pile: sim.Pile, index: number): number {
  if (pile.kind !== "tableau") return 1;
  return (recorder.state.tableau[pile.index]?.up.length ?? 0) - index;
}

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest("button[data-act]");
  if (button) {
    if (button.getAttribute("data-act") === "new") deal((Date.now() >>> 0) as number);
    else undo();
    return;
  }

  const hit = target.closest("[data-pile]");
  if (!hit || recorder.state.result !== null) return;
  const pile = parsePile(hit.getAttribute("data-pile") ?? "");
  const index = Number(hit.getAttribute("data-index") ?? 0);

  if (pile.kind === "stock") {
    if (legal().some((a) => a.type === "draw")) dispatch(sim.PLAYERS[0], { type: "draw" });
    else selection = null;
    render();
    return;
  }

  // With something picked up, a click on a pile that accepts it plays the move.
  const move = movesFromSelection().find((a) => samePile((a as { to: sim.Pile }).to, pile));
  if (move) {
    dispatch(sim.PLAYERS[0], move);
    return;
  }

  const count = countFrom(pile, index);
  const alreadyHeld = selection && samePile(selection.pile, pile) && selection.count === count;
  if (alreadyHeld) {
    // Clicking what you're holding sends it home if it has somewhere to go.
    const home = movesFromSelection().find((a) => (a as { to: sim.Pile }).to.kind === "foundation");
    if (home) dispatch(sim.PLAYERS[0], home);
    else {
      selection = null;
      render();
    }
    return;
  }

  const canLift = legal().some((a) => a.type === "move" && samePile(a.from, pile) && a.count === count);
  selection = canLift ? { pile, count } : null;
  render();
});

if (params.has("playtest")) {
  installPlaytestHook({
    configVersion: sim.configVersion(config),
    reset(nextSeed) {
      deal(nextSeed);
    },
    dispatch,
    state: () => recorder.state,
  });
}

render();
