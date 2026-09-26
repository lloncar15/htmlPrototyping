// Plain-object vector math. Pure, like sim.ts: no THREE.Vector3 here.
// hashState throws on class instances, and {x,y,z} ports to Unity as a
// struct without a translation layer.
//
// Only +, -, *, / and Math.sqrt/min/max/abs are used. Those are exactly
// specified by IEEE 754, so a tick gives bit-identical results in Node
// and in the browser. Math.sin/cos/pow/exp are not, and would quietly
// break the replay contract — keep them out of the sim.

export type Vec3 = { x: number; y: number; z: number };

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function clone(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v: Vec3, k: number): Vec3 {
  return { x: v.x * k, y: v.y * k, z: v.z * k };
}

export function lengthSq(v: Vec3): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

export function length(v: Vec3): number {
  return Math.sqrt(lengthSq(v));
}

export function distance(a: Vec3, b: Vec3): number {
  return length(sub(a, b));
}

/** Zero-length input returns zero, so callers never produce NaN. */
export function normalize(v: Vec3): Vec3 {
  const len = length(v);
  return len === 0 ? vec3() : scale(v, 1 / len);
}

/** Shorten `v` to `max` if it is longer; otherwise return it unchanged. */
export function clampLength(v: Vec3, max: number): Vec3 {
  const len = length(v);
  return len > max ? scale(v, max / len) : clone(v);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isFiniteVec(v: Vec3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}
