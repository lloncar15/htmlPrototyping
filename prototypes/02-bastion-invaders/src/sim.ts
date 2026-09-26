// Pure rules for Bastion Invaders: Space Invaders on a floating island.
//
// The field is the ground plane. x runs across, z runs away from the
// camera: the player walks a line near +z (playerZ), the formation starts
// far away at -z and marches side to side, stepping towards the player
// whenever it hits an edge. Bunkers are blocks of island tiles in
// between. Clear every invader to win; lose all lives, or let the
// formation reach invasionZ, and the invaders win.
//
// Real time expressed as turns: every tick is an action,
// `{ type: "tick", input }`, and the step length is config.tickMs, never
// the frame's dt. Shots move further than an invader is deep in one
// tick, so hits are tested along the segment a shot swept, not at its
// end point.
//
// No renderer, DOM, or Math.random() here. Only exactly-specified
// arithmetic, so a replay hashes the same everywhere.
import { createRng, nextFloat, nextInt, type RngState } from "@proto/core";
import { clamp } from "./vec";

export type Config = {
  version: number;
  /** Step length in ms. The frame rate never reaches the sim. */
  tickMs: number;
  /** The field spans -fieldHalfWidth..fieldHalfWidth across. */
  fieldHalfWidth: number;
  /** The line the player walks along. */
  playerZ: number;
  /** Near and far edges of the field; shots leaving it are gone. */
  arenaNearZ: number;
  arenaFarZ: number;
  playerHalfWidth: number;
  playerHalfDepth: number;
  /** Units per second. */
  playerSpeed: number;
  lives: number;
  /** Player shot speed, units per second, towards -z. */
  shotSpeed: number;
  shotCooldownTicks: number;
  maxPlayerShots: number;
  invaderCols: number;
  invaderRows: number;
  invaderSpacingX: number;
  invaderSpacingZ: number;
  invaderHalfSize: number;
  /** z of the back row when the wave starts. */
  formationStartZ: number;
  marchStepX: number;
  marchStepZ: number;
  /** Ticks between march steps with the full formation alive... */
  marchIntervalStart: number;
  /** ...shrinking in proportion to survivors, down to this. */
  marchIntervalMin: number;
  pointsFrontRow: number;
  /** Extra points for each row further back. */
  pointsPerRowBack: number;
  /** Chance per tick that some invader fires, while under maxEnemyShots. */
  enemyFireChance: number;
  enemyShotSpeed: number;
  maxEnemyShots: number;
  bunkerCount: number;
  bunkerCols: number;
  bunkerRows: number;
  bunkerBlockSize: number;
  bunkerZ: number;
  /** The formation wins when an invader's near edge reaches this z. */
  invasionZ: number;
  maxTicks: number;
};

export const PLAYERS = ["p1"] as const;
export type PlayerId = (typeof PLAYERS)[number];

/** One tick of held input. moveX is -1, 0 or 1; fire is 0 or 1 (held). */
export type Input = { moveX: number; fire: number };

export type Action = { type: "tick"; input: Input };

export type Invader = { id: number; col: number; row: number; alive: boolean };
export type Shot = { id: number; x: number; z: number };
export type Block = { id: number; x: number; z: number; alive: boolean };

export type Formation = {
  /** Offset of the whole grid from its starting layout. */
  x: number;
  z: number;
  dir: 1 | -1;
  /** Ticks left until the next march step. */
  timer: number;
  /** March steps taken so far; the view uses it for the step hop. */
  steps: number;
};

export type PlayerState = { x: number; lives: number; score: number; cooldown: number };

export type Winner = PlayerId | "invaders" | "timeout";

export type State = {
  config: Config;
  seed: number;
  rng: RngState;
  /** Ticks applied so far; 0 is the initial state. */
  tick: number;
  player: PlayerState;
  invaders: Invader[];
  formation: Formation;
  playerShots: Shot[];
  enemyShots: Shot[];
  blocks: Block[];
  nextShotId: number;
  winner: Winner | null;
};

export type InvaderView = { id: number; row: number; col: number; x: number; z: number };

