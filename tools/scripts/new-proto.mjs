// Scaffold a prototype from prototypes/_template.
//   pnpm new-proto <NN-slug> [--validates "the one question it answers"]
//
// Copies the template, renames it everywhere the slug appears, registers
// it in the launcher manifest and links its workspace deps. It never
// invents game rules: the copy is the template's placeholder game, and
// the first real change is the designer's or the agent's.
import { spawnSync } from "node:child_process";
import { cp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { listPrototypes, protoDir, repoRoot } from "./prototypes.mjs";

const TEMPLATE = "_template";
// NN-lowercase-words: the number keeps prototypes in creation order.
const SLUG_RE = /^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Copied files the slug is substituted into; the rest is copied verbatim.
// AGENTS.md, README.md and CHANGELOG.md are written fresh instead: the
// template's own say they are the template, which is not true of a copy.
const REWRITE = [
  "index.html",
  "docs/design.md",
  "docs/visual-direction.md",
  "src/main.ts",
  "src/batch.ts",
  "src/smoke.ts",
  "src/sim.test.ts",
];
const SKIP_DIRS = new Set(["node_modules", ".screens", "dist"]);

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const validatesIndex = args.indexOf("--validates");
const validates = validatesIndex === -1 ? null : args[validatesIndex + 1];

function rel(p) {
  return path.relative(repoRoot, p).split(path.sep).join("/");
}

async function exists(p) {
  return stat(p).then(
    () => true,
    () => false,
  );
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

/** Replace the template slug in the copied files. */
async function rewrite(root) {
  for (const name of REWRITE) {
    const file = path.join(root, ...name.split("/"));
    if (!(await exists(file))) continue;
    const text = await readFile(file, "utf8");
    await writeFile(file, text.split(TEMPLATE).join(slug));
  }
}

/** The workspace package name has no underscore to inherit; set it directly. */
async function renamePackage(root) {
  const file = path.join(root, "package.json");
  const pkg = JSON.parse(await readFile(file, "utf8"));
  pkg.name = `@proto/${slug}`;
  await writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

/** Appendix B of docs/PLAN.md. Blanks are the user's to fill, not ours to guess. */
function agentsMd() {
  return `# ${slug}

Validates: ${validates ?? "<one question, answerable yes/no by playtesting>"}

Renderer: plain DOM placeholder (Phaser/PixiJS chosen per prototype).
Rules in src/sim.ts — still the template's placeholder game. Replace it.
Config: config/sim.json, config/replay.json, config/verify.json,
config/ui.json. Theme: config/theme.json. Invariants: src/invariants.ts.
Smoke replay: replays/smoke.json, recorded by src/smoke.ts.
Batch metrics: src/metrics.ts, wired for \`pnpm sim\` by src/batch.ts.

Done when:
- <measurable condition, e.g. 20 seeded full matches with no invalid states>
- docs/design.md is current

Local rules:
- <anything specific to this game>
`;
}

function readmeMd() {
  return `# ${slug}

${validates ? `Tests: ${validates}` : "Tests: <the one question this prototype answers>"}

Scaffolded from \`_template\`; the rules are still the placeholder game.

## How to play

\`\`\`bash
pnpm dev ${slug}
\`\`\`

<What the player does, and how a game ends.>

## Controls

| Key / action | Does |
|---|---|
| Click a card | Play it |
| \`\` \` \`\` | Show or hide the tuning panel |
| \`N\` | Open the note box — Enter saves it against the current turn |
| \`?seed=12345\` in the URL | Play a specific deal again |

The bottom-left corner shows the seed, config version and build. Quote
all three when you report something.

## Tuning

Numbers live in \`config/\`; nothing is hard-coded. Open the panel with
\`\` \` \`\`, move a slider, hit **Export JSON**, and save the file over
\`prototypes/${slug}/config/<name>.json\`. Colours and type are in
\`config/theme.json\`.

## What is fake

- <what a playtester should not judge yet>

## Checking it

\`\`\`bash
pnpm playtest ${slug}
pnpm sim ${slug} --seeds 200
pnpm verify
\`\`\`
`;
}

function changelogMd() {
  return `# Changelog — ${slug}

Newest first. Written with \`pnpm log-change ${slug}\`, after
\`pnpm verify\` passes and the change is pushed. Each entry says *why*.
`;
}

async function main() {
  if (!slug) {
    console.error('Usage: pnpm new-proto <NN-slug> [--validates "..."]');
    return 2;
  }
  if (!SLUG_RE.test(slug)) {
    throw new Error(`Slug "${slug}" must look like 03-market-day: two digits, a dash, lowercase words.`);
  }
  const root = path.join(protoDir, slug);
  if (await exists(root)) throw new Error(`${rel(root)} already exists.`);

  const template = path.join(protoDir, TEMPLATE);
  if (!(await exists(template))) throw new Error(`No template at ${rel(template)}`);

  await cp(template, root, {
    recursive: true,
    filter: (src) => !SKIP_DIRS.has(path.basename(src)),
  });
  await rewrite(root);
  await renamePackage(root);
  await writeFile(path.join(root, "AGENTS.md"), agentsMd());
  await writeFile(path.join(root, "README.md"), readmeMd());
  await writeFile(path.join(root, "CHANGELOG.md"), changelogMd());

  // Register in the launcher by regenerating its manifest, and link the
  // new workspace package so `pnpm dev <slug>` works straight away.
  const prototypes = await listPrototypes();
  await writeFile(
    path.join(repoRoot, "tools", "launcher", "prototypes.generated.json"),
    `${JSON.stringify(prototypes, null, 2)}\n`,
  );
  const install = spawnSync("pnpm", ["install", "--silent"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (install.status !== 0) throw new Error("pnpm install failed; run it yourself before using the prototype.");

  const files = [];
  for await (const file of walk(root)) files.push(rel(file));

  console.log(`new-proto: created ${rel(root)} (${files.length} files) from ${TEMPLATE}\n`);
  console.log("Next:");
  console.log(`  1. Fill in Validates: and Done when: in ${rel(root)}/AGENTS.md`);
  console.log(`  2. Say how to play it in ${rel(root)}/README.md`);
  console.log(`  3. pnpm dev ${slug}`);
  console.log(`  4. pnpm verify`);
  console.log("\nThe rules in src/sim.ts are still the template's placeholder game. Replace them.");
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`new-proto: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
