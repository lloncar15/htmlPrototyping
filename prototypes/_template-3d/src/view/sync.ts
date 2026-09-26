// Maps a viewFor() snapshot onto the stage's meshes. The view is plain
// {x,y,z} data; this file is where it becomes THREE.Vector3.
//
// The sim ticks at tickMs (20 Hz by default) and the screen refreshes
// faster, so drawing the raw tick position looks stepped. The sync keeps
// the previous snapshot and interpolates towards the current one with
// `alpha(clock)` from @proto/core. Interpolation is cosmetic: it never
// feeds back into the sim, which only ever sees whole ticks.
import type { Vec3 } from "../vec";
import type { View } from "../sim";
import type { CameraSpec, Stage } from "./scene";

type Snapshot = { player: Vec3; pickups: Map<number, Vec3> };

export type Sync = {
  /** Call once per tick, with the state the sim just produced. */
  push(view: View): void;
  /** Call once per frame. `alpha` is 0..1 through the current tick. */
  draw(alpha: number): void;
};

function snapshot(view: View): Snapshot {
  return {
    player: { ...view.players.p1.position },
    pickups: new Map(view.pickups.map((p) => [p.id, { ...p.position }])),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function createSync(stage: Stage, camera: CameraSpec): Sync {
  let previous: Snapshot | null = null;
  let current: Snapshot | null = null;
  let cameraReady = false;

  return {
    push(view) {
      previous = current;
      current = snapshot(view);
    },

    draw(alpha) {
      if (!current) return;
      const from = previous ?? current;
      const t = previous ? Math.min(Math.max(alpha, 0), 1) : 1;

      const x = lerp(from.player.x, current.player.x, t);
      const y = lerp(from.player.y, current.player.y, t);
      const z = lerp(from.player.z, current.player.z, t);
      stage.playerMesh.position.set(x, y, z);

      // Pickups never move; a mesh is simply shown until its id leaves
      // the view, which is what "collected" looks like from out here.
      stage.pickupMeshes.forEach((mesh, id) => {
        const position = current?.pickups.get(id);
        mesh.visible = position !== undefined;
        if (position) mesh.position.set(position.x, position.y + 0.45, position.z);
      });

      // A chase camera that lags the player, so motion reads as motion.
      // It snaps on the first frame: easing in from the origin would
      // make every screenshot of tick 0 a different picture.
      const targetX = x;
      const targetZ = z + camera.distance;
      if (!cameraReady) {
        stage.camera.position.set(targetX, camera.height, targetZ);
        cameraReady = true;
      } else {
        stage.camera.position.x = lerp(stage.camera.position.x, targetX, camera.follow);
        stage.camera.position.y = camera.height;
        stage.camera.position.z = lerp(stage.camera.position.z, targetZ, camera.follow);
      }
      // Aim past the player, not at them: aiming at the capsule puts it
      // dead centre and fills the top half of the frame with empty sky.
      stage.camera.lookAt(x, 0, z - camera.lookAhead);
      stage.render();
    },
  };
}
