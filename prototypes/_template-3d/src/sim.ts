// Pure rules for the 3D template: a placeholder collect-em-up. One
// player slides a capsule around a square arena and runs over pickups
// the seeded RNG scattered at the start. Collect `winAt` of them before
// `maxTicks` and you win; otherwise the run times out.
//
// This is a real-time game expressed as turns: every tick is an action,
// `{ type: "tick", input }`, and the step length comes from config
// (`tickMs`), never from the frame's dt. That is what keeps it
// deterministic and lets it run in `replay` mode like any card game.
//
// No renderer, DOM, or Math.random() here. Positions are plain {x,y,z}
// (see ./vec), never THREE.Vector3.
import { createRng, nextFloat, type RngState } from "@proto/core";
import { add, clamp, clampLength, distance, normalize, scale, vec3, type Vec3 } from "./vec";

export type Config = {
  version: number;
  /** Step length in ms. The frame rate never reaches the sim. */
  tickMs: number;
  /** Half the arena's side length; the floor spans -arenaHalf..arenaHalf. */
  arenaHalf: number;
  playerRadius: number;
  moveAccel: number;
  maxSpeed: number;
  /** Velocity decay per second; higher stops the capsule sooner. */
  damping: number;
  pickupCount: number;
  /** Collected when the player's centre is this close to the pickup's. */
  pickupRadius: number;
  /** Pickups spawn at least this far from the player's start. */
  pickupMinSpawnDistance: number;
  winAt: number;
  maxTicks: number;
};

export const PLAYERS = ["p1"] as const;
export type PlayerId = (typeof PLAYERS)[number];

/** One tick of held input. Axes are -1, 0 or 1; the sim normalizes them. */
export type Input = { moveX: number; moveZ: number };

export type Action = { type: "tick"; input: Input };

export type Pickup = { id: number; position: Vec3; taken: boolean };

export type PlayerState = { position: Vec3; velocity: Vec3; collected: number };

export type State = {
  config: Config;
  seed: number;
  rng: RngState;
  /** Ticks applied so far; 0 is the initial state. */
  tick: number;
  players: Record<PlayerId, PlayerState>;
  pickups: Pickup[];
  /** "p1" when the target is reached, "timeout" at maxTicks, null while playing. */
  winner: PlayerId | "timeout" | null;
};

export type PlayerView = { position: Vec3; velocity: Vec3; collected: number };

export type View = {
  you: PlayerId | null;
  tick: number;
  maxTicks: number;
  winAt: number;
  arenaHalf: number;
  winner: PlayerId | "timeout" | null;
  players: Record<PlayerId, PlayerView>;
  /** Only the pickups still on the floor; a taken one is gone from the view. */
  pickups: { id: number; position: Vec3 }[];
};

// The nine held-input combinations. `legalActions` hands these to the
// random bot, which is why the input axes are discrete rather than
// analogue: a batch run explores a small, enumerable space.
const AXES = [-1, 0, 1] as const;
const INTENTS: Input[] = AXES.flatMap((moveZ) => AXES.map((moveX) => ({ moveX, moveZ })));

export function configVersion(config: Config): string {
  return `sim@${config.version}`;
}

function isPlayer(id: string): id is PlayerId {
  return (PLAYERS as readonly string[]).includes(id);
}

/** The floor is square, so the capsule's centre is clamped to a smaller square. */
function movementLimit(config: Config): number {
  return config.arenaHalf - config.playerRadius;
}

function spawnPickups(state: State): Pickup[] {
  const { config } = state;
  const limit = movementLimit(config);
  const start = state.players.p1.position;
  const pickups: Pickup[] = [];
  for (let id = 0; id < config.pickupCount; id++) {
    // Rejection sampling keeps the opening from being a free pickup.
    // Bounded, so a bad config cannot hang the sim: after the cap we
    // take whatever came out, and the min-distance is best-effort.
    let position = vec3();
    for (let attempt = 0; attempt < 16; attempt++) {
      position = vec3((nextFloat(state.rng) * 2 - 1) * limit, 0, (nextFloat(state.rng) * 2 - 1) * limit);
      if (distance(position, start) >= config.pickupMinSpawnDistance) break;
    }
    pickups.push({ id, position, taken: false });
  }
  return pickups;
}

