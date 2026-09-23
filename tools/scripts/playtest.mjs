// Headless seeded playtest in a real browser (Playwright as a library).
//   pnpm playtest <slug>            replay replays/smoke.json, screenshot,
//                                   print a JSON report, exit 1 on failure
//   pnpm playtest <slug> --update   re-record replays/smoke.json from
//                                   src/smoke.ts (after an intentional rules change)
//
// Page contract: opened with ?playtest, the prototype installs
// globalThis.__playtest = { load(replay), step() -> {index, done}, result() }.
// See prototypes/_template/src/playtest-hook.ts.
import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { protoDir, repoRoot } from "./prototypes.mjs";

const VIEWPORT = { width: 800, height: 600 };
const HOOK_TIMEOUT_MS = 10_000;

const args = process.argv.slice(2);
const update = args.includes("--update");
const slug = args.find((a) => !a.startsWith("--"));

function rel(p) {
  return path.relative(repoRoot, p).split(path.sep).join("/");
}

async function exists(p) {
  return stat(p).then(
    () => true,
    () => false,
  );
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (bundledErr) {
    // Fall back to an installed Google Chrome before giving up.
    try {
      return await chromium.launch({ channel: "chrome" });
    } catch {
      const first = String(bundledErr.message).split("\n")[0];
      throw new Error(`No browser available for Playwright (${first}). Run: pnpm exec playwright install chromium`);
    }
  }
}

async function recordSmoke(server, smokePath) {
  const mod = await server.ssrLoadModule("/src/smoke.ts");
  const replay = mod.recordSmoke();
  await mkdir(path.dirname(smokePath), { recursive: true });
  await writeFile(smokePath, `${JSON.stringify(replay, null, 2)}\n`);
  console.log(
    `playtest ${slug}: recorded ${rel(smokePath)} (seed ${replay.seed}, ${replay.actions.length} actions, final ${replay.checkpointHashes.final}). Review the diff before committing.`,
  );
}

async function playReplayInBrowser(server, replay) {
  const screensDir = path.join(repoRoot, ".screens", slug);
  await rm(screensDir, { recursive: true, force: true });
  await mkdir(screensDir, { recursive: true });

  await server.listen();
  const url = server.resolvedUrls.local[0];
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const where = msg.location().url;
      consoleErrors.push(where ? `${msg.text()} (${where})` : msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(`Uncaught: ${err.message}`));

    const screenshots = [];
    const shoot = async (name) => {
      const file = path.join(screensDir, `${name}.png`);
      await page.screenshot({ path: file });
      screenshots.push(rel(file));
    };

    await page.goto(`${url}?playtest`);
    try {
      await page.waitForFunction(() => "__playtest" in globalThis, null, { timeout: HOOK_TIMEOUT_MS });
    } catch {
      throw new Error(
        `Page never installed globalThis.__playtest within ${HOOK_TIMEOUT_MS}ms. Console errors: ${consoleErrors.join(" | ") || "none"}`,
      );
    }

    await page.evaluate((r) => globalThis.__playtest.load(r), replay);
    await shoot("step-0000");
    const checkpointSteps = new Set(
      Object.keys(replay.checkpointHashes)
        .filter((k) => k !== "final")
        .map(Number),
    );
    for (;;) {
      const { index, done } = await page.evaluate(() => globalThis.__playtest.step());
      if (checkpointSteps.has(index) && index > 0) await shoot(`step-${String(index).padStart(4, "0")}`);
      if (done) break;
    }
    await shoot("final");
    const result = await page.evaluate(() => globalThis.__playtest.result());
    return { result, consoleErrors, screenshots };
  } finally {
    await browser.close();
  }
}

async function main() {
  if (!slug) {
    console.error("Usage: pnpm playtest <slug> [--update]");
    process.exit(2);
  }
  const root = path.join(protoDir, slug);
  if (!(await exists(path.join(root, "index.html")))) {
    throw new Error(`No prototype at ${rel(root)}`);
  }
  const smokePath = path.join(root, "replays", "smoke.json");
  const server = await createServer({ root, logLevel: "error", clearScreen: false, server: { open: false } });

  try {
    if (update) {
      await recordSmoke(server, smokePath);
      return 0;
    }
    if (!(await exists(smokePath))) {
      throw new Error(`No ${rel(smokePath)}. Record one with: pnpm playtest ${slug} --update`);
    }
    const replay = JSON.parse(await readFile(smokePath, "utf8"));
    const { result, consoleErrors, screenshots } = await playReplayInBrowser(server, replay);

    const failures = [];
    if (result.error) failures.push(`Action threw at ${result.error}`);
    for (const m of result.mismatches) {
      failures.push(`Hash mismatch at checkpoint ${m.checkpoint}: expected ${m.expected}, got ${m.actual}`);
    }
    for (const f of result.invariantFailures) failures.push(`Invariant failed at ${f}`);
    for (const e of consoleErrors) failures.push(`Console error: ${e}`);
    if (failures.length > 0 && result.mismatches.length > 0) {
      failures.push(`If this rules change is intentional, re-record with: pnpm playtest ${slug} --update`);
    }

    const ok = failures.length === 0;
    const report = {
      slug,
      ok,
      seed: replay.seed,
      configVersion: result.configVersion,
      steps: result.steps,
      actions: replay.actions.length,
      expectedFinalHash: replay.checkpointHashes.final,
      finalHash: result.finalHash,
      failures,
      screenshots,
    };
    console.log(JSON.stringify(report, null, 2));
    if (ok) {
      console.log(`playtest ${slug}: PASS (${result.steps} actions, final ${result.finalHash}, 0 console errors)`);
      return 0;
    }
    console.log(`playtest ${slug}: FAIL\n${failures.map((f) => `  - ${f}`).join("\n")}`);
    return 1;
  } finally {
    await server.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.log(`playtest ${slug ?? ""}: FAIL\n  - ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
