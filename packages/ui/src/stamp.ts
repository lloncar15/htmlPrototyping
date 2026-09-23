// Build/config version stamp, always visible in a corner. Two designers
// comparing notes need to know they are on the same build and the same
// numbers, and every bug report needs a seed to reproduce it.

export type StampFields = {
  buildHash: string;
  /** e.g. "sim@1,ui@1" — the version field of every config file. */
  configVersion: string;
  seed: number;
};

export type VersionStamp = {
  element: HTMLElement;
  update(fields: Partial<StampFields>): void;
  dispose(): void;
};

export function createVersionStamp(fields: StampFields, container?: HTMLElement): VersionStamp {
  let current = { ...fields };
  const element = document.createElement("div");
  element.dataset.stamp = "";
  element.style.cssText = [
    "position:fixed",
    "left:8px",
    "bottom:8px",
    "z-index:10",
    "padding:3px 7px",
    "border-radius:4px",
    "background:rgba(0,0,0,0.55)",
    "color:#e6e8eb",
    "font:11px/1.4 ui-monospace, monospace",
    "pointer-events:none",
    "user-select:none",
  ].join(";");

  const render = (): void => {
    element.textContent = `seed ${current.seed} · ${current.configVersion} · build ${current.buildHash}`;
  };
  render();
  (container ?? document.body).appendChild(element);

  return {
    element,
    update(next) {
      current = { ...current, ...next };
      render();
    },
    dispose: () => element.remove(),
  };
}

/** "sim@1,ui@2" from { sim: simConfig, ui: uiConfig }; files without a version are skipped. */
export function configVersionOf(configs: Record<string, object>): string {
  return Object.entries(configs)
    .map(([name, config]) => [name, (config as { version?: unknown }).version] as const)
    .filter(([, version]) => typeof version === "number")
    .map(([name, version]) => `${name}@${version}`)
    .join(",");
}
