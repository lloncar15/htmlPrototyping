// Wiring only. All rules live in ./sim; this file samples input, drives
// the fixed-step clock through the recorder, and draws viewFor. The
// designer layer (tuning panel, version stamp, note box, theme, back
// link) comes from @proto/ui and is wired here, never inside the sim.
//
// The loop is the whole point of the 3D template: real time in, whole
// ticks out. rAF gives elapsed ms, `advance` turns that into a whole
// number of ticks at config.tickMs, and each tick is dispatched as an
// action. The sim never sees a frame's dt, so the same seed and the
// same actions replay identically on any machine.
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
import { createStage } from "./view/scene";
import { createSync, type Sync } from "./view/sync";

const BUILD_HASH = "dev";
// A frame after a stall must not replay minutes of ticks at once.
const MAX_TICKS_PER_FRAME = 5;

const params = new URLSearchParams(location.search);
const playtesting = params.has("playtest");

const allConfigVersions = (): string => configVersionOf({ sim: config, replay: replayConfig, ui: uiConfig });

const root = document.getElementById("app") as HTMLDivElement;
const canvas = document.getElementById("stage") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;

const loadTheme = createThemeLoader(root, theme);
createBackLink();

const stage = createStage(canvas, theme, uiConfig.camera, playtesting);
let sync: Sync = createSync(stage, uiConfig.camera);

function newRecorder(seed: number): Recorder<sim.State, sim.Action> {
  console.info(`[_template-3d] seed=${seed} config=${allConfigVersions()}`);
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
  // Notes are stamped with the tick, which is this game's "turn": it is
  // what makes "it felt sluggish around 12s" findable in the log.
  turn: () => recorder.state.tick,
  playerId: () => "p1",
  onNote: (note: Note) => console.info("[_template-3d] note", JSON.stringify(note)),
});

// Typing in the note box or dragging a slider must not also drive the
// capsule, and the run should not keep ticking away under the panel.
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
    // Tuning changes the numbers the run started with, so the run
    // restarts on the same seed: the same layout under the new feel.
    restart(recorder.state.seed);
    stamp.update({ configVersion: allConfigVersions(), seed: recorder.state.seed });
  },
});

// The panel starts hidden here, unlike the 2D template: a real-time game
// wants the screen, and an always-visible panel would make `visible` a
// useless signal for "the designer is fiddling, stop the clock".
panel.setVisible(uiConfig.panel.visible);

const suspended = (): boolean => panel.visible || noteBox.isOpen();
const input = createInput(uiConfig.keys, suspended);

function rebuildStage(): void {
  stage.rebuild(config.arenaHalf, config.pickupCount, config.playerRadius);
  sync = createSync(stage, uiConfig.camera);
  sync.push(sim.viewFor(recorder.state, "p1"));
}

/** True once the session log has been written, so it is written once per run. */
let logged = false;

function restart(seed: number): void {
  recorder = newRecorder(seed);
  clock = createFixedStep(config.tickMs, MAX_TICKS_PER_FRAME);
  logged = false;
  rebuildStage();
  drawHud();
}

/** The only way state changes: real input and playtest replays both come through here. */
function dispatch(playerId: string, action: sim.Action): void {
  recorder.apply(playerId, action);
  sync.push(sim.viewFor(recorder.state, "p1"));
  if (recorder.state.winner !== null && !logged) {
    logged = true;
    // Stand-in for the session log of Stage 7: replay plus the notes
    // taken during it, which is what makes "12s felt bad" reviewable.
    console.info("[_template-3d] session", JSON.stringify({ ...recorder.finish(), notes: noteBox.notes() }));
  }
}

const HINT = "WASD or arrows to move · ` tuning · N note · ?seed= to repeat a layout";
let hudText = "";

function drawHud(): void {
  const view = sim.viewFor(recorder.state, "p1");
  const seconds = ((view.tick * config.tickMs) / 1000).toFixed(1);
  const status =
    view.winner === "p1"
      ? `Collected ${view.winAt} in ${seconds}s.`
      : view.winner === "timeout"
        ? `Out of time with ${view.players.p1.collected}/${view.winAt}.`
        : `${view.players.p1.collected}/${view.winAt} · ${seconds}s`;
  // Only touch the DOM when the text actually changed: this runs every
  // frame, and rewriting innerHTML at 60 Hz costs more than the scene.
  if (status === hudText) return;
  hudText = status;
  hud.innerHTML = `<div class="status">${status}</div><div class="meta">${HINT}</div>`;
}

function resize(): void {
  stage.resize(canvas.clientWidth, canvas.clientHeight);
}
window.addEventListener("resize", resize);

/** One tick of held input, as an action. Stops feeding the sim once it is over. */
function tickFromInput(): void {
  if (recorder.state.winner !== null) return;
  dispatch("p1", { type: "tick", input: input.read() });
}

rebuildStage();
resize();
drawHud();

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
    sync.draw(alpha(clock));
    drawHud();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
