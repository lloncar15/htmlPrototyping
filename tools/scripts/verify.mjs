// pnpm verify [--all]
// The arbiter of "done". Runs fastest first and stops at the first
// failure: check-rules, typecheck, test, then playtest for each changed
// prototype. Shared code (packages/, tools/, root config) changing, or
// --all, playtests every prototype. Markdown-only changes skip playtest.
import { spawnSync } from "node:child_process";
import { listPrototypes, repoRoot } from "./prototypes.mjs";

const all = process.argv.includes("--all");

function git(args) {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  return r.status === 0 ? r.stdout.split("\n").filter(Boolean) : null;
}

/** Slugs to playtest, based on uncommitted (staged, unstaged, untracked) changes vs HEAD. */
async function prototypesToPlaytest() {
  const known = (await listPrototypes()).map((p) => p.slug);
  if (all) return { slugs: known, why: "--all" };

  const diff = git(["diff", "--name-only", "HEAD"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]);
  if (diff === null || untracked === null) return { slugs: known, why: "git diff unavailable" };

  const slugs = new Set();
  for (const file of [...diff, ...untracked]) {
    if (file.endsWith(".md")) continue;
    const match = /^prototypes\/([^/]+)\//.exec(file);
    if (!match) return { slugs: known, why: `shared file changed (${file})` };
    if (known.includes(match[1])) slugs.add(match[1]);
  }
  return { slugs: [...slugs].sort(), why: "changed prototypes" };
}

function run(label, args) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync("pnpm", ["--silent", ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return r.status === 0;
}

const steps = [
  ["check-rules", ["check-rules"]],
  ["typecheck", ["typecheck"]],
  ["test", ["test"]],
];
const { slugs, why } = await prototypesToPlaytest();
for (const slug of slugs) steps.push([`playtest ${slug}`, ["playtest", slug]]);

const passed = [];
for (const [label, args] of steps) {
  if (!run(label, args)) {
    console.log(`\nverify: FAIL at "${label}". The reason is printed above.`);
    process.exit(1);
  }
  passed.push(label);
}
const playtestNote = slugs.length === 0 ? " (no prototype changes, playtest skipped)" : ` (playtest: ${why})`;
console.log(`\nverify: PASS — ${passed.join(", ")}${playtestNote}`);
