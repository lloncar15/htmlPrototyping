// Rules that must hold after every tick. Used by the seed sweep in
// sim.test.ts and by the in-browser playtest. Pure, like sim.ts.
import type { Invariant } from "@proto/testkit";
import { pointsFor, type State } from "./sim";

const EPSILON = 1e-9;

export const invariants: Invariant<State>[] = [
  {
    name: "finite-numbers",
    check(s) {
      const nums = [
        s.player.x,
        s.formation.x,
        s.formation.z,
        ...s.playerShots.flatMap((p) => [p.x, p.z]),
        ...s.enemyShots.flatMap((p) => [p.x, p.z]),
      ];
      return nums.every(Number.isFinite) ? null : `non-finite number in player, formation or shots`;
    },
  },
  {
    name: "player-on-field",
    check(s) {
      const limit = s.config.fieldHalfWidth - s.config.playerHalfWidth + EPSILON;
      return Math.abs(s.player.x) <= limit ? null : `player at x ${s.player.x} is outside ±${limit}`;
    },
  },
  {
    name: "shot-limits",
    check(s) {
      if (s.playerShots.length > s.config.maxPlayerShots) {
        return `${s.playerShots.length} player shots, over maxPlayerShots ${s.config.maxPlayerShots}`;
      }
      if (s.enemyShots.length > s.config.maxEnemyShots) {
        return `${s.enemyShots.length} enemy shots, over maxEnemyShots ${s.config.maxEnemyShots}`;
      }
      const out = [...s.playerShots, ...s.enemyShots].find((p) => p.z < s.config.arenaFarZ || p.z > s.config.arenaNearZ);
      return out ? `shot ${out.id} at z ${out.z} is off the field` : null;
    },
  },
  {
    name: "score-matches-kills",
    check(s) {
      const expected = s.invaders.filter((i) => !i.alive).reduce((sum, i) => sum + pointsFor(s.config, i.row), 0);
      return s.player.score === expected ? null : `score ${s.player.score} but kills are worth ${expected}`;
    },
  },
  {
    name: "lives-range",
    check: (s) =>
      s.player.lives >= 0 && s.player.lives <= s.config.lives ? null : `lives ${s.player.lives} outside 0..${s.config.lives}`,
  },
  {
    name: "formation-only-advances",
    check(s) {
      // The formation never steps back towards the far edge.
      return s.formation.z >= 0 ? null : `formation z offset ${s.formation.z} went backwards`;
    },
  },
  {
    name: "tick-range",
    check: (s) => (s.tick >= 0 && s.tick <= s.config.maxTicks ? null : `tick ${s.tick} outside 0..${s.config.maxTicks}`),
  },
  {
    name: "winner-consistent",
    check(s) {
      const alive = s.invaders.filter((i) => i.alive).length;
      if (s.winner === "p1") return alive === 0 ? null : `p1 won with ${alive} invaders alive`;
      if (s.winner === null) return alive > 0 && s.player.lives > 0 ? null : `game should be over (alive ${alive}, lives ${s.player.lives})`;
      if (s.winner === "timeout") return s.tick === s.config.maxTicks ? null : `timed out on tick ${s.tick}`;
      return alive > 0 ? null : `invaders won with none alive`;
    },
  },
];
