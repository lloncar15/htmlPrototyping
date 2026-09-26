// Renderer, camera, lights, meshes and the post chain. three.js is
// allowed here and in src/main.ts only — never in src/sim.ts.
//
// The prototype's question is partly about the look, so this goes past
// the template's graybox, but only as far as agreed: primitives and flat
// shading, no textures or models; an orthographic isometric camera; a
// floating island of tiles with rock roots hanging into a void; warm key
// light with shadows; and one light post chain (bloom on the shots,
// vignette, OutputPass). Every colour and post number is a token in
// config/theme.json, read as JS values because WebGL cannot read CSS
// custom properties, and re-applied when the tuning panel changes one.
//
// This file builds and themes objects; ./sync.ts places them each frame.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";
import type theme from "../../config/theme.json";
import type uiConfig from "../../config/ui.json";

export type SceneTheme = typeof theme;
export type CameraSpec = typeof uiConfig.camera;
export type IslandSpec = typeof uiConfig.island;
export type EffectsSpec = typeof uiConfig.effects;
export type RenderSpec = typeof uiConfig.render;

/** The sim numbers the stage needs to lay itself out. */
export type Layout = {
  halfWidth: number;
  nearZ: number;
  farZ: number;
  playerZ: number;
  invasionZ: number;
  invaderRows: number;
  invaderTotal: number;
  invaderHalfSize: number;
  blockCount: number;
  blockSize: number;
  maxShots: number;
};

export type Tile = {
  x: number;
  z: number;
  /** Ticks after the start at which this tile begins to rise. */
  delay: number;
  rootLength: number;
  /** 0 or 1: which of the two tile tones; 2 for the grassy rim. */
  tone: 0 | 1 | 2;
};

export type InvaderRig = { group: THREE.Group; row: number };
export type Debris = { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial };

export type Stage = {
  camera: THREE.OrthographicCamera;
  tiles: Tile[];
  tileTops: THREE.InstancedMesh;
  tileRoots: THREE.InstancedMesh;
  player: THREE.Group;
  invaders: InvaderRig[];
  blocks: THREE.Mesh[];
  playerShots: THREE.Mesh[];
  enemyShots: THREE.Mesh[];
  debris: Debris[];
  motes: THREE.Points;
  /** Colour of an invader of `row`, for its debris. */
  invaderColor(row: number): THREE.Color;
  blockColor(): THREE.Color;
  rebuild(layout: Layout): void;
  applyTheme(theme: SceneTheme): void;
  resize(width: number, height: number): void;
  render(): void;
};

