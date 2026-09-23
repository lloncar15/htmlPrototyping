// Append a changelog entry, newest first.
//   pnpm log-change <slug>          prototypes/<slug>/CHANGELOG.md
//   pnpm log-change root            CHANGELOG.md (shared packages)
//   pnpm log-change <slug> --line "Ember Scout cost 3 -> 2. ..." --line "..."
//   pnpm log-change <slug> --date 2026-09-20   override the date
//
// Entries are written after `pnpm verify` passes and the change is
// pushed, so the heading can name the exact config version the numbers
// were at. The why is the point: "what" is already in the diff.
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "./prototypes.mjs";

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));

function flagValues(name) {
  const out = [];
  args.forEach((arg, i) => {
    if (arg === `--${name}` && args[i + 1] !== undefined) out.push(args[i + 1]);
  });
  return out;
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

function git(argv) {
  const r = spawnSync("git", argv, { cwd: repoRoot, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "sim@2,ui@1" from every config/*.json with a numeric version. */
async function configVersion(root) {
  const dir = path.join(root, "config");
  const parts = [];
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const { version } = JSON.parse(await readFile(path.join(dir, entry.name), "utf8"));
      if (typeof version === "number") parts.push(`${path.basename(entry.name, ".json")}@${version}`);
    } catch {
      // Not a config object; nothing to version.
    }
  }
  return parts.sort().join(",");
}

/** Warn (never block) when the change does not look verified and pushed. */
function pushWarnings(scope) {
  const warnings = [];
  const dirty = git(["status", "--porcelain", "--", scope]);
  if (dirty) warnings.push(`${rel(path.join(repoRoot, scope))} has uncommitted changes — is this entry for them?`);
  const ahead = git(["rev-list", "--count", "@{u}..HEAD"]);
  if (ahead !== null && ahead !== "0") warnings.push(`${ahead} commit(s) not pushed yet. Entries come after the push.`);
  return warnings;
}

async function promptLines() {
  if (!process.stdin.isTTY) {
    throw new Error('No terminal to ask in. Pass the lines instead: --line "what changed and why".');
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log("One line per change, each saying why. Empty line when done.\n");
  const lines = [];
  try {
    for (;;) {
      const line = (await rl.question(`  ${lines.length + 1}. `)).trim();
      if (line === "") break;
      lines.push(line);
    }
  } finally {
    rl.close();
  }
  return lines;
}

/** Newest first: above the previous entry, below the title and its intro. */
function insertEntry(existing, entry) {
  const text = existing ?? "";
  const previous = /^## /m.exec(text);
  if (!previous) return `${text.trimEnd()}\n\n${entry}`;
  return `${text.slice(0, previous.index).trimEnd()}\n\n${entry}\n\n${text.slice(previous.index).trimStart()}`;
}

async function main() {
  if (!target) {
    console.error('Usage: pnpm log-change <slug|root> [--line "..."] [--date YYYY-MM-DD]');
    return 2;
  }
  const isRoot = target === "root";
  const root = isRoot ? repoRoot : path.join(repoRoot, "prototypes", target);
  if (!isRoot && !(await exists(root))) {
    throw new Error(`No prototype at ${rel(root)}. Use a slug from prototypes/, or "root" for shared packages.`);
  }
  const file = path.join(root, "CHANGELOG.md");
  const scope = isRoot ? "packages" : `prototypes/${target}`;

  for (const warning of pushWarnings(scope)) console.log(`log-change: ${warning}`);

  // Root entries have no config version; the pushed commit identifies them.
  const version = isRoot ? (git(["rev-parse", "--short", "HEAD"]) ?? "shared") : await configVersion(root);
  const date = flagValues("date")[0] ?? today();

  const lines = flagValues("line");
  const body = lines.length > 0 ? lines : await promptLines();
  if (body.length === 0) {
    console.log("log-change: nothing entered, nothing written.");
    return 0;
  }

  const entry = `## ${date} — ${version || "unversioned"}\n${body.map((l) => `- ${l}`).join("\n")}`;
  const existing =
    (await readFile(file, "utf8").catch(() => null)) ?? `# Changelog — ${isRoot ? "shared packages" : target}\n`;
  await writeFile(file, `${insertEntry(existing, entry)}\n`.replace(/\n{3,}$/, "\n"));

  console.log(`\nlog-change: wrote to ${rel(file)}\n\n${entry}\n`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`log-change: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
