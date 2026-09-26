// Rules that must hold after every tick. Used by the seed sweep in
// sim.test.ts and by the in-browser playtest. Pure, like sim.ts.
//
// For a moving sim these carry more weight than in a card game: a NaN
// or an escaped player is exactly what a physics-ish tick produces when
// a number is wrong, and it is invisible in a screenshot.
import type { Invariant } from "@proto/testkit";
import { PLAYERS, type State } from "./sim";
import { isFiniteVec, length } from "./vec";

export const invariants: Invariant<State>[] = [
  {
    name: "finite-positions",
    check(s) {
      for (const id of PLAYERS) {
        const p = s.players[id];
        if (!isFiniteVec(p.position)) return `${id} position is ${JSON.stringify(p.position)}`;
        if (!isFiniteVec(p.velocity)) return `${id} velocity is ${JSON.stringify(p.velocity)}`;
      }
      const bad = s.pickups.find((p) => !isFiniteVec(p.position));
      return bad ? `pickup ${bad.id} position is ${JSON.stringify(bad.position)}` : null;
    },
  },
  {
    name: "inside-arena",
    check(s) {
      // Half a tick of float slack: the clamp is exact, but a future
      // tick that nudges the position afterwards should not trip this.
      const limit = s.config.arenaHalf - s.config.playerRadius + 1e-9;
      for (const id of PLAYERS) {
        const { x, z } = s.players[id].position;
        if (Math.abs(x) > limit || Math.abs(z) > limit) return `${id} at (${x}, ${z}) is outside ±${limit}`;
      }
      return null;
    },
  },
  {
    name: "speed-limit",
    check(s) {
      const bad = PLAYERS.find((id) => length(s.players[id].velocity) > s.config.maxSpeed + 1e-9);
      return bad ? `${bad} is moving at ${length(s.players[bad].velocity)}, over maxSpeed ${s.config.maxSpeed}` : null;
    },
  },
  {
    name: "resting-on-floor",
    check(s) {
      const bad = PLAYERS.find((id) => s.players[id].position.y !== s.config.playerRadius);
      return bad ? `${bad} is at y ${s.players[bad].position.y}, not resting at ${s.config.playerRadius}` : null;
    },
  },
  {
    name: "pickups-conserved",
    check(s) {
      if (s.pickups.length !== s.config.pickupCount) {
        return `${s.pickups.length} pickups exist, expected ${s.config.pickupCount}`;
      }
      const taken = s.pickups.filter((p) => p.taken).length;
      const collected = PLAYERS.reduce((sum, id) => sum + s.players[id].collected, 0);
      return taken === collected ? null : `${taken} pickups taken but players hold ${collected}`;
    },
  },
  {
    name: "tick-range",
    check: (s) =>
      s.tick >= 0 && s.tick <= s.config.maxTicks ? null : `tick ${s.tick} outside 0..${s.config.maxTicks}`,
  },
  {
    name: "winner-consistent",
    check(s) {
      if (s.winner === null) return null;
      const collected = s.players.p1.collected;
      if (s.winner === "timeout") {
        if (s.tick !== s.config.maxTicks) return `timed out on tick ${s.tick}, not maxTicks ${s.config.maxTicks}`;
        return collected < s.config.winAt ? null : `timed out holding ${collected} of ${s.config.winAt}`;
      }
      return collected >= s.config.winAt ? null : `${s.winner} won holding ${collected} of ${s.config.winAt}`;
    },
  },
];