export type View = {
  you: PlayerId | null;
  tick: number;
  maxTicks: number;
  winner: Winner | null;
  field: { halfWidth: number; nearZ: number; farZ: number; playerZ: number; invasionZ: number };
  player: { x: number; z: number; lives: number; score: number };
  invaders: InvaderView[];
  invaderRows: number;
  invaderTotal: number;
  /** For the view's step hop: which step, and how long a step lasts now. */
  march: { steps: number; interval: number };
  playerShots: Shot[];
  enemyShots: Shot[];
  blocks: { id: number; x: number; z: number }[];
};

const MOVES = [-1, 0, 1] as const;
const FIRES = [0, 1] as const;
const INTENTS: Input[] = FIRES.flatMap((fire) => MOVES.map((moveX) => ({ moveX, fire })));

export function configVersion(config: Config): string {
  return `sim@${config.version}`;
}

function isPlayer(id: string): id is PlayerId {
  return (PLAYERS as readonly string[]).includes(id);
}

function invaderX(config: Config, formation: Formation, col: number): number {
  return formation.x + (col - (config.invaderCols - 1) / 2) * config.invaderSpacingX;
}

function invaderZ(config: Config, formation: Formation, row: number): number {
  return formation.z + config.formationStartZ + row * config.invaderSpacingZ;
}

/** Row 0 is the back row, furthest from the player, and worth the most. */
export function pointsFor(config: Config, row: number): number {
  return config.pointsFrontRow + (config.invaderRows - 1 - row) * config.pointsPerRowBack;
}

/** Fewer survivors, faster march: the classic tension curve. */
export function marchInterval(config: Config, alive: number): number {
  const total = config.invaderCols * config.invaderRows;
  return Math.max(config.marchIntervalMin, Math.ceil((config.marchIntervalStart * alive) / total));
}

function buildBlocks(config: Config): Block[] {
  const blocks: Block[] = [];
  const span = (config.fieldHalfWidth * 2) / config.bunkerCount;
  for (let b = 0; b < config.bunkerCount; b++) {
    const cx = -config.fieldHalfWidth + (b + 0.5) * span;
    for (let r = 0; r < config.bunkerRows; r++) {
      for (let c = 0; c < config.bunkerCols; c++) {
        blocks.push({
          id: blocks.length,
          x: cx + (c - (config.bunkerCols - 1) / 2) * config.bunkerBlockSize,
          z: config.bunkerZ + (r - (config.bunkerRows - 1) / 2) * config.bunkerBlockSize,
          alive: true,
        });
      }
    }
  }
  return blocks;
}

export function init(seed: number, config: Config): State {
  if (!(config.tickMs > 0)) throw new Error(`tickMs must be > 0, got ${config.tickMs}`);
  if (config.fieldHalfWidth <= config.playerHalfWidth) {
    throw new Error(`fieldHalfWidth ${config.fieldHalfWidth} leaves no room for the player`);
  }
  const formationHalf = ((config.invaderCols - 1) * config.invaderSpacingX) / 2 + config.invaderHalfSize;
  if (formationHalf > config.fieldHalfWidth) {
    throw new Error(`the formation (half width ${formationHalf}) does not fit in fieldHalfWidth ${config.fieldHalfWidth}`);
  }
  if (!(config.invasionZ > config.formationStartZ)) {
    throw new Error(`invasionZ ${config.invasionZ} must be nearer than formationStartZ ${config.formationStartZ}`);
  }
  for (const key of ["invaderCols", "invaderRows", "lives", "maxTicks", "marchIntervalMin"] as const) {
    if (!Number.isInteger(config[key]) || config[key] < 1) throw new Error(`${key} must be an integer >= 1, got ${config[key]}`);
  }

  const invaders: Invader[] = [];
  for (let row = 0; row < config.invaderRows; row++) {
    for (let col = 0; col < config.invaderCols; col++) invaders.push({ id: invaders.length, col, row, alive: true });
  }
  return {
    config: structuredClone(config),
    seed,
    rng: createRng(seed),
    tick: 0,
    player: { x: 0, lives: config.lives, score: 0, cooldown: 0 },
    invaders,
    formation: { x: 0, z: 0, dir: 1, timer: marchInterval(config, invaders.length), steps: 0 },
    playerShots: [],
    enemyShots: [],
    blocks: buildBlocks(config),
    nextShotId: 0,
    winner: null,
  };
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
  const num = (value: unknown, name: string): number => {
    const n = value ?? 0;
    if (typeof n !== "number" || !Number.isFinite(n)) throw new Error(`input.${name} must be a finite number, got ${n}`);
    return n;
  };
  return { moveX: clamp(num(raw.moveX, "moveX"), -1, 1), fire: num(raw.fire, "fire") > 0 ? 1 : 0 };
}

