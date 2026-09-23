// Formats one file with Prettier. Used by the agent PostToolUse hook,
// which passes the hook's JSON on stdin ({ tool_input: { file_path } }).
// Also works by hand: pnpm format:edited <file>
// Never fails the caller: files Prettier ignores or can't parse are left alone.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as prettier from "prettier";
import { repoRoot } from "./prototypes.mjs";

async function readStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function targetFile() {
  if (process.argv[2]) return path.resolve(process.argv[2]);
  const input = await readStdin();
  if (!input.trim()) return null;
  const filePath = JSON.parse(input)?.tool_input?.file_path;
  return typeof filePath === "string" ? path.resolve(filePath) : null;
}

async function main() {
  const file = await targetFile();
  if (!file) return;
  const rel = path.relative(repoRoot, file);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return; // outside the repo

  const info = await prettier.getFileInfo(file, { ignorePath: path.join(repoRoot, ".prettierignore") });
  if (info.ignored || !info.inferredParser) return;

  const source = await readFile(file, "utf8");
  const options = await prettier.resolveConfig(file);
  const formatted = await prettier.format(source, { ...options, filepath: file });
  if (formatted !== source) await writeFile(file, formatted);
}

main().catch((err) => {
  console.error(`format-edited: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
});
