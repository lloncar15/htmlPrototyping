// Headless seeded playtest in a real browser (Playwright as a library).
//   pnpm playtest <slug>            run replays/smoke.json, screenshot,
//                                   print a JSON report, exit 1 on failure
//   pnpm playtest <slug> --update   re-record replays/smoke.json from
//                                   src/smoke.ts (after an intentional rules change)
//
// Two testing modes, from "mode" in the prototype's config/verify.json:
//   replay  replays/smoke.json is a recorded replay; every checkpoint
//           hash must match.
//   smoke   replays/smoke.json is a hand-written input script
//           { seed, ticks, inputs }; no hashes, and --update has nothing
//           to record. Screenshots every `screenshotEvery` ticks.
// Both fail on thrown errors, invariant failures, console errors and a
// blank canvas (every pixel the same colour).
//
// Page contract: opened with ?playtest, the prototype installs
// globalThis.__playtest = { load(script), step(count?) -> {index, done}, result() }.
// A hook may ignore `count` and advance one step per call.
// See prototypes/_template/src/playtest-hook.ts and
// prototypes/_template-3d/src/playtest-hook.ts.
import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { listPrototypes, protoDir, repoRoot } from "./prototypes.mjs";

const VIEWPORT = { width: 800, height: 600 };
const HOOK_TIMEOUT_MS = 10_000;
// WebGL in headless Chromium: software rendering through SwiftShader.
const BROWSER_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
// The canvas is downsampled to this before comparing pixels.
const BLANK_SAMPLE = { width: 64, height: 48 };

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
    return await chromium.launch({ args: BROWSER_ARGS });
  } catch (bundledErr) {
    // Fall back to an installed Google Chrome before giving up.
    try {
      return await chromium.launch({ channel: "chrome", args: BROWSER_ARGS });
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

/** Runs in the page: null if the largest canvas has varied pixels (or there is none), else the one colour. */
function blankCanvasColour(sample) {
  const canvases = [...document.querySelectorAll("canvas")];
  if (canvases.length === 0) return null;
  const canvas = canvases.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
  const probe = document.createElement("canvas");
  probe.width = sample.width;
  probe.height = sample.height;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
  const px = ctx.getImageData(0, 0, sample.width, sample.height).data;
  for (let i = 4; i < px.length; i += 4) {
    if (px[i] !== px[0] || px[i + 1] !== px[1] || px[i + 2] !== px[2] || px[i + 3] !== px[3]) return null;
  }
  return `rgba(${px[0]}, ${px[1]}, ${px[2]}, ${px[3]})`;
}

/** Step indices to stop at for a screenshot, not counting 0. */
function screenshotPoints(mode, script, screenshotEvery) {
  if (mode === "smoke") {
    const points = [];
    for (let t = screenshotEvery; t < script.ticks; t += screenshotEvery) points.push(t);
    return points;
  }
  return Object.keys(script.checkpointHashes)
    .filter((k) => k !== "final")
    .map(Number)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
}

async function playInBrowser(server, { mode, script, screenshotEvery, needsWebgl }) {
  const screensDir = path.join(repoRoot, ".screens", slug);
  await rm(screensDir, { recursive: true, force: true });
  await mkdir(screensDir, { recursive: true });

  await server.listen();
  const url = server.resolvedUrls.local[0];
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    if (needsWebgl) {
      const ok = await page.evaluate(() => document.createElement("canvas").getContext("webgl2") !== null);
      if (!ok) {
        throw new Error(
          "WebGL2 is unavailable in headless Chromium even with SwiftShader. Try: pnpm exec playwright install chromium",
        );
      }
    }
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const where = msg.location().url;
      consoleErrors.push(where ? `${msg.text()} (${where})` : msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(`Uncaught: ${err.message}`));

    const screenshots = [];
    const blankFrames = [];
    let checkedFrames = 0;
    const shoot = async (name) => {
      const colour = await page.evaluate(blankCanvasColour, BLANK_SAMPLE);
      const hasCanvas = await page.evaluate(() => document.querySelector("canvas") !== null);
      if (hasCanvas) checkedFrames++;
      if (colour !== null) blankFrames.push(`Blank canvas at ${name}: every pixel is ${colour}`);
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

    await page.evaluate((r) => globalThis.__playtest.load(r), script);
    await shoot("step-0000");
    const points = screenshotPoints(mode, script, screenshotEvery);
    let index = 0;
    for (;;) {
      // Batch up to the next screenshot; a hook that ignores the count
      // advances one step and the loop simply comes round more often.
      const next = points.find((p) => p > index);
      const count = next === undefined ? Number.MAX_SAFE_INTEGER : next - index;
      const res = await page.evaluate((n) => globalThis.__playtest.step(n), count);
      index = res.index;
      if (points.includes(index) && !res.done) await shoot(`step-${String(index).padStart(4, "0")}`);
      if (res.done) break;
    }
    await shoot("final");
    const result = await page.evaluate(() => globalThis.__playtest.result());
    return { result, consoleErrors, screenshots, blankFrames, checkedFrames };
  } finally {
    await browser.close();
  }
}

/** The prototype's testing mode and smoke settings, from config/verify.json. */
async function readVerifyConfig(root) {
  const file = path.join(root, "config", "verify.json");
  let verify = {};
  if (await exists(file)) verify = JSON.parse(await readFile(file, "utf8"));
  const mode = verify.mode ?? "replay";
  if (mode !== "replay" && mode !== "smoke") {
    throw new Error(`${rel(file)} has mode "${mode}"; expected "replay" or "smoke"`);
  }
  return { mode, smokeTicks: verify.smokeTicks, screenshotEvery: verify.screenshotEvery ?? 100 };
}

/** Throws a readable error when replays/smoke.json does not match the mode. */
function checkScriptShape(mode, script, smokePath) {
  if (mode === "smoke" && !Array.isArray(script.inputs)) {
    throw new Error(
      `config/verify.json says mode "smoke", but ${rel(smokePath)} is not an input script (no "inputs" array). Write { seed, ticks, inputs: [{ fromTick, playerId, action }] } by hand (docs/PLAN.md §8), or set mode back to "replay".`,
    );
  }
  if (mode === "replay" && !Array.isArray(script.actions)) {
    throw new Error(
      `config/verify.json says mode "replay", but ${rel(smokePath)} is not a recorded replay (no "actions" array). Record one with: pnpm playtest ${slug} --update, or set mode to "smoke".`,
    );
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
  const { mode, smokeTicks, screenshotEvery } = await readVerifyConfig(root);
  const meta = (await listPrototypes()).find((p) => p.slug === slug);
  if (meta?.mode && meta.mode !== mode) {
    throw new Error(
      `${rel(path.join(root, "config", "verify.json"))} says mode "${mode}" but ${rel(path.join(root, "AGENTS.md"))} says "Testing: ${meta.mode}". Make them agree.`,
    );
  }

  if (update && mode === "smoke") {
    console.log(`playtest ${slug}: smoke scripts are hand-written; edit ${rel(smokePath)}. Nothing to record.`);
    return 0;
  }

  const server = await createServer({ root, logLevel: "error", clearScreen: false, server: { open: false } });

  try {
    if (update) {
      await recordSmoke(server, smokePath);
      return 0;
    }
    if (!(await exists(smokePath))) {
      throw new Error(
        mode === "smoke"
          ? `No ${rel(smokePath)}. Write an input script by hand (docs/PLAN.md §8).`
          : `No ${rel(smokePath)}. Record one with: pnpm playtest ${slug} --update`,
      );
    }
    const script = JSON.parse(await readFile(smokePath, "utf8"));
    checkScriptShape(mode, script, smokePath);
    if (mode === "smoke") script.ticks ??= smokeTicks;
    if (mode === "smoke" && !(Number.isInteger(script.ticks) && script.ticks > 0)) {
      throw new Error(`${rel(smokePath)} needs a positive integer "ticks" (or set smokeTicks in config/verify.json)`);
    }

    const { result, consoleErrors, screenshots, blankFrames, checkedFrames } = await playInBrowser(server, {
      mode,
      script,
      screenshotEvery,
      needsWebgl: meta?.dimension === "3D",
    });

    const failures = [];
    if (result.error) failures.push(`Action threw at ${result.error}`);
    for (const m of result.mismatches) {
      failures.push(`Hash mismatch at checkpoint ${m.checkpoint}: expected ${m.expected}, got ${m.actual}`);
    }
    for (const f of result.invariantFailures) failures.push(`Invariant failed at ${f}`);
    for (const e of consoleErrors) failures.push(`Console error: ${e}`);
    failures.push(...blankFrames);
    if (mode === "replay" && result.mismatches.length > 0) {
      failures.push(`If this rules change is intentional, re-record with: pnpm playtest ${slug} --update`);
    }

    const ok = failures.length === 0;
    const report =
      mode === "smoke"
        ? {
            slug,
            ok,
            mode,
            seed: script.seed,
            configVersion: result.configVersion,
            steps: result.steps,
            ticks: script.ticks,
            finalHash: result.finalHash,
            failures,
            screenshots,
          }
        : {
            slug,
            ok,
            mode,
            seed: script.seed,
            configVersion: result.configVersion,
            steps: result.steps,
            actions: script.actions.length,
            expectedFinalHash: script.checkpointHashes.final,
            finalHash: result.finalHash,
            failures,
            screenshots,
          };
    console.log(JSON.stringify(report, null, 2));
    if (ok) {
      const frames = checkedFrames > 0 ? `, ${checkedFrames} frames non-blank` : "";
      const detail =
        mode === "smoke"
          ? `smoke, ${result.steps} ticks, 0 console errors${frames}`
          : `${result.steps} actions, final ${result.finalHash}, 0 console errors${frames}`;
      console.log(`playtest ${slug}: PASS (${detail})`);
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