/** A target a shot can hit: an axis-aligned square on the ground plane. */
type Target = { x: number; z: number; half: number; hit(): void };

/**
 * Of the targets the shot's swept segment passes through, the one it
 * meets first. `fromZ` is where the shot started this tick, `toZ` where
 * it ends; the segment runs either way along z.
 */
function firstHit(x: number, fromZ: number, toZ: number, targets: Target[]): Target | null {
  const lo = Math.min(fromZ, toZ);
  const hi = Math.max(fromZ, toZ);
  let best: Target | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const t of targets) {
    if (Math.abs(x - t.x) > t.half) continue;
    if (t.z + t.half < lo || t.z - t.half > hi) continue;
    // Distance from where the shot started to the target's near face.
    const face = toZ < fromZ ? t.z + t.half : t.z - t.half;
    const d = Math.abs(fromZ - face);
    if (d < bestDistance) {
      best = t;
      bestDistance = d;
    }
  }
  return best;
}

function aliveInvaders(state: State): Invader[] {
  return state.invaders.filter((i) => i.alive);
}

function blockTargets(state: State): Target[] {
  const half = state.config.bunkerBlockSize / 2;
  return state.blocks
    .filter((b) => b.alive)
    .map((b) => ({ x: b.x, z: b.z, half, hit: () => (b.alive = false) }));
}

function movePlayerShots(state: State, dt: number): void {
  const { config } = state;
  const kept: Shot[] = [];
  for (const shot of state.playerShots) {
    const toZ = shot.z - config.shotSpeed * dt;
    const invaderTargets: Target[] = aliveInvaders(state).map((inv) => ({
      x: invaderX(config, state.formation, inv.col),
      z: invaderZ(config, state.formation, inv.row),
      half: config.invaderHalfSize,
      hit: () => {
        inv.alive = false;
        state.player.score += pointsFor(config, inv.row);
      },
    }));
    const target = firstHit(shot.x, shot.z, toZ, [...invaderTargets, ...blockTargets(state)]);
    if (target) {
      target.hit();
      continue;
    }
    if (toZ < config.arenaFarZ) continue;
    kept.push({ ...shot, z: toZ });
  }
  state.playerShots = kept;
}

function moveEnemyShots(state: State, dt: number): void {
  const { config, player } = state;
  const kept: Shot[] = [];
  let playerHit = false;
  for (const shot of state.enemyShots) {
    const toZ = shot.z + config.enemyShotSpeed * dt;
    const playerTarget: Target = {
      x: player.x,
      z: config.playerZ,
      // The player is wider than deep; a square of the larger half would
      // let shots clip them from the side, so check depth separately below.
      half: config.playerHalfWidth,
      hit: () => (playerHit = true),
    };
    const inDepth = !(toZ < config.playerZ - config.playerHalfDepth || shot.z > config.playerZ + config.playerHalfDepth);
    const targets = inDepth ? [...blockTargets(state), playerTarget] : blockTargets(state);
    const target = firstHit(shot.x, shot.z, toZ, targets);
    if (target) {
      target.hit();
      continue;
    }
    if (toZ > config.arenaNearZ) continue;
    kept.push({ ...shot, z: toZ });
  }
  state.enemyShots = kept;
  if (playerHit) {
    player.lives -= 1;
    // A breather after a hit, as in the arcade: the sky clears.
    state.enemyShots = [];
  }
}

function march(state: State): void {
  const { config, formation } = state;
  const alive = aliveInvaders(state);
  if (alive.length === 0) return;
  formation.timer -= 1;
  if (formation.timer > 0) return;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  for (const inv of alive) {
    const x = invaderX(config, formation, inv.col);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }
  const limit = config.fieldHalfWidth - config.invaderHalfSize;
  const next = formation.dir * config.marchStepX;
  if (maxX + next > limit || minX + next < -limit) {
    formation.z += config.marchStepZ;
    formation.dir = formation.dir === 1 ? -1 : 1;
  } else {
    formation.x += next;
  }
  formation.steps += 1;
  formation.timer = marchInterval(config, alive.length);

  // Invaders walking into a bunker crush it, as in the original.
  const half = config.invaderHalfSize + config.bunkerBlockSize / 2;
  for (const block of state.blocks) {
    if (!block.alive) continue;
    for (const inv of alive) {
      const dx = Math.abs(block.x - invaderX(config, formation, inv.col));
      const dz = Math.abs(block.z - invaderZ(config, formation, inv.row));
      if (dx < half && dz < half) block.alive = false;
    }
  }
}

