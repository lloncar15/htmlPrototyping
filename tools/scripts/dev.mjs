// Dev launcher/dispatcher. Node only, no shell.
//   pnpm dev          -> launcher listing every prototype
//   pnpm dev <slug>   -> one prototype, hot reload
import { createServer } from "vite";
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const protoDir = path.join(repoRoot, "prototypes");

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

/** Scan prototypes/ for directories containing an index.html. */
async function listPrototypes() {
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

async function main() {
  const slug = process.argv[2];
  const prototypes = await listPrototypes();

  let root;
  if (slug) {
    if (!prototypes.some((p) => p.slug === slug)) {
      const names = prototypes.map((p) => p.slug).join(", ") || "(none)";
      console.error(`Unknown prototype "${slug}". Available: ${names}`);
      process.exit(1);
    }
    root = path.join(protoDir, slug);
  } else {
    // Launcher reads this generated file (gitignored).
    await writeFile(
      path.join(repoRoot, "tools", "launcher", "prototypes.generated.json"),
      JSON.stringify(prototypes, null, 2),
    );
    root = path.join(repoRoot, "tools", "launcher");
  }

  const server = await createServer({ root, server: { open: true } });
  await server.listen();
  server.printUrls();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
