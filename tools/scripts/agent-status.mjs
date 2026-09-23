// Prints `git status --short` as a Claude Code hook message, so the human
// sees what the agent left uncommitted when it stops. Agents never commit.
import { spawnSync } from "node:child_process";
import { repoRoot } from "./prototypes.mjs";

const MAX_LINES = 20;

const result = spawnSync("git", ["status", "--short"], { cwd: repoRoot, encoding: "utf8" });
let message;
if (result.status !== 0) {
  message = `git status failed: ${(result.stderr || "").trim()}`;
} else {
  const lines = result.stdout.split("\n").filter(Boolean);
  if (lines.length === 0) {
    message = "Working tree clean.";
  } else {
    const shown = lines.slice(0, MAX_LINES);
    const more = lines.length > MAX_LINES ? `\n…and ${lines.length - MAX_LINES} more` : "";
    message = `Uncommitted changes (review and commit them yourself):\n${shown.join("\n")}${more}`;
  }
}
console.log(JSON.stringify({ systemMessage: message }));
