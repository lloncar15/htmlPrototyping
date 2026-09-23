// Dev launcher/dispatcher. Node only, no shell.
//   pnpm dev          -> launcher listing every prototype
//   pnpm dev <slug>   -> one prototype, hot reload
import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { listPrototypes, protoDir, repoRoot } from "./prototypes.mjs";

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