function enemyFire(state: State): void {
  const { config, formation } = state;
  if (state.enemyShots.length >= config.maxEnemyShots) return;
  if (nextFloat(state.rng) >= config.enemyFireChance) return;
  const alive = aliveInvaders(state);
  const cols = [...new Set(alive.map((i) => i.col))].sort((a, b) => a - b);
  if (cols.length === 0) return;
  const col = cols[nextInt(state.rng, 0, cols.length - 1)] as number;
  // The front-most invader in the column fires, so shots never pass
  // through their own ranks.
  let shooter: Invader | undefined;
  for (const inv of alive) if (inv.col === col && (!shooter || inv.row > shooter.row)) shooter = inv;
  if (!shooter) return;
  state.enemyShots.push({
    id: state.nextShotId++,
    x: invaderX(config, formation, shooter.col),
    z: invaderZ(config, formation, shooter.row) + config.invaderHalfSize,
  });
}

/** Returns a new state; never mutates the input. Throws on illegal actions. */
export function applyAction(state: State, playerId: string, action: Action): State {
  if (state.winner !== null) throw new Error(`Run is over (winner: ${state.winner})`);
  if (!isPlayer(playerId)) throw new Error(`Unknown player "${playerId}"`);
  if (action.type !== "tick") throw new Error(`Unknown action type "${(action as { type: unknown }).type}"`);

  const next = structuredClone(state);
  const { config, player } = next;
  const dt = config.tickMs / 1000;
  const input = readInput(action.input);

  // Walk: no inertia. Invaders is about placement, not momentum.
  const limit = config.fieldHalfWidth - config.playerHalfWidth;
  player.x = clamp(player.x + input.moveX * config.playerSpeed * dt, -limit, limit);

  if (player.cooldown > 0) player.cooldown -= 1;
  if (input.fire === 1 && player.cooldown === 0 && next.playerShots.length < config.maxPlayerShots) {
    next.playerShots.push({ id: next.nextShotId++, x: player.x, z: config.playerZ - config.playerHalfDepth });
    player.cooldown = config.shotCooldownTicks;
  }

  movePlayerShots(next, dt);
  moveEnemyShots(next, dt);
  march(next);
  enemyFire(next);

  next.tick += 1;
  const alive = aliveInvaders(next);
  const invaded = alive.some((inv) => invaderZ(config, next.formation, inv.row) + config.invaderHalfSize >= config.invasionZ);
  if (alive.length === 0) next.winner = "p1";
  else if (player.lives <= 0 || invaded) next.winner = "invaders";
  else if (next.tick >= config.maxTicks) next.winner = "timeout";
  return next;
}

/** What `viewFor` may see. The RNG is hidden: it decides who fires next. */
export function viewFor(state: State, viewer: string): View {
  const { config, formation } = state;
  const alive = aliveInvaders(state);
  return {
    you: isPlayer(viewer) ? viewer : null,
    tick: state.tick,
    maxTicks: config.maxTicks,
    winner: state.winner,
    field: {
      halfWidth: config.fieldHalfWidth,
      nearZ: config.arenaNearZ,
      farZ: config.arenaFarZ,
      playerZ: config.playerZ,
      invasionZ: config.invasionZ,
    },
    player: { x: state.player.x, z: config.playerZ, lives: state.player.lives, score: state.player.score },
    invaders: alive.map((inv) => ({
      id: inv.id,
      row: inv.row,
      col: inv.col,
      x: invaderX(config, formation, inv.col),
      z: invaderZ(config, formation, inv.row),
    })),
    invaderRows: config.invaderRows,
    invaderTotal: state.invaders.length,
    march: { steps: formation.steps, interval: marchInterval(config, Math.max(1, alive.length)) },
    playerShots: state.playerShots.map((s) => ({ ...s })),
    enemyShots: state.enemyShots.map((s) => ({ ...s })),
    blocks: state.blocks.filter((b) => b.alive).map((b) => ({ id: b.id, x: b.x, z: b.z })),
  };
}
