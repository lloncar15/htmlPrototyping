// Static checks for AGENTS.md rules the type checker cannot see.
// Pure code — packages/*/src and prototypes/*/src except src/main.ts
// and src/view/** — must not call Math.random(), read the clock, touch
// the DOM, or import a renderer. Test files are exempt.
//
// src/view/** is the 3D renderer layer: three.js, the DOM and the clock
// all belong there, the same way they belong in src/main.ts. It holds
// no game rules, which is why the sim can still be hashed and ported.
//
// @proto/ui is exempt too: it is the designer layer (tuning panel,
// version stamp, note box, theme loader), renderer-side by design and
// holding no game rules. It is the only package allowed the DOM.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "./prototypes.mjs";

const RULES = [
  { re: /\bMath\.random\s*\(/, why: "calls Math.random(); use the seeded RNG from @proto/core" },
  {
    re: /\b(Date\.now|performance\.now)\s*\(|\bnew Date\s*\(/,
    why: "reads the clock; pass time in as an action or argument",
  },
  {
    re: /\b(document|window|localStorage|sessionStorage|navigator|requestAnimationFrame)\b/,
    why: "touches the DOM; only src/main.ts may",
  },
  {
    re: /from\s+["'](phaser|pixi\.js|@pixi\/[^"']*|three|three\/[^"']*)["']|import\s*\(\s*["'](phaser|pixi\.js|@pixi\/|three["'/])/,
    why: "imports a renderer; only src/main.ts and src/view/** may",
  },
];

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

/** Packages that may touch the DOM. See the note at the top of this file. */
const DOM_PACKAGES = ["ui"];

async function pureFiles() {
  const files = [];
  for (const group of ["packages", "prototypes"]) {
    for (const pkg of await readdir(path.join(repoRoot, group), { withFileTypes: true }).catch(() => [])) {
      if (!pkg.isDirectory()) continue;
      if (group === "packages" && DOM_PACKAGES.includes(pkg.name)) continue;
      const src = path.join(repoRoot, group, pkg.name, "src");
      for await (const file of walk(src)) {
        if (!file.endsWith(".ts") || file.endsWith(".test.ts") || file.endsWith(".d.ts")) continue;
        const relative = path.relative(src, file).split(path.sep).join("/");
        if (group === "prototypes" && (relative === "main.ts" || relative.startsWith("view/"))) continue;
        files.push(file);
      }
    }
  }
  return files;
}

/** Blank out comments, keeping line numbers intact. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""));
}

const files = await pureFiles();
const problems = [];
for (const file of files) {
  const lines = stripComments(await readFile(file, "utf8"));
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        const rel = path.relative(repoRoot, file).split(path.sep).join("/");
        problems.push(`${rel}:${i + 1}  ${rule.why}\n    ${line.trim()}`);
      }
    }
  });
}

if (problems.length > 0) {
  console.error(`check-rules: ${problems.length} problem(s) in pure game code:\n\n${problems.join("\n\n")}`);
  process.exit(1);
}
console.log(`check-rules: OK (${files.length} files)`);
