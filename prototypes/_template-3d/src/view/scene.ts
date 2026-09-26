// Renderer, camera, lights and graybox meshes. three.js is allowed here
// and in src/main.ts only — never in src/sim.ts.
//
// Colours come from config/theme.json read as JS values, not as CSS
// custom properties: WebGL materials cannot read `var(--ground)`. The
// same file still feeds the DOM overlay, so one edit reskins both, and
// `applyTheme` re-reads it when the tuning panel changes a colour.
//
// Graybox on purpose: primitives, flat colours, one directional light.
// Polish belongs in a prototype whose question is about visuals.
import * as THREE from "three";

export type SceneTheme = {
  sky: string;
  ground: string;
  grid: string;
  player: string;
  pickup: string;
  fog: string;
  fogNear: number;
  fogFar: number;
};

export type CameraSpec = { fov: number; height: number; distance: number; follow: number; lookAhead: number };

export type Stage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  playerMesh: THREE.Mesh;
  /** Pool of pickup meshes, indexed by pickup id; hidden when collected. */
  pickupMeshes: THREE.Mesh[];
  /** Rebuild the arena and pool after arena size or pickup count changed. */
  rebuild(arenaHalf: number, pickupCount: number, playerRadius: number): void;
  applyTheme(theme: SceneTheme): void;
  resize(width: number, height: number): void;
  render(): void;
  dispose(): void;
};

/** Everything under this node is torn down and rebuilt when the config changes. */
const ARENA_GROUP = "arena";

export function createStage(
  canvas: HTMLCanvasElement,
  theme: SceneTheme,
  camera: CameraSpec,
  playtesting: boolean,
): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    // Only under ?playtest: the screenshot reads the buffer back after
    // the frame, which a swapped buffer would have already discarded.
    preserveDrawingBuffer: playtesting,
  });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(camera.fov, 1, 0.1, 500);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(6, 12, 8);
  const fill = new THREE.HemisphereLight(0xffffff, 0x20242c, 1.1);
  scene.add(key, fill);

  const playerMaterial = new THREE.MeshLambertMaterial();
  const pickupMaterial = new THREE.MeshLambertMaterial();
  const groundMaterial = new THREE.MeshLambertMaterial();

  const playerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(1, 1, 4, 12), playerMaterial);
  scene.add(playerMesh);

  const pickupMeshes: THREE.Mesh[] = [];
  let currentTheme = theme;

  const disposeArena = (): void => {
    const old = scene.getObjectByName(ARENA_GROUP);
    if (!old) return;
    scene.remove(old);
    old.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
      if (child instanceof THREE.GridHelper) child.geometry.dispose();
    });
  };

  const stage: Stage = {
    renderer,
    scene,
    camera: cam,
    playerMesh,
    pickupMeshes,

    rebuild(arenaHalf, pickupCount, playerRadius) {
      disposeArena();
      const group = new THREE.Group();
      group.name = ARENA_GROUP;

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(arenaHalf * 2, arenaHalf * 2), groundMaterial);
      floor.rotation.x = -Math.PI / 2;
      group.add(floor);

      // One grid line per world unit, so speed is readable while playing.
      const grid = new THREE.GridHelper(arenaHalf * 2, Math.max(2, Math.round(arenaHalf * 2)));
      grid.position.y = 0.01;
      group.add(grid);
      scene.add(group);

      // The capsule geometry is unit-ish; scaling keeps one geometry for
      // any playerRadius the tuning panel produces.
      playerMesh.scale.setScalar(playerRadius);

      while (pickupMeshes.length > pickupCount) {
        const mesh = pickupMeshes.pop();
        if (!mesh) break;
        scene.remove(mesh);
        mesh.geometry.dispose();
      }
      while (pickupMeshes.length < pickupCount) {
        const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), pickupMaterial);
        scene.add(mesh);
        pickupMeshes.push(mesh);
      }
      stage.applyTheme(currentTheme);
    },

    applyTheme(next) {
      currentTheme = next;
      scene.background = new THREE.Color(next.sky);
      scene.fog = new THREE.Fog(next.fog, next.fogNear, next.fogFar);
      groundMaterial.color.set(next.ground);
      playerMaterial.color.set(next.player);
      pickupMaterial.color.set(next.pickup);
      const grid = scene.getObjectByName(ARENA_GROUP)?.children.find((c) => c instanceof THREE.GridHelper);
      if (grid instanceof THREE.GridHelper) {
        const material = Array.isArray(grid.material) ? grid.material : [grid.material];
        for (const m of material) {
          if ("color" in m && m.color instanceof THREE.Color) m.color.set(next.grid);
          m.opacity = 0.5;
          m.transparent = true;
        }
      }
    },

    resize(width, height) {
      renderer.setSize(width, height, false);
      cam.aspect = width / Math.max(1, height);
      cam.updateProjectionMatrix();
    },

    render() {
      renderer.render(scene, cam);
    },

    dispose() {
      disposeArena();
      for (const mesh of pickupMeshes) mesh.geometry.dispose();
      playerMesh.geometry.dispose();
      playerMaterial.dispose();
      pickupMaterial.dispose();
      groundMaterial.dispose();
      renderer.dispose();
    },
  };

  stage.applyTheme(theme);
  return stage;
}
