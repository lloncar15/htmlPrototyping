// Pure rules for the template: a placeholder two-player card game.
// Each player holds a hidden hand of random cards. On your turn you
// play one card: its value is added to your score and you draw a
// replacement. After maxTurns the higher score wins.
// No renderer, DOM, or Math.random() here. Randomness via @proto/core.
import { createRng, nextInt, type RngState } from "@proto/core";

export type Config = {
  version: number;
  handSize: number;
  minCard: number;
  maxCard: number;
  maxTurns: number;
};

export const PLAYERS = ["p1", "p2"] as const;
export type PlayerId = (typeof PLAYERS)[number];

export type Action = { type: "play"; index: number };

export type PlayerState = { score: number; hand: number[] };

export type State = {
  config: Config;
  seed: number;
  rng: RngState;
  /** 1-based; the game ends after turn config.maxTurns. */
  turn: number;
  active: PlayerId;
  players: Record<PlayerId, PlayerState>;
  winner: PlayerId | "draw" | null;
};

export type PlayerView = { score: number; handCount: number; hand: number[] | null };

export type View = {
  you: PlayerId | null;
  turn: number;
  maxTurns: number;
  active: PlayerId;
  winner: PlayerId | "draw" | null;
  players: Record<PlayerId, PlayerView>;
};

export function configVersion(config: Config): string {
  return `sim@${config.version}`;
}

function drawCard(state: State): number {
  return nextInt(state.rng, state.config.minCard, state.config.maxCard);
}

function isPlayer(id: string): id is PlayerId {
  return (PLAYERS as readonly string[]).includes(id);
}

export function init(seed: number, config: Config): State {
  if (config.handSize < 1 || config.maxTurns < 1 || config.minCard > config.maxCard) {
    throw new Error(`Invalid config: ${JSON.stringify(config)}`);
  }
  const state: State = {
    config: structuredClone(config),
    seed,
    rng: createRng(seed),
    turn: 1,
    active: PLAYERS[0],
    players: { p1: { score: 0, hand: [] }, p2: { score: 0, hand: [] } },
    winner: null,
  };
  for (const id of PLAYERS) {
    for (let i = 0; i < config.handSize; i++) state.players[id].hand.push(drawCard(state));
  }
  return state;
}

export function isOver(state: State): boolean {
  return state.winner !== null;
}

export function activePlayers(state: State): PlayerId[] {
  return isOver(state) ? [] : [state.active];
}

export function legalActions(state: State, playerId: string): Action[] {
  if (state.winner !== null || playerId !== state.active) return [];
  return state.players[state.active].hand.map((_, index) => ({ type: "play", index }));
}

/** Returns a new state; never mutates the input. Throws on illegal actions. */
export function applyAction(state: State, playerId: string, action: Action): State {
  if (state.winner !== null) throw new Error(`Game is over (winner: ${state.winner})`);
  if (!isPlayer(playerId)) throw new Error(`Unknown player "${playerId}"`);
  if (playerId !== state.active) throw new Error(`Not ${playerId}'s turn (active: ${state.active})`);
  if (action.type !== "play") throw new Error(`Unknown action type "${(action as { type: unknown }).type}"`);

  const next = structuredClone(state);
  const me = next.players[playerId];
  if (!Number.isInteger(action.index) || action.index < 0 || action.index >= me.hand.length) {
    throw new Error(`Card index ${action.index} out of range (hand size ${me.hand.length})`);
  }

  const [card] = me.hand.splice(action.index, 1) as [number];
  me.score += card;
  me.hand.push(drawCard(next));

  if (next.turn >= next.config.maxTurns) {
    const [a, b] = [next.players.p1.score, next.players.p2.score];
    next.winner = a === b ? "draw" : a > b ? "p1" : "p2";
  } else {
    next.turn += 1;
    next.active = playerId === "p1" ? "p2" : "p1";
  }
  return next;
}

/** What `viewer` may see. Hides other hands and the RNG (it would reveal future draws). */
export function viewFor(state: State, viewer: string): View {
  const you = isPlayer(viewer) ? viewer : null;
  const players = {} as Record<PlayerId, PlayerView>;
  for (const id of PLAYERS) {
    const p = state.players[id];
    players[id] = { score: p.score, handCount: p.hand.length, hand: id === you ? [...p.hand] : null };
  }
  return {
    you,
    turn: state.turn,
    maxTurns: state.config.maxTurns,
    active: state.active,
    winner: state.winner,
    players,
  };
}
