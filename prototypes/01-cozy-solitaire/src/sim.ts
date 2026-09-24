// Pure rules for Klondike solitaire, single player.
// No renderer, DOM, or Math.random() here. Randomness via @proto/core.
//
// A card is an integer 0..(suits*ranks-1): suit = card / ranks, rank =
// card % ranks, with rank 0 the ace and rank ranks-1 the king. Suits
// alternate colour by index, so suit % 2 is the colour. Encoding cards
// as numbers keeps state small, JSON-clean, and cheap to hash.
import { createRng, shuffle, type RngState } from "@proto/core";

export type Config = {
  version: number;
  suits: number;
  ranks: number;
  tableauPiles: number;
  /** Cards turned from the stock per draw. 1 is the forgiving version. */
  drawCount: number;
  /** Times the waste may be turned back into the stock. 0 is unlimited. */
  maxPasses: number;
  /** Only a king may start an empty tableau pile. */
  emptyTableauNeedsKing: boolean;
  /** Safety net: the deal is declared unfinished after this many moves. */
  moveLimit: number;
};

export const PLAYERS = ["p1"] as const;
export type PlayerId = (typeof PLAYERS)[number];

export type PileKind = "stock" | "waste" | "foundation" | "tableau";
/** `index` selects which foundation or tableau pile; ignored for stock and waste. */
export type Pile = { kind: PileKind; index: number };

export type Action = { type: "draw" } | { type: "move"; from: Pile; to: Pile; count: number };

export type TableauPile = { down: number[]; up: number[] };

export type Result = "won" | "stuck" | "move-limit";

export type State = {
  config: Config;
  seed: number;
  rng: RngState;
  /** Face down. The last entry is the top, the next card drawn. */
  stock: number[];
  /** Face up. The last entry is the top, the only one in play. */
  waste: number[];
  /** One per suit, ace upward. foundations[s][r] is always suit s, rank r. */
  foundations: number[][];
  tableau: TableauPile[];
  moves: number;
  passes: number;
  result: Result | null;
};

export type TableauView = { downCount: number; up: number[] };

export type View = {
  you: PlayerId | null;
  /** Face-down cards are a count: their order is hidden, like a real stock. */
  stockCount: number;
  waste: number[];
  wasteCount: number;
  foundations: number[][];
  tableau: TableauView[];
  moves: number;
  moveLimit: number;
  passes: number;
  maxPasses: number;
  drawCount: number;
  result: Result | null;
  /** Cards on the foundations, 0..deck size. The score, in effect. */
  won: number;
};

export function configVersion(config: Config): string {
  return `sim@${config.version}`;
}

export function suitOf(card: number, config: Config): number {
  return Math.floor(card / config.ranks);
}

export function rankOf(card: number, config: Config): number {
  return card % config.ranks;
}

/** 0 or 1. Suits alternate, so neighbouring indices are always opposite colours. */
export function colorOf(card: number, config: Config): number {
  return suitOf(card, config) % 2;
}

function deckSize(config: Config): number {
  return config.suits * config.ranks;
}

function isPlayer(id: string): id is PlayerId {
  return (PLAYERS as readonly string[]).includes(id);
}

export function init(seed: number, config: Config): State {
  if (config.suits < 2 || config.suits % 2 !== 0) {
    throw new Error(`suits must be an even number >= 2 (colours alternate), got ${config.suits}`);
  }
  if (config.ranks < 2 || config.tableauPiles < 1 || config.drawCount < 1 || config.maxPasses < 0) {
    throw new Error(`Invalid config: ${JSON.stringify(config)}`);
  }
  const dealt = (config.tableauPiles * (config.tableauPiles + 1)) / 2;
  if (dealt > deckSize(config)) {
    throw new Error(`${config.tableauPiles} tableau piles need ${dealt} cards, deck has ${deckSize(config)}`);
  }

  const rng = createRng(seed);
  const deck = shuffle(
    rng,
    Array.from({ length: deckSize(config) }, (_, i) => i),
  );

  // Classic deal: pile i gets i+1 cards, the last of them face up.
  const tableau: TableauPile[] = [];
  let at = 0;
  for (let i = 0; i < config.tableauPiles; i++) {
    const cards = deck.slice(at, at + i + 1);
    at += i + 1;
    tableau.push({ down: cards.slice(0, i), up: cards.slice(i) });
  }

  return {
    config: structuredClone(config),
    seed,
    rng,
    stock: deck.slice(at),
    waste: [],
    foundations: Array.from({ length: config.suits }, () => []),
    tableau,
    moves: 0,
    passes: 0,
    result: null,
  };
}

