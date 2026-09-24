// Shared helpers for tools/scripts: repo paths and the prototype list.
import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
export const protoDir = path.join(repoRoot, "prototypes");

/** Read the `Validates:`, `Renderer:` and `Testing:` lines from a prototype's AGENTS.md. */
async function headerLines(slug) {
  let text;
  try {
    text = await readFile(path.join(protoDir, slug, "AGENTS.md"), "utf8");
  } catch {
    return { validates: "", renderer: "", testing: "" };
  }
  const line = (label) => {
    const match = text.match(new RegExp(`^${label}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : "";
  };
  return { validates: line("Validates"), renderer: line("Renderer"), testing: line("Testing") };
}

/** "replay — deterministic, …" -> "replay". Empty when the line is missing. */
export function testingMode(testing) {
  const word = testing.trim().split(/[\s—-]/, 1)[0];
  return word === "replay" || word === "smoke" ? word : "";
}

/** A rough 2D/3D badge from the `Renderer:` line; "" when it says nothing. */
export function rendererDimension(renderer) {
  if (/\b(three(\.js)?|3d|webgl)\b/i.test(renderer)) return "3D";
  return renderer ? "2D" : "";
}

/** Every directory in prototypes/ that has an index.html, sorted by slug. */
export async function listPrototypes() {
  let entries;
  try {
    entries = await readdir(protoDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    try {
      await stat(path.join(protoDir, slug, "index.html"));
    } catch {
      continue;
    }
    const header = await headerLines(slug);
    out.push({
      slug,
      validates: header.validates,
      renderer: header.renderer,
      testing: header.testing,
      mode: testingMode(header.testing),
      dimension: rendererDimension(header.renderer),
    });
  }
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}
