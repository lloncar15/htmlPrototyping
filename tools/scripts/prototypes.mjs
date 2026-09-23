// Shared helpers for tools/scripts: repo paths and the prototype list.
import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
export const protoDir = path.join(repoRoot, "prototypes");

/** Read the `Validates:` line from a prototype's AGENTS.md, if present. */
async function validatesLine(slug) {
  try {
    const text = await readFile(path.join(protoDir, slug, "AGENTS.md"), "utf8");
    const match = text.match(/^Validates:\s*(.+)$/m);
    return match ? match[1].trim() : "";
  } catch {
    return "";
  }
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
    out.push({ slug, validates: await validatesLine(slug) });
  }
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}