export function isOver(state: State): boolean {
  return state.result !== null;
}

export function activePlayers(state: State): PlayerId[] {
  return isOver(state) ? [] : [PLAYERS[0]];
}

/** Cards on the foundations: the deal is won when this reaches the deck size. */
export function foundationCount(state: State): number {
  return state.foundations.reduce((sum, pile) => sum + pile.length, 0);
}

function canDraw(state: State): boolean {
  if (state.stock.length > 0) return true;
  if (state.waste.length === 0) return false;
  // Turning the waste back over costs a pass.
  return state.config.maxPasses === 0 || state.passes < state.config.maxPasses;
}

/** A foundation takes its own suit, in order, from the ace up. */
function foundationAccepts(state: State, index: number, card: number): boolean {
  const { config } = state;
  if (index < 0 || index >= config.suits) return false;
  return suitOf(card, config) === index && rankOf(card, config) === state.foundations[index]!.length;
}

/** A tableau pile takes a descending run of alternating colours; an empty one takes a king. */
function tableauAccepts(state: State, index: number, card: number): boolean {
  const { config } = state;
  const pile = state.tableau[index];
  if (!pile) return false;
  const top = pile.up[pile.up.length - 1];
  if (top === undefined) {
    return pile.down.length === 0 && (!config.emptyTableauNeedsKing || rankOf(card, config) === config.ranks - 1);
  }
  return rankOf(card, config) === rankOf(top, config) - 1 && colorOf(card, config) !== colorOf(top, config);
}

/** The cards an action would move, or null when the source cannot give them. */
function taken(state: State, from: Pile, count: number): number[] | null {
  if (!Number.isInteger(count) || count < 1) return null;
  switch (from.kind) {
    case "waste":
      return count === 1 && state.waste.length > 0 ? state.waste.slice(-1) : null;
    case "foundation": {
      const pile = state.foundations[from.index];
      return count === 1 && pile !== undefined && pile.length > 0 ? pile.slice(-1) : null;
    }
    case "tableau": {
      const pile = state.tableau[from.index];
      return pile !== undefined && count <= pile.up.length ? pile.up.slice(-count) : null;
    }
    case "stock":
      // The stock is only ever drawn from, never moved out of by hand.
      return null;
  }
}

function sameP(a: Pile, b: Pile): boolean {
  return a.kind === b.kind && a.index === b.index;
}

/** Whether the destination takes the run, given its bottom card. */
function accepts(state: State, to: Pile, cards: number[]): boolean {
  const bottom = cards[0]!;
  switch (to.kind) {
    case "foundation":
      return cards.length === 1 && foundationAccepts(state, to.index, bottom);
    case "tableau":
      return tableauAccepts(state, to.index, bottom);
    case "stock":
    case "waste":
      return false;
  }
}

export function legalActions(state: State, playerId: string): Action[] {
  if (state.result !== null || !isPlayer(playerId)) return [];
  const actions: Action[] = [];
  if (canDraw(state)) actions.push({ type: "draw" });

  const sources: Pile[] = [{ kind: "waste", index: 0 }];
  for (let i = 0; i < state.foundations.length; i++) sources.push({ kind: "foundation", index: i });
  for (let i = 0; i < state.tableau.length; i++) sources.push({ kind: "tableau", index: i });

  const destinations: Pile[] = [];
  for (let i = 0; i < state.foundations.length; i++) destinations.push({ kind: "foundation", index: i });
  for (let i = 0; i < state.tableau.length; i++) destinations.push({ kind: "tableau", index: i });

  for (const from of sources) {
    const max = from.kind === "tableau" ? (state.tableau[from.index]?.up.length ?? 0) : 1;
    for (let count = 1; count <= max; count++) {
      const cards = taken(state, from, count);
      if (cards === null) continue;
      for (const to of destinations) {
        if (sameP(from, to)) continue;
        // Moving a whole pile onto an empty one only renames the pile.
        if (from.kind === "tableau" && to.kind === "tableau" && count === (state.tableau[from.index]?.up.length ?? 0)) {
          if ((state.tableau[from.index]?.down.length ?? 0) === 0 && (state.tableau[to.index]?.up.length ?? 0) === 0) {
            continue;
          }
        }
        if (accepts(state, to, cards)) actions.push({ type: "move", from, to, count });
      }
    }
  }
  return actions;
}

