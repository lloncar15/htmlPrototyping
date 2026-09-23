// Renderer + input only. All rules live in ./sim; this file only calls
// applyAction (through the recorder) and draws viewFor.
import { createRecorder, type Recorder } from "@proto/core";
import replayConfig from "../config/replay.json";
import config from "../config/sim.json";
import theme from "../config/theme.json";
import { installPlaytestHook } from "./playtest-hook";
import * as sim from "./sim";

const BUILD_HASH = "dev";
const params = new URLSearchParams(location.search);

function newRecorder(seed: number): Recorder<sim.State, sim.Action> {
  console.info(`[_template] seed=${seed} config=${sim.configVersion(config)}`);
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
for (const [key, value] of Object.entries(theme)) {
  root.style.setProperty(`--${key}`, String(value));
}

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
      <div class="meta">seed ${state.seed} · ${sim.configVersion(config)} · ${BUILD_HASH}</div>
    </div>`;
}

/** The only way state changes: real input and playtest replays both come through here. */
function dispatch(playerId: string, action: sim.Action): void {
  recorder.apply(playerId, action);
  if (recorder.state.winner !== null) {
    console.info("[_template] replay", JSON.stringify(recorder.finish()));
  }
  render();
}

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button[data-index]");
  if (!button) return;
  dispatch(recorder.state.active, { type: "play", index: Number(button.getAttribute("data-index")) });
});

if (params.has("playtest")) {
  installPlaytestHook({
    configVersion: sim.configVersion(config),
    reset(seed) {
      recorder = newRecorder(seed);
      render();
    },
    dispatch,
    state: () => recorder.state,
  });
}

render();
