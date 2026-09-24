// Dev launcher/dispatcher. Node only, no shell.
//   pnpm dev                    -> one server rooted at the repo: the
//                                  launcher at /, every prototype at
//                                  /prototypes/<slug>/, all with HMR
//   pnpm dev <slug>             -> one prototype, hot reload
//   pnpm dev <slug> --port 5175 -> on a port you choose, so a second
//                                  server does not silently land on the
//                                  next free one
import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { listPrototypes, protoDir, repoRoot } from "./prototypes.mjs";

function portFlag(args) {
  const i = args.indexOf("--port");
  if (i === -1) return undefined;
  const port = Number(args[i + 1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`--port needs a port number, got "${args[i + 1] ?? ""}"`);
  }
  return port;
}

/**
 * Serve tools/launcher/index.html at "/" without redirecting, so the
 * launcher keeps the bare URL. Its own asset paths are absolute, so
 * nothing resolves against "/" by accident.
 */
function launcherAtRoot() {
  return {
    name: "proto-launcher-at-root",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [pathname, search] = (req.url ?? "/").split(/\?(.*)/, 2);
        if (pathname === "/" || pathname === "/index.html") {
          req.url = `/tools/launcher/index.html${search ? `?${search}` : ""}`;
        }
        next();
      });
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith("--") && a !== String(portFlag(args)));
  const port = portFlag(args);
  const prototypes = await listPrototypes();

  let root;
  const plugins = [];
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
    // One server for everything: the repo root, so /prototypes/<slug>/
    // resolves to that prototype's index.html with its own HMR graph.
    root = repoRoot;
    plugins.push(launcherAtRoot());
  }

  // strictPort: a chosen port that is busy should say so, not quietly
  // move to the next one and leave the caller looking at the wrong app.
  const server = await createServer({
    root,
    plugins,
    server: { open: true, port, strictPort: port !== undefined },
  });
  await server.listen();
  server.printUrls();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
