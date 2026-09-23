// Renderer + input only. All rules live in ./sim; this file only calls
// applyAction (through the recorder) and draws viewFor. The designer
// layer (tuning panel, version stamp, note box, theme) comes from
// @proto/ui and is wired here, never inside the sim.
import { createRecorder, type Recorder } from "@proto/core";
import {
  configVersionOf,
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

const BUILD_HASH = "dev";
const params = new URLSearchParams(location.search);
const playtesting = params.has("playtest");

const allConfigVersions = (): string => configVersionOf({ sim: config, replay: replayConfig, ui: uiConfig });

function newRecorder(seed: number): Recorder<sim.State, sim.Action> {
  console.info(`[_template] seed=${seed} config=${allConfigVersions()}`);
  return createRecorder(sim, config, {
    seed,
    buildHash: BUILD_HASH,
    timestep: null,
    checkpointEvery: replayConfig.checkpointEvery,
  });
}

// Seed: ?seed=<uint32> to reproduce a run, otherwise derived from the clock.
const seedParam = params.get("seed");
let recorder = newRecorder(seedParam !== null ? Number(seedParam) : Date.now() >>> 0);

const root = document.getElementById("app") as HTMLDivElement;
const loadTheme = createThemeLoader(root, theme);

const stamp = createVersionStamp({
  buildHash: BUILD_HASH,
  configVersion: allConfigVersions(),
  seed: recorder.state.seed,
});

const noteBox = createNoteBox({
  hotkey: uiConfig.hotkeys.notes,
  turn: () => recorder.state.turn,
  playerId: () => recorder.state.active,
  onNote: (note: Note) => console.info("[_template] note", JSON.stringify(note)),
});

// Tuning changes the numbers a run started with, so the run restarts on
// the same seed: the designer sees the same deal under the new rules.
createTuningPanel({
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
      return;
    }
    recorder = newRecorder(recorder.state.seed);
    stamp.update({ configVersion: allConfigVersions(), seed: recorder.state.seed });
    render();
  },
});

function render(): void {
  const state = recorder.state;
  // Hotseat placeholder: show the active player's view.
  const view = sim.viewFor(state, state.active);
  const me = view.you ? view.players[view.you] : null;

  const status = view.winner
    ? view.winner === "draw"
      ? "Draw."
      : `${view.winner} wins.`
    : `Turn ${view.turn}/${view.maxTurns} — ${view.active} to play`;

  root.innerHTML = `
    <div class="panel">
      <div class="status">${status}</div>
      <div class="scores">
        ${sim.PLAYERS.map((id) => `<span>${id}: ${view.players[id].score} pts, ${view.players[id].handCount} cards</span>`).join("")}
      </div>
      <div class="hand">
        ${(me?.hand ?? []).map((card, i) => `<button data-index="${i}" ${view.winner ? "disabled" : ""}>${card}</button>`).join("")}
      </div>
      <div class="meta">\` tuning panel · N note · ?seed= to repeat a deal</div>
    </div>`;
}

/** The only way state changes: real input and playtest replays both come through here. */
function dispatch(playerId: string, action: sim.Action): void {
  recorder.apply(playerId, action);
  if (recorder.state.winner !== null) {
    // Stand-in for the session log of Stage 7: replay plus the notes
    // taken during it, which is what makes "turn 6 felt bad" reviewable.
    console.info("[_template] session", JSON.stringify({ ...recorder.finish(), notes: noteBox.notes() }));
  }
  render();
}

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button[data-index]");
  if (!button) return;
  dispatch(recorder.state.active, { type: "play", index: Number(button.getAttribute("data-index")) });
});

if (playtesting) {
  installPlaytestHook({
    configVersion: sim.configVersion(config),
    reset(seed) {
      recorder = newRecorder(seed);
      stamp.update({ seed });
      render();
    },
    dispatch,
    state: () => recorder.state,
  });
}

render();
