// Stable state hashing: canonical JSON (sorted keys) + a 64-bit
// non-cryptographic hash (cyrb64). Both are simple to port to C#.
// Values that would not survive a JSON round-trip throw, so a hash
// never silently hides NaN, Infinity, Maps, class instances, etc.

/** Canonical JSON: sorted object keys, no whitespace, undefined props skipped. */
export function canonicalJson(value: unknown): string {
  return encode(value, "$");
}

function encode(value: unknown, path: string): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new Error(`Cannot hash non-finite number ${value} at ${path}`);
      return Object.is(value, -0) ? "0" : JSON.stringify(value);
    case "string":
      return JSON.stringify(value);
    case "object":
      break;
    default:
      throw new Error(`Cannot hash ${typeof value} at ${path}`);
  }
  if (Array.isArray(value)) {
    const items = value.map((item, i) => {
      if (item === undefined) throw new Error(`Cannot hash undefined at ${path}[${i}]`);
      return encode(item, `${path}[${i}]`);
    });
    return `[${items.join(",")}]`;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new Error(`Cannot hash non-plain object (${proto?.constructor?.name ?? "unknown"}) at ${path}`);
  }
  const obj = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(obj).sort()) {
    if (obj[key] === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${encode(obj[key], `${path}.${key}`)}`);
  }
  return `{${parts.join(",")}}`;
}

/** 64-bit cyrb hash of a string, as 16 lowercase hex chars. */
export function hashString(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

/** Stable hash of any JSON-safe value. Key order does not matter. */
export function hashState(state: unknown): string {
  return hashString(canonicalJson(state));
}
