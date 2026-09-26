// Scaffold a prototype from prototypes/_template or prototypes/_template-3d.
//   pnpm new-proto <NN-slug> [--3d] [--smoke]
//                            [--validates "the one question it answers"]
//
// Copies the template, renames it everywhere the slug appears, registers
// it in the launcher manifest and links its workspace deps. It never
// invents game rules: the copy is the template's placeholder game, and
// the first real change is the designer's or the agent's.
//
//   --3d     copy the three.js template instead of the DOM one
//   --smoke  manual-playtest-first: no hash checks, just boots-and-runs
//            (see docs/PLAN.md section 1 for which mode to pick)
import { spawnSync } from "node:child_process";
import { cp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { listPrototypes, protoDir, repoRoot } from "./prototypes.mjs";

const TEMPLATES = { "2d": "_template", "3d": "_template-3d" };
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
  "src/replay.test.ts",
];
const SKIP_DIRS = new Set(["node_modules", ".screens", "dist"]);

const args = process.argv.slice(2);
const validatesIndex = args.indexOf("--validates");
const validates = validatesIndex === -1 ? null : args[validatesIndex + 1];
// The --validates value is not a flag, so skip it explicitly; otherwise
// `pnpm new-proto --validates "..." 03-x` would take the question as the slug.
const slug = args.find((a, i) => !a.startsWith("--") && !(validatesIndex !== -1 && i === validatesIndex + 1));
const is3d = args.includes("--3d");
const isSmoke = args.includes("--smoke");
const TEMPLATE = is3d ? TEMPLATES["3d"] : TEMPLATES["2d"];

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

const RENDERER_LINE = is3d
  ? "three.js (graybox primitives) in src/main.ts and src/view/**."
  : "plain DOM placeholder (Phaser/PixiJS chosen per prototype).";

const TESTING_LINE = isSmoke
  ? "smoke — boots and runs a hand-written input script; no hash checks."
  : "replay — deterministic, checked against checkpoint hashes.";

const SMOKE_SOURCE_LINE = isSmoke
  ? "Smoke script: replays/smoke.json, hand-written — edit it, don't record it."
  : "Smoke replay: replays/smoke.json, recorded by src/smoke.ts.";

/** Appendix B of docs/PLAN.md. Blanks are the user's to fill, not ours to guess. */
function agentsMd() {
  return `# ${slug}

Validates: ${validates ?? "<one question, answerable yes/no by playtesting>"}

Renderer: ${RENDERER_LINE}
Testing: ${TESTING_LINE}
Rules in src/sim.ts — still the template's placeholder game. Replace it.
Config: config/sim.json, config/replay.json, config/verify.json,
config/ui.json. Theme: config/theme.json. Invariants: src/invariants.ts.
${SMOKE_SOURCE_LINE}
Batch metrics: src/metrics.ts, wired for \`pnpm sim\` by src/batch.ts.

Done when:
- <measurable condition, e.g. 20 seeded full matches with no invalid states>
- docs/design.md is current

Local rules:
- <anything specific to this game>
`;
}

/**
 * A starter input script for `smoke` mode. It is deliberately dull —
 * hold one direction, then another — because its job is to prove the
 * prototype boots, ticks and draws something, not to play well. Edit it
 * by hand: `--update` has nothing to record in smoke mode.
 */
function smokeScript(ticks) {
  const held = (fromTick, moveX, moveZ) => ({
    fromTick,
    playerId: "p1",
    action: { type: "tick", input: { moveX, moveZ } },
  });
  const third = Math.max(1, Math.floor(ticks / 3));
  return {
    seed: 1,
    ticks,
    inputs: [held(0, 0, -1), held(third, 1, 0), held(third * 2, 0, 1)],
  };
}

/** Switch the copied prototype into smoke mode and give it a script to run. */
async function useSmokeMode(root) {
  // A smoke prototype has no recorded replay, so the recorder and the
  // tests that compare against it would fail on the first `pnpm test`.
  // Everything else in src/sim.test.ts holds in either mode.
  for (const name of ["src/smoke.ts", "src/replay.test.ts"]) {
    await rm(path.join(root, ...name.split("/")), { force: true });
  }

  const verifyPath = path.join(root, "config", "verify.json");
  const verify = JSON.parse(await readFile(verifyPath, "utf8"));
  verify.mode = "smoke";
  verify.smokeTicks ??= 300;
  verify.screenshotEvery ??= 100;
  await writeFile(verifyPath, `${JSON.stringify(verify, null, 2)}\n`);

  const script = smokeScript(verify.smokeTicks);
  await writeFile(path.join(root, "replays", "smoke.json"), `${JSON.stringify(script, null, 2)}\n`);
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
| ${is3d ? "WASD or arrows | Move" : "Click a card | Play it"} |
| \`\` \` \`\` | Show or hide the tuning panel |
| \`N\` | Open the note box — Enter saves it against the current turn |
| \`?seed=12345\` in the URL | Play a specific ${is3d ? "layout" : "deal"} again |

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
    console.error('Usage: pnpm new-proto <NN-slug> [--3d] [--smoke] [--validates "..."]');
    return 2;
  }
  if (!SLUG_RE.test(slug)) {
    throw new Error(`Slug "${slug}" must look like 03-market-day: two digits, a dash, lowercase words.`);
  }
  if (isSmoke && !is3d) {
    // Only the 3D template's playtest hook knows how to run an input
    // script; the DOM one is replay-only. Scaffolding a 2D smoke
    // prototype would produce something pnpm playtest cannot drive.
    throw new Error("--smoke needs --3d for now: only the 3D template's playtest hook runs input scripts.");
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
  if (isSmoke) await useSmokeMode(root);
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

  console.log(
    `new-proto: created ${rel(root)} (${files.length} files) from ${TEMPLATE}, testing mode "${isSmoke ? "smoke" : "replay"}"\n`,
  );
  console.log("Next:");
  console.log(`  1. Fill in Validates: and Done when: in ${rel(root)}/AGENTS.md`);
  console.log(`  2. Say how to play it in ${rel(root)}/README.md`);
  console.log(`  3. pnpm dev ${slug}`);
  console.log(`  4. pnpm verify`);
  console.log("\nThe rules in src/sim.ts are still the template's placeholder game. Replace them.");
  if (isSmoke) {
    console.log(`Smoke mode: edit ${rel(root)}/replays/smoke.json by hand. --update records nothing.`);
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`new-proto: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