function removeFrom(state: State, from: Pile, count: number): void {
  switch (from.kind) {
    case "waste":
      state.waste.length -= count;
      return;
    case "foundation":
      state.foundations[from.index]!.length -= count;
      return;
    case "tableau": {
      const pile = state.tableau[from.index]!;
      pile.up.length -= count;
      // Uncovering the next card is automatic; it is never a choice.
      if (pile.up.length === 0 && pile.down.length > 0) pile.up.push(pile.down.pop()!);
      return;
    }
    case "stock":
      throw new Error("Cannot move cards out of the stock");
  }
}

function addTo(state: State, to: Pile, cards: number[]): void {
  if (to.kind === "foundation") state.foundations[to.index]!.push(...cards);
  else if (to.kind === "tableau") state.tableau[to.index]!.up.push(...cards);
  else throw new Error(`Cannot move cards onto the ${to.kind}`);
}

/** Decide whether the deal has ended. Called once, after every action. */
function settle(state: State): void {
  if (foundationCount(state) === deckSize(state.config)) state.result = "won";
  else if (state.moves >= state.config.moveLimit) state.result = "move-limit";
  else if (legalActions(state, PLAYERS[0]).length === 0) state.result = "stuck";
}

/** Returns a new state; never mutates the input. Throws on illegal actions. */
export function applyAction(state: State, playerId: string, action: Action): State {
  if (state.result !== null) throw new Error(`Deal is over (${state.result})`);
  if (!isPlayer(playerId)) throw new Error(`Unknown player "${playerId}"`);

  const next = structuredClone(state);
  if (action.type === "draw") {
    if (!canDraw(next)) throw new Error("Nothing to draw: stock and waste are spent");
    if (next.stock.length === 0) {
      // Turn the waste back over: the top of the waste becomes the bottom.
      next.stock = next.waste.reverse();
      next.waste = [];
      next.passes += 1;
    } else {
      const count = Math.min(next.config.drawCount, next.stock.length);
      next.waste.push(...next.stock.splice(-count).reverse());
    }
  } else if (action.type === "move") {
    const cards = taken(next, action.from, action.count);
    if (cards === null) {
      throw new Error(`Cannot take ${action.count} from ${action.from.kind} ${action.from.index}`);
    }
    if (sameP(action.from, action.to) || !accepts(next, action.to, cards)) {
      throw new Error(
        `${action.to.kind} ${action.to.index} does not accept ${cards.length} card(s) from ${action.from.kind} ${action.from.index}`,
      );
    }
    removeFrom(next, action.from, action.count);
    addTo(next, action.to, cards);
  } else {
    throw new Error(`Unknown action type "${(action as { type: unknown }).type}"`);
  }

  next.moves += 1;
  settle(next);
  return next;
}

/** What `viewer` may see. Hides the order of every face-down card. */
export function viewFor(state: State, viewer: string): View {
  const you = isPlayer(viewer) ? viewer : null;
  return {
    you,
    stockCount: state.stock.length,
    waste: you ? state.waste.slice(-1) : [],
    wasteCount: state.waste.length,
    foundations: state.foundations.map((pile) => [...pile]),
    tableau: state.tableau.map((pile) => ({ downCount: pile.down.length, up: you ? [...pile.up] : [] })),
    moves: state.moves,
    moveLimit: state.config.moveLimit,
    passes: state.passes,
    maxPasses: state.config.maxPasses,
    drawCount: state.config.drawCount,
    result: state.result,
    won: foundationCount(state),
  };
}
