// Wiring only. All rules live in ./sim; this file samples input, drives
// the fixed-step clock through the recorder, and draws viewFor. The
// designer layer (tuning panel, version stamp, note box, theme, back
// link) comes from @proto/ui and is wired here, never inside the sim.
//
// Real time in, whole ticks out: rAF gives elapsed ms, `advance` turns
// that into ticks at config.tickMs, and each tick is dispatched as an
// action. The sim never sees a frame's dt.
import { advance, alpha, createFixedStep, createRecorder, type Recorder } from "@proto/core";
import {
  configVersionOf,
  createBackLink,
  createNoteBox,
  createThemeLoader,
  createTuningPanel,
  createVersionStamp,
  type Note,
} from "@proto/ui";
import replayConfig from "../config/replay.json";
import config from "../config/sim.json";
import theme from "../config/theme.json";
import uiConfig from "../config/ui.json";
import { installPlaytestHook } from "./playtest-hook";
import * as sim from "./sim";
import { createInput } from "./view/input";
import { createStage, type Layout } from "./view/scene";
import { createSync, type Sync } from "./view/sync";

const SLUG = "02-bastion-invaders";
const BUILD_HASH = "dev";
// A frame after a stall must not replay minutes of ticks at once.
const MAX_TICKS_PER_FRAME = 5;
// How long a narrator line stays up, in ticks.
const LINE_TICKS = 50;

const params = new URLSearchParams(location.search);
const playtesting = params.has("playtest");

const allConfigVersions = (): string => configVersionOf({ sim: config, replay: replayConfig, ui: uiConfig });

const root = document.getElementById("app") as HTMLDivElement;
const canvas = document.getElementById("stage") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;

const loadTheme = createThemeLoader(root, theme);
createBackLink();

const stageSpec = { camera: uiConfig.camera, island: uiConfig.island, effects: uiConfig.effects, render: uiConfig.render };
const stage = createStage(canvas, theme, stageSpec, playtesting);
let sync: Sync = createSync(stage, stageSpec, config.tickMs);

function newRecorder(seed: number): Recorder<sim.State, sim.Action> {
  console.info(`[${SLUG}] seed=${seed} config=${allConfigVersions()}`);
  return createRecorder(sim, config, {
    seed,
    buildHash: BUILD_HASH,
    timestep: config.tickMs,
    checkpointEvery: replayConfig.checkpointEvery,
  });
}

// Seed: ?seed=<uint32> to reproduce a run, otherwise derived from the clock.
const seedParam = params.get("seed");
let recorder = newRecorder(seedParam !== null ? Number(seedParam) : Date.now() >>> 0);
let clock = createFixedStep(config.tickMs, MAX_TICKS_PER_FRAME);

const stamp = createVersionStamp({
  buildHash: BUILD_HASH,
  configVersion: allConfigVersions(),
  seed: recorder.state.seed,
});

const noteBox = createNoteBox({
  hotkey: uiConfig.hotkeys.notes,
  // Notes are stamped with the tick: "the march felt slow around 30s".
  turn: () => recorder.state.tick,
  playerId: () => "p1",
  onNote: (note: Note) => console.info(`[${SLUG}] note`, JSON.stringify(note)),
});

const panel = createTuningPanel({
  files: [
    { name: "sim", config, fields: uiConfig.tuning.sim },
    { name: "theme", config: theme, fields: uiConfig.tuning.theme },
  ],
  title: uiConfig.panel.title,
  expanded: uiConfig.panel.expanded,
  hotkey: uiConfig.hotkeys.panel,
  onChange(file) {
    if (file.name === "theme") {
      loadTheme(theme);
      stage.applyTheme(theme);
      return;
    }
    // Rules changed: restart on the same seed, same wave under new numbers.
    restart(recorder.state.seed);
    stamp.update({ configVersion: allConfigVersions(), seed: recorder.state.seed });
  },
});
panel.setVisible(uiConfig.panel.visible);

const suspended = (): boolean => panel.visible || noteBox.isOpen();
const input = createInput(uiConfig.keys, suspended);