/** Deterministic 0..1 from integers: the view's only "randomness", so screenshots repeat. */
export function hash01(...n: number[]): number {
  let h = 0x811c9dc5;
  for (const v of n) {
    h = Math.imul(h ^ (Math.floor(v * 1000) | 0), 0x01000193);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

function layoutTiles(layout: Layout, island: IslandSpec, effects: EffectsSpec): Tile[] {
  const tiles: Tile[] = [];
  const xMax = Math.ceil(layout.halfWidth) + island.margin;
  const zMin = Math.floor(layout.farZ) - island.margin;
  const zMax = Math.ceil(layout.nearZ) + island.margin;
  for (let z = zMin; z <= zMax; z++) {
    for (let x = -xMax; x <= xMax; x++) {
      // How far into the margin ring this tile is: 0 inside the field.
      const outX = Math.max(0, Math.abs(x) - Math.ceil(layout.halfWidth));
      const outZ = Math.max(0, zMin + island.margin - z, z - (zMax - island.margin));
      const out = Math.max(outX, outZ);
      if (out > 0 && hash01(x, z, 1) < (island.edgeDropout * out) / island.margin) continue;
      // Rise outwards from where the player stands, like the ground
      // coming up to meet the Kid.
      const dist = Math.sqrt(x * x + (z - layout.playerZ) * (z - layout.playerZ));
      const rim = out > 0 || hash01(x, z, 2) < 0.08;
      tiles.push({
        x,
        z,
        delay: dist * effects.assembleStagger * hash01(x, z, 3) * 0.6 + dist * effects.assembleStagger * 0.4,
        rootLength:
          island.rootMin + (island.rootMax - island.rootMin) * hash01(x, z, 4) * (0.35 + 0.65 * Math.min(1, out + 0.3)),
        tone: rim ? 2 : hash01(x, z, 7) < 0.5 ? 0 : 1,
      });
    }
  }
  return tiles;
}

export function createStage(
  canvas: HTMLCanvasElement,
  initialTheme: SceneTheme,
  spec: { camera: CameraSpec; island: IslandSpec; effects: EffectsSpec; render: RenderSpec },
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
  // Neutral keeps the palette's hues; ACES pushed the warm tiles to mud.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = spec.render.exposure;
  renderer.shadowMap.enabled = spec.render.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);

  // Lights: a warm sun from the front left (so the cliff faces the camera
  // sees are lit), and a sky/earth fill.
  const key = new THREE.DirectionalLight(0xffffff, 1);
  key.position.set(spec.render.sun.x, spec.render.sun.y, spec.render.sun.z);
  key.castShadow = spec.render.shadows;
  key.shadow.mapSize.set(spec.render.shadowMapSize, spec.render.shadowMapSize);
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.03;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
  scene.add(key, key.target, hemi);

  // Materials, themed in applyTheme.
  const tileMaterial = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const rootMaterial = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
  const blockMaterial = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
  const bodyMaterial = new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true });
  const tunicMaterial = new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true });
  const rowMaterials = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ roughness: 0.5, flatShading: true }));
  const eyeMaterial = new THREE.MeshBasicMaterial();
  const shotMaterial = new THREE.MeshBasicMaterial();
  const enemyShotMaterial = new THREE.MeshBasicMaterial();
  const dangerMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false });
  const moteMaterial = new THREE.PointsMaterial({
    size: 3,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // Shared geometries.
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const rowGeometries = [
    new THREE.OctahedronGeometry(0.62, 0), // back row: crystal
    new THREE.DodecahedronGeometry(0.52, 0), // middle rows: rock-ish blob
    new THREE.SphereGeometry(0.52, 7, 5), // front row: squat "squirt"
  ];
  const eyeGeometry = new THREE.SphereGeometry(0.09, 6, 4);
  const shotGeometry = new THREE.CapsuleGeometry(0.09, 0.55, 2, 6);
  const enemyShotGeometry = new THREE.IcosahedronGeometry(0.16, 0);
  const debrisGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);

  // Player: a blue tunic and a pale head. Graybox, but a silhouette.
  const player = new THREE.Group();
  const tunic = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 3, 8), tunicMaterial);
  tunic.position.y = 0.6;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.27, 1), bodyMaterial);
  head.position.y = 1.25;
  for (const m of [tunic, head]) m.castShadow = true;
  player.add(tunic, head);
  scene.add(player);

  const motes = new THREE.Points(new THREE.BufferGeometry(), moteMaterial);
  scene.add(motes);

  const danger = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.12), dangerMaterial);
  danger.rotation.x = -Math.PI / 2;
  scene.add(danger);

  let tileTops = new THREE.InstancedMesh(unitBox, tileMaterial, 1);
  let tileRoots = new THREE.InstancedMesh(unitBox, rootMaterial, 1);
  let tiles: Tile[] = [];
  const invaders: InvaderRig[] = [];
  const blocks: THREE.Mesh[] = [];
  const playerShots: THREE.Mesh[] = [];
  const enemyShots: THREE.Mesh[] = [];
  const debris: Debris[] = [];
  let layout: Layout | null = null;
  let current = initialTheme;

  for (let i = 0; i < spec.effects.debrisPool; i++) {
    const material = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
    const mesh = new THREE.Mesh(debrisGeometry, material);
    mesh.visible = false;
    mesh.castShadow = true;
    scene.add(mesh);
    debris.push({ mesh, material });
  }

  // Post: the scene, bloom on anything brighter than the threshold (only
  // the over-bright shots reach it), a vignette, then tone mapping.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 1, 0.5, 0.9);
  composer.addPass(bloom);
  const vignette = new ShaderPass(VignetteShader);
  composer.addPass(vignette);
  composer.addPass(new OutputPass());

  const rowIndex = (row: number, rows: number): number => (row === 0 ? 0 : row === rows - 1 ? 2 : 1);

  /** Resize a pool of meshes to `count`, creating with `make`. */
  const fill = <T extends THREE.Object3D>(pool: T[], count: number, make: () => T): void => {
    while (pool.length > count) {
      const obj = pool.pop();
      if (obj) scene.remove(obj);
    }
    while (pool.length < count) {
      const obj = make();
      obj.visible = false;
      scene.add(obj);
      pool.push(obj);
    }
  };

  const stage: Stage = {
    camera,
    get tiles() {
      return tiles;
    },
    get tileTops() {
      return tileTops;
    },
    get tileRoots() {
      return tileRoots;
    },
    player,
    invaders,
    blocks,
    playerShots,
    enemyShots,
    debris,
    motes,

    invaderColor(row) {
      const rows = layout?.invaderRows ?? 1;
      return (rowMaterials[rowIndex(row, rows)] as THREE.MeshStandardMaterial).color;
    },
    blockColor() {
      return blockMaterial.color;
    },

    rebuild(next) {
      layout = next;
      tiles = layoutTiles(next, spec.island, spec.effects);
      for (const mesh of [tileTops, tileRoots]) {
        scene.remove(mesh);
        mesh.dispose();
      }
      tileTops = new THREE.InstancedMesh(unitBox, tileMaterial, tiles.length);
      tileRoots = new THREE.InstancedMesh(unitBox, rootMaterial, tiles.length);
      tileTops.receiveShadow = true;
      tileRoots.receiveShadow = true;
      tileTops.castShadow = true;
      scene.add(tileTops, tileRoots);

      // Invaders: one rig per id, shaped by row.
      while (invaders.length > 0) scene.remove((invaders.pop() as InvaderRig).group);
      for (let id = 0; id < next.invaderTotal; id++) {
        const row = Math.floor(id / Math.max(1, next.invaderTotal / next.invaderRows));
        const index = rowIndex(row, next.invaderRows);
        const group = new THREE.Group();
        const body = new THREE.Mesh(rowGeometries[index], rowMaterials[index]);
        if (index === 2) body.scale.y = 0.7;
        body.castShadow = true;
        group.add(body);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
          eye.position.set(side * 0.17, 0.08, 0.45);
          group.add(eye);
        }
        group.scale.setScalar(next.invaderHalfSize * 2);
        group.visible = false;
        scene.add(group);
        invaders.push({ group, row });
      }

      fill(blocks, next.blockCount, () => {
        const mesh = new THREE.Mesh(unitBox, blockMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
      });
      for (const b of blocks) b.scale.set(next.blockSize * 0.94, next.blockSize * 1.3, next.blockSize * 0.94);
      fill(playerShots, next.maxShots, () => {
        const mesh = new THREE.Mesh(shotGeometry, shotMaterial);
        mesh.rotation.x = Math.PI / 2;
        return mesh;
      });
      fill(enemyShots, next.maxShots, () => new THREE.Mesh(enemyShotGeometry, enemyShotMaterial));

      danger.scale.x = next.halfWidth * 2;
      danger.position.set(0, 0.02, next.invasionZ);

      // Dust motes in the void, placed once; sync drifts them.
      const count = spec.effects.motes;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (hash01(i, 11) * 2 - 1) * (next.halfWidth + 10);
        positions[i * 3 + 1] = -12 + hash01(i, 12) * 20;
        positions[i * 3 + 2] = next.farZ - 6 + hash01(i, 13) * (next.nearZ - next.farZ + 12);
      }
      motes.geometry.dispose();
      motes.geometry = new THREE.BufferGeometry();
      motes.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      motes.userData.base = positions.slice();

      // The sun's shadow box covers the island and nothing more.
      const cam = key.shadow.camera;
      cam.left = -(next.halfWidth + 6);
      cam.right = next.halfWidth + 6;
      cam.top = 18;
      cam.bottom = -18;
      cam.near = 1;
      cam.far = 80;
      cam.updateProjectionMatrix();
      const midZ = (next.nearZ + next.farZ) / 2;
      key.target.position.set(0, 0, midZ);
      key.position.set(spec.render.sun.x, spec.render.sun.y, midZ + spec.render.sun.z);

      stage.applyTheme(current);
    },

    applyTheme(next) {
      current = next;
      scene.background = new THREE.Color(next.sky);
      scene.fog = new THREE.Fog(next.fog, next.fogNear, next.fogFar);
      key.color.set(next.keyLight);
      key.intensity = next.keyIntensity;
      hemi.color.set(next.hemiSky);
      hemi.groundColor.set(next.hemiGround);
      hemi.intensity = next.hemiIntensity;

      rootMaterial.color.set(next.cliff);
      blockMaterial.color.set(next.bunker);
      bodyMaterial.color.set(next.player);
      tunicMaterial.color.set(next.playerAccent);
      rowMaterials[0]?.color.set(next.invaderBack);
      rowMaterials[1]?.color.set(next.invaderMid);
      rowMaterials[2]?.color.set(next.invaderFront);
      eyeMaterial.color.set(next.eyes);
      // Over-bright on purpose: only these pass the bloom threshold.
      shotMaterial.color.set(next.shot).multiplyScalar(next.shotGlow);
      enemyShotMaterial.color.set(next.enemyShot).multiplyScalar(next.shotGlow);
      dangerMaterial.color.set(next.danger);
      moteMaterial.color.set(next.motes);

      const tones = [new THREE.Color(next.tileA), new THREE.Color(next.tileB), new THREE.Color(next.tileEdge)];
      const shade = new THREE.Color();
      tiles.forEach((tile, i) => {
        // A little per-tile variation so the ground reads as laid by hand.
        shade.copy(tones[tile.tone] as THREE.Color).multiplyScalar(0.9 + hash01(tile.x, tile.z, 5) * 0.2);
        tileTops.setColorAt(i, shade);
        shade.set(next.cliff).multiplyScalar(0.75 + hash01(tile.x, tile.z, 6) * 0.35);
        tileRoots.setColorAt(i, shade);
      });
      if (tileTops.instanceColor) tileTops.instanceColor.needsUpdate = true;
      if (tileRoots.instanceColor) tileRoots.instanceColor.needsUpdate = true;

      bloom.strength = next.bloomStrength;
      bloom.radius = next.bloomRadius;
      bloom.threshold = next.bloomThreshold;
      (vignette.uniforms.offset as THREE.IUniform<number>).value = next.vignetteOffset;
      (vignette.uniforms.darkness as THREE.IUniform<number>).value = next.vignetteDarkness;
    },

    resize(width, height) {
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      const aspect = width / Math.max(1, height);
      camera.left = -spec.camera.zoom * aspect;
      camera.right = spec.camera.zoom * aspect;
      camera.top = spec.camera.zoom;
      camera.bottom = -spec.camera.zoom;
      camera.updateProjectionMatrix();
    },

    render() {
      if (spec.render.post) composer.render();
      else renderer.render(scene, camera);
    },
  };

  stage.applyTheme(initialTheme);
  return stage;
}