export function init(seed: number, config: Config): State {
  if (!(config.tickMs > 0)) throw new Error(`tickMs must be > 0, got ${config.tickMs}`);
  if (config.arenaHalf <= config.playerRadius) {
    throw new Error(`arenaHalf ${config.arenaHalf} leaves no room for a player of radius ${config.playerRadius}`);
  }
  if (config.pickupCount < 1 || config.winAt < 1 || config.winAt > config.pickupCount) {
    throw new Error(`winAt must be 1..pickupCount, got ${config.winAt} of ${config.pickupCount}`);
  }
  if (!Number.isInteger(config.maxTicks) || config.maxTicks < 1) {
    throw new Error(`maxTicks must be an integer >= 1, got ${config.maxTicks}`);
  }

  const state: State = {
    config: structuredClone(config),
    seed,
    rng: createRng(seed),
    tick: 0,
    // y is the capsule's centre height: it rests on the floor.
    players: { p1: { position: vec3(0, config.playerRadius, 0), velocity: vec3(), collected: 0 } },
    pickups: [],
    winner: null,
  };
  state.pickups = spawnPickups(state);
  return state;
}

export function isOver(state: State): boolean {
  return state.winner !== null;
}

export function activePlayers(state: State): PlayerId[] {
  return isOver(state) ? [] : ["p1"];
}

export function legalActions(state: State, playerId: string): Action[] {
  if (state.winner !== null || !isPlayer(playerId)) return [];
  return INTENTS.map((input) => ({ type: "tick", input: { ...input } }));
}

function readInput(input: unknown): Input {
  const raw = (input ?? {}) as Partial<Input>;
  const axis = (value: unknown, name: string): number => {
    const n = value ?? 0;
    if (typeof n !== "number" || !Number.isFinite(n))
      throw new Error(`input.${name} must be a finite number, got ${n}`);
    return clamp(n, -1, 1);
  };
  return { moveX: axis(raw.moveX, "moveX"), moveZ: axis(raw.moveZ, "moveZ") };
}

/** Returns a new state; never mutates the input. Throws on illegal actions. */
export function applyAction(state: State, playerId: string, action: Action): State {
  if (state.winner !== null) throw new Error(`Run is over (winner: ${state.winner})`);
  if (!isPlayer(playerId)) throw new Error(`Unknown player "${playerId}"`);
  if (action.type !== "tick") throw new Error(`Unknown action type "${(action as { type: unknown }).type}"`);

  const next = structuredClone(state);
  const { config } = next;
  const dt = config.tickMs / 1000;
  const me = next.players[playerId];
  const input = readInput(action.input);

  // Accelerate along the held direction, then bleed speed off. The
  // damping is the implicit-Euler form (divide, don't Math.exp): stable
  // at any tickMs and made of exactly-specified arithmetic.
  const direction = normalize(vec3(input.moveX, 0, input.moveZ));
  const accelerated = add(me.velocity, scale(direction, config.moveAccel * dt));
  const damped = scale(accelerated, 1 / (1 + config.damping * dt));
  me.velocity = clampLength(damped, config.maxSpeed);
  me.position = add(me.position, scale(me.velocity, dt));

  // Walls are hard stops: clamping the position alone would leave the
  // capsule pressed into the wall with stored speed, and it would shoot
  // off the moment the player turned around.
  const limit = movementLimit(config);
  if (me.position.x < -limit || me.position.x > limit) {
    me.position.x = clamp(me.position.x, -limit, limit);
    me.velocity.x = 0;
  }
  if (me.position.z < -limit || me.position.z > limit) {
    me.position.z = clamp(me.position.z, -limit, limit);
    me.velocity.z = 0;
  }
  me.position.y = config.playerRadius;
  me.velocity.y = 0;

  for (const pickup of next.pickups) {
    if (pickup.taken) continue;
    // Compare on the floor plane: the pickup sits at y=0 and the capsule
    // centre at playerRadius, and that gap should not count as distance.
    const dx = me.position.x - pickup.position.x;
    const dz = me.position.z - pickup.position.z;
    if (dx * dx + dz * dz <= config.pickupRadius * config.pickupRadius) {
      pickup.taken = true;
      me.collected += 1;
    }
  }

  next.tick += 1;
  if (me.collected >= config.winAt) next.winner = playerId;
  else if (next.tick >= config.maxTicks) next.winner = "timeout";
  return next;
}

/** What `viewFor` may see. The RNG is hidden: it decided the layout and nothing since. */
export function viewFor(state: State, viewer: string): View {
  const you = isPlayer(viewer) ? viewer : null;
  const players = {} as Record<PlayerId, PlayerView>;
  for (const id of PLAYERS) {
    const p = state.players[id];
    players[id] = { position: { ...p.position }, velocity: { ...p.velocity }, collected: p.collected };
  }
  return {
    you,
    tick: state.tick,
    maxTicks: state.config.maxTicks,
    winAt: state.config.winAt,
    arenaHalf: state.config.arenaHalf,
    winner: state.winner,
    players,
    pickups: state.pickups.filter((p) => !p.taken).map((p) => ({ id: p.id, position: { ...p.position } })),
  };
}
