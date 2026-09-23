// Static checks for AGENTS.md rules the type checker cannot see.
// Pure code — packages/*/src and prototypes/*/src except src/main.ts —
// must not call Math.random(), read the clock, touch the DOM, or
// import a renderer. Test files are exempt.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "./prototypes.mjs";

const RULES = [
  { re: /\bMath\.random\s*\(/, why: "calls Math.random(); use the seeded RNG from @proto/core" },
  { re: /\b(Date\.now|performance\.now)\s*\(|\bnew Date\s*\(/, why: "reads the clock; pass time in as an action or argument" },
  {
    re: /\b(document|window|localStorage|sessionStorage|navigator|requestAnimationFrame)\b/,
    why: "touches the DOM; only src/main.ts may",
  },
  {
    re: /from\s+["'](phaser|pixi\.js|@pixi\/[^"']*)["']|import\s*\(\s*["'](phaser|pixi\.js|@pixi\/)/,
    why: "imports a renderer; only src/main.ts may",
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

async function pureFiles() {
  const files = [];
  for (const group of ["packages", "prototypes"]) {
    for (const pkg of await readdir(path.join(repoRoot, group), { withFileTypes: true }).catch(() => [])) {
      if (!pkg.isDirectory()) continue;
      const src = path.join(repoRoot, group, pkg.name, "src");
      for await (const file of walk(src)) {
        if (!file.endsWith(".ts") || file.endsWith(".test.ts") || file.endsWith(".d.ts")) continue;
        if (group === "prototypes" && path.relative(src, file) === "main.ts") continue;
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
