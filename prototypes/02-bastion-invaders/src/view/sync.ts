// Places the stage's objects from viewFor() snapshots, once per frame.
// The view is plain {x,z} data; this is where it becomes transforms.
//
// Everything that moves is timed in ticks, as `tick + alpha`, never in
// wall-clock ms: the sim ticks at tickMs, positions are interpolated
// between the last two snapshots, and every effect (the island rising,
// the march hop, debris, camera shake) is a function of that tick
// clock. Under ?playtest the hook renders at alpha 1, so a screenshot of
// tick N is the same picture on any machine.
//
// Nothing here feeds back into the sim. Effects are driven by diffs
// between snapshots: an invader id that vanished died, a lower lives
// count was a hit.
import * as THREE from "three";
import type { Shot, View } from "../sim";
import { hash01, type CameraSpec, type EffectsSpec, type IslandSpec, type Stage } from "./scene";

export type Sync = {
  /** Call once per tick, with the view the sim just produced. */
  push(view: View): void;
  /** Call once per frame. `alpha` is 0..1 through the current tick. */
  draw(alpha: number): void;
};

type Pos = { x: number; z: number };
type Spark = { slot: number; x: number; y: number; z: number; tick: number; seed: number };

const GRAVITY = 18;
const MOTE_RISE = 0.02;
const DEG = Math.PI / 180;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutBack(t: number): number {
  const c = 1.4;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

export function createSync(
  stage: Stage,
  spec: { camera: CameraSpec; island: IslandSpec; effects: EffectsSpec },
  tickMs: number,
): Sync {
  let previous: View | null = null;
  let current: View | null = null;
  let lastStepTick = 0;
  let shakeTick = Number.NEGATIVE_INFINITY;
  let nextSlot = 0;
  const sparks: Spark[] = [];
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const tickSeconds = tickMs / 1000;

  const spawnDebris = (x: number, y: number, z: number, color: THREE.Color, tick: number, seed: number): void => {
    for (let i = 0; i < spec.effects.debrisPerKill; i++) {
      const slot = nextSlot++ % stage.debris.length;
      const d = stage.debris[slot];
      if (!d) continue;
      d.material.color.copy(color);
      const existing = sparks.findIndex((s) => s.slot === slot);
      if (existing >= 0) sparks.splice(existing, 1);
      sparks.push({ slot, x, y, z, tick, seed: seed * 31 + i });
    }
  };

  const byId = <T extends { id: number }>(list: T[]): Map<number, T> => new Map(list.map((e) => [e.id, e]));

  return {
    push(view) {
      previous = current;
      current = view;
      if (!previous || view.tick < previous.tick) {
        // A restart: drop effects from the old run.
        previous = null;
        sparks.length = 0;
        shakeTick = Number.NEGATIVE_INFINITY;
        lastStepTick = 0;
        return;
      }
      if (view.march.steps !== previous.march.steps) lastStepTick = view.tick;
      if (view.player.lives < previous.player.lives) shakeTick = view.tick;

      const alive = byId(view.invaders);
      for (const inv of previous.invaders) {
        if (!alive.has(inv.id)) {
          spawnDebris(inv.x, spec.effects.hoverHeight, inv.z, stage.invaderColor(inv.row), view.tick, inv.id);
        }
      }
      const blocks = byId(view.blocks);
      for (const b of previous.blocks) {
        if (!blocks.has(b.id)) spawnDebris(b.x, 0.4, b.z, stage.blockColor(), view.tick, 1000 + b.id);
      }
    },

    draw(alpha) {
      const view = current;
      if (!view) return;
      const prev = previous ?? view;
      const a = previous ? Math.min(Math.max(alpha, 0), 1) : 1;
      // The view's clock, in ticks. Starts at 0 on every restart.
      const t = view.tick - 1 + a + (previous ? 0 : 1);

      // --- The island assembles itself, tile by tile. ---
      const { tiles, tileTops, tileRoots } = stage;
      const { island, effects } = spec;
      tiles.forEach((tile, i) => {
        const p = Math.min(Math.max((t - tile.delay) / effects.assembleTicks, 0), 1);
        const rise = p >= 1 ? 0 : -effects.assembleDrop * (1 - easeOutBack(p));
        const hidden = p <= 0;
        const size = 1 - island.tileGap;
        pos.set(tile.x, rise - island.tileHeight / 2, tile.z);
        scale.set(hidden ? 0 : size, island.tileHeight, hidden ? 0 : size);
        tileTops.setMatrixAt(i, matrix.compose(pos, quat.identity(), scale));
        pos.set(tile.x, rise - island.tileHeight - tile.rootLength / 2, tile.z);
        // Roots taper by being a little narrower than the tile above.
        scale.set(hidden ? 0 : size * 0.86, tile.rootLength, hidden ? 0 : size * 0.86);
        tileRoots.setMatrixAt(i, matrix.compose(pos, quat, scale));
      });
      tileTops.instanceMatrix.needsUpdate = true;
      tileRoots.instanceMatrix.needsUpdate = true;
      tileTops.computeBoundingSphere();
      tileRoots.computeBoundingSphere();

      // --- Player. ---
      const px = lerp(prev.player.x, view.player.x, a);
      const moving = Math.abs(view.player.x - prev.player.x) > 1e-6;
      stage.player.position.set(px, moving ? Math.abs(Math.sin(t * 0.9)) * 0.12 : 0, view.player.z);
      stage.player.rotation.z = moving ? Math.sign(view.player.x - prev.player.x) * -0.12 : 0;
      stage.player.visible = view.player.lives > 0;

      // --- Invaders: interpolated march, a hop on each step, idle bob. ---
      const prevInvaders = byId(prev.invaders);
      const sinceStep = (t - lastStepTick) / Math.max(1, view.march.interval);
      const hop = spec.effects.hopHeight * Math.max(0, 1 - sinceStep * 2) * (lastStepTick > 0 ? 1 : 0);
      const alive = byId(view.invaders);
      stage.invaders.forEach((rig, id) => {
        const inv = alive.get(id);
        rig.group.visible = inv !== undefined;
        if (!inv) return;
        const from = prevInvaders.get(id) ?? inv;
        const bob = Math.sin(t * 0.25 + id * 1.7) * 0.06;
        rig.group.position.set(lerp(from.x, inv.x, a), effects.hoverHeight + hop + bob, lerp(from.z, inv.z, a));
        rig.group.rotation.y = Math.sin(t * 0.1 + id) * 0.25;
      });

      // --- Bunkers. ---
      const blocks = byId(view.blocks);
      stage.blocks.forEach((mesh, id) => {
        const b = blocks.get(id);
        mesh.visible = b !== undefined && t > 0;
        if (b) mesh.position.set(b.x, (mesh.scale.y / 2) * Math.min(1, Math.max(0, t / effects.assembleTicks)), b.z);
      });

      // --- Shots, interpolated by id; a new shot appears where it is. ---
      const placeShots = (meshes: THREE.Mesh[], now: Shot[], before: Map<number, Pos>, y: number): void => {
        meshes.forEach((mesh, i) => {
          const shot = now[i];
          mesh.visible = shot !== undefined;
          if (!shot) return;
          const from = before.get(shot.id) ?? shot;
          mesh.position.set(lerp(from.x, shot.x, a), y, lerp(from.z, shot.z, a));
        });
      };
      placeShots(stage.playerShots, view.playerShots, byId(prev.playerShots), effects.hoverHeight);
      placeShots(stage.enemyShots, view.enemyShots, byId(prev.enemyShots), effects.hoverHeight);
      stage.enemyShots.forEach((m) => (m.rotation.y = t * 0.8));

      // --- Debris: thrown up, falls through the island into the void. ---
      const live = new Set<number>();
      for (const s of sparks) {
        const age = t - s.tick;
        const d = stage.debris[s.slot];
        if (!d || age < 0 || age > effects.debrisTicks) continue;
        live.add(s.slot);
        const sec = age * tickSeconds;
        const vx = (hash01(s.seed, 1) * 2 - 1) * 3;
        const vz = (hash01(s.seed, 2) * 2 - 1) * 3;
        const vy = 3 + hash01(s.seed, 3) * 4;
        d.mesh.position.set(s.x + vx * sec, s.y + vy * sec - (GRAVITY * sec * sec) / 2, s.z + vz * sec);
        d.mesh.rotation.set(age * 0.5 + s.seed, age * 0.3, 0);
        d.mesh.scale.setScalar(1 - age / effects.debrisTicks / 2);
      }
      stage.debris.forEach((d, slot) => (d.mesh.visible = live.has(slot)));

      // --- Motes drift up through the void and wrap. ---
      const attr = stage.motes.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
      const base = stage.motes.userData.base as Float32Array | undefined;
      if (attr && base) {
        for (let i = 0; i < attr.count; i++) {
          const y = base[i * 3 + 1] as number;
          attr.setY(i, -12 + ((y + 12 + t * MOTE_RISE * (1 + (i % 5))) % 20));
        }
        attr.needsUpdate = true;
      }

      // --- Camera: fixed isometric framing, easing a little after the
      // player, with a short shake when they are hit. ---
      const cam = spec.camera;
      const pitch = cam.pitchDeg * DEG;
      const yaw = cam.yawDeg * DEG;
      const k = (t - shakeTick) / cam.shakeTicks;
      const shake = k >= 0 && k < 1 ? cam.shake * (1 - k) : 0;
      const tx = px * cam.follow + Math.sin(t * 2.3) * shake;
      const tz = cam.targetZ + Math.cos(t * 1.9) * shake;
      stage.camera.position.set(
        tx + Math.sin(yaw) * Math.cos(pitch) * cam.distance,
        Math.sin(pitch) * cam.distance,
        tz + Math.cos(yaw) * Math.cos(pitch) * cam.distance,
      );
      stage.camera.lookAt(tx, 0, tz);
      stage.render();
    },
  };
}