function layout(): Layout {
  const blocks = config.bunkerCount * config.bunkerCols * config.bunkerRows;
  return {
    halfWidth: config.fieldHalfWidth,
    nearZ: config.arenaNearZ,
    farZ: config.arenaFarZ,
    playerZ: config.playerZ,
    invasionZ: config.invasionZ,
    invaderRows: config.invaderRows,
    invaderTotal: config.invaderCols * config.invaderRows,
    invaderHalfSize: config.invaderHalfSize,
    blockCount: blocks,
    blockSize: config.bunkerBlockSize,
    maxShots: Math.max(config.maxPlayerShots, config.maxEnemyShots),
  };
}

function rebuildStage(): void {
  stage.rebuild(layout());
  sync = createSync(stage, stageSpec, config.tickMs);
  sync.push(sim.viewFor(recorder.state, "p1"));
}

/** True once the session log has been written, so it is written once per run. */
let logged = false;
/** The last narrator line and the tick it was said on. */
let line = { text: "", tick: 0 };
let lastLives = config.lives;

function restart(seed: number): void {
  recorder = newRecorder(seed);
  clock = createFixedStep(config.tickMs, MAX_TICKS_PER_FRAME);
  logged = false;
  line = { text: "The ground rises to meet him.", tick: 0 };
  lastLives = config.lives;
  rebuildStage();
  drawHud();
}

/** The only way state changes: real input and playtest replays both come through here. */
function dispatch(playerId: string, action: sim.Action): void {
  recorder.apply(playerId, action);
  const view = sim.viewFor(recorder.state, "p1");
  sync.push(view);
  if (view.player.lives < lastLives && view.player.lives > 0) {
    line = { text: "Kid takes a hit. Gets back up.", tick: view.tick };
  }
  lastLives = view.player.lives;
  if (recorder.state.winner !== null && !logged) {
    logged = true;
    console.info(`[${SLUG}] session`, JSON.stringify({ ...recorder.finish(), notes: noteBox.notes() }));
  }
}

const HINT = "A/D or ←/→ to move · Space to throw · R to restart · ` tuning · N note";
let hudText = "";

function drawHud(): void {
  const view = sim.viewFor(recorder.state, "p1");
  const hearts = "♥".repeat(Math.max(0, view.player.lives));
  let status = `${view.player.score} · ${hearts} · ${view.invaders.length} left`;
  let narration = view.tick - line.tick < LINE_TICKS ? line.text : "";
  if (view.winner === "p1") narration = "Not one of 'em left. The island holds.";
  else if (view.winner === "invaders") narration = "And that's where the story ends. (R to try again)";
  else if (view.winner === "timeout") narration = "They just kept coming. (R to try again)";
  if (view.winner) status = `${view.player.score} points`;
  const html = `<div class="status">${status}</div><div class="line">${narration}</div><div class="meta">${HINT}</div>`;
  // Only touch the DOM when the text actually changed: this runs every frame.
  if (html === hudText) return;
  hudText = html;
  hud.innerHTML = html;
}

function resize(): void {
  stage.resize(canvas.clientWidth, canvas.clientHeight);
}
window.addEventListener("resize", resize);

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === uiConfig.hotkeys.restart && !suspended() && !playtesting) {
    restart((Date.now() >>> 0) || 1);
    stamp.update({ seed: recorder.state.seed });
  }
});

/** One tick of held input, as an action. Stops feeding the sim once it is over. */
function tickFromInput(): void {
  if (recorder.state.winner !== null) return;
  dispatch("p1", { type: "tick", input: input.read() });
}

restart(recorder.state.seed);
resize();

if (playtesting) {
  // Under ?playtest there is no rAF clock: the hook applies actions and
  // renders synchronously, so a screenshot shows the same frame however
  // fast (or slow) the machine running the test is.
  installPlaytestHook({
    configVersion: sim.configVersion(config),
    reset(seed) {
      restart(seed);
      logged = true; // A playtest run is not a session; skip the session log.
      stamp.update({ seed });
    },
    dispatch,
    state: () => recorder.state,
    render() {
      sync.draw(1);
      drawHud();
    },
  });
} else {
  let last: number | null = null;
  const frame = (now: number): void => {
    const elapsed = last === null ? 0 : now - last;
    last = now;
    if (!suspended()) advance(clock, elapsed, tickFromInput);
    // Once the run is over nothing is pushed any more; hold the last frame.
    sync.draw(recorder.state.winner === null ? alpha(clock) : 1);
    drawHud();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
