// Batch bot matches, for balance work.
//   pnpm sim <slug>                 default seed count from config/verify.json
//   pnpm sim <slug> --seeds 200     200 matches
//   pnpm sim <slug> --first 1000    start the seed range at 1000
//   pnpm sim <slug> --json          machine-readable, for before/after diffs
//
// Module contract: the prototype exports src/batch.ts with
//   runSeeds(seeds: number[]): BatchResult   (see @proto/testkit)
//   configVersion(): string
// See prototypes/_template/src/batch.ts.
import { createServer } from "vite";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { protoDir, repoRoot } from "./prototypes.mjs";

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const asJson = args.includes("--json");

function numberFlag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return null;
  const value = Number(args[i + 1]);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`--${name} needs a positive integer, got "${args[i + 1] ?? ""}"`);
  }
  return value;
}

function rel(p) {
  return path.relative(repoRoot, p).split(path.sep).join("/");
}

async function exists(p) {
  return stat(p).then(
    () => true,
    () => false,
  );
}

/** Default seed count: the prototype's own verify config, so sim and verify agree. */
async function defaultSeedCount(root) {
  try {
    return JSON.parse(await readFile(path.join(root, "config", "verify.json"), "utf8")).seedCount;
  } catch {
    return null;
  }
}

async function main() {
  if (!slug) {
    console.error("Usage: pnpm sim <slug> [--seeds N] [--first N] [--json]");
    return 2;
  }
  const root = path.join(protoDir, slug);
  const batchPath = path.join(root, "src", "batch.ts");
  if (!(await exists(batchPath))) {
    throw new Error(
      `No ${rel(batchPath)}. A prototype needs it to be batch-simulated; copy prototypes/_template/src/batch.ts.`,
    );
  }

  const seedCount = numberFlag("seeds") ?? (await defaultSeedCount(root));
  if (seedCount === null) throw new Error(`No --seeds given and no seedCount in ${rel(root)}/config/verify.json`);
  const first = numberFlag("first") ?? 1;
  const seeds = Array.from({ length: seedCount }, (_, i) => first + i);

  const server = await createServer({ root, logLevel: "error", clearScreen: false, server: { open: false } });
  let result;
  let configVersion;
  let format;
  try {
    const batch = await server.ssrLoadModule("/src/batch.ts");
    // Loaded through Vite too: @proto/testkit ships TypeScript sources.
    format = await server.ssrLoadModule("@proto/testkit");
    const started = Date.now();
    result = batch.runSeeds(seeds);
    result.ms = Date.now() - started;
    configVersion = batch.configVersion();
  } finally {
    await server.close();
  }

  const { formatBatchSummary, formatViolations } = format;
  const ok = result.violations.length === 0;

  if (asJson) {
    console.log(
      JSON.stringify(
        { slug, ok, configVersion, seeds: { count: seeds.length, first, last: seeds[seeds.length - 1] }, ...result },
        null,
        2,
      ),
    );
  } else {
    console.log(`sim ${slug}: ${seeds.length} seeds (${first}..${seeds[seeds.length - 1]}), ${configVersion}\n`);
    console.log(formatBatchSummary(result.summary));
    if (!ok) {
      console.log(`\n${result.violations.length} violation(s) — these matches are excluded from the numbers above:`);
      console.log(formatViolations(result.violations.slice(0, 10)));
    }
    console.log(`\nsim ${slug}: ${ok ? "OK" : "VIOLATIONS"} (${result.ms}ms)`);
  }
  return ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`sim ${slug ?? ""}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
