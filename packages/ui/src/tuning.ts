// Tuning panel (Tweakpane) bound straight to a prototype's config
// objects, with an "Export JSON" button per file. A designer moves a
// slider, sees the change, exports the file, and drops it over
// prototypes/<slug>/config/<name>.json. No code editor involved.
//
// Ranges are not guessed: they come from the prototype's config/ui.json,
// so no tuning bound is hard-coded here. Exporting a file whose values
// changed bumps its `version`, because the replay contract is seed +
// config version + actions — same version must mean same numbers.
import { Pane } from "tweakpane";
import { downloadJson } from "./download";

/** Slider bounds for one field, addressed by dotted path ("costs.bread"). */
export type FieldSpec = { min?: number; max?: number; step?: number; label?: string };

export type TuningFile = {
  /** Config file name without .json — "sim" exports as sim.json. */
  name: string;
  /** The live config object. The panel mutates it in place. */
  config: Record<string, unknown>;
  fields?: Record<string, FieldSpec>;
};

export type TuningPanelOptions = {
  files: TuningFile[];
  title: string;
  expanded: boolean;
  /** Key that shows/hides the panel, e.g. "`". Ignored while typing. */
  hotkey?: string;
  container?: HTMLElement;
  /** Keys never shown as editable. Defaults to ["version"]. */
  skipKeys?: string[];
  /** Called after any value in `file` changed. */
  onChange?: (file: TuningFile) => void;
};

export type TuningPanel = {
  element: HTMLElement;
  visible: boolean;
  setVisible(visible: boolean): void;
  toggle(): void;
  /** Re-read the config objects after they changed from outside. */
  refresh(): void;
  dispose(): void;
};

const VERSION_KEY = "version";
const DEFAULT_SKIP_KEYS = [VERSION_KEY];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when the key event should be left to whatever the user is typing in. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

type Folder = ReturnType<Pane["addFolder"]>;

/**
 * Bind every editable leaf of `config` into `folder`, recursing into
 * nested objects as sub-folders. Arrays and nulls are skipped: sliders
 * are the wrong tool for them, so they stay a JSON edit.
 */
function bindObject(
  folder: Folder,
  object: Record<string, unknown>,
  file: TuningFile,
  skipKeys: string[],
  prefix: string,
  onChange: () => void,
): void {
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (skipKeys.includes(path) || skipKeys.includes(key)) continue;

    if (isPlainObject(value)) {
      bindObject(folder.addFolder({ title: key, expanded: true }), value, file, skipKeys, path, onChange);
      continue;
    }
    if (typeof value !== "number" && typeof value !== "boolean" && typeof value !== "string") continue;

    // Only pass what the spec actually sets: an explicit `undefined`
    // overrides Tweakpane's defaults, which is how you lose every label.
    const spec = file.fields?.[path] ?? {};
    const params: Record<string, unknown> = { label: spec.label ?? key };
    for (const bound of ["min", "max", "step"] as const) {
      if (spec[bound] !== undefined) params[bound] = spec[bound];
    }
    folder.addBinding(object, key, params).on("change", onChange);
  }
}

/**
 * Build the panel. It mutates the config objects it is given, so the
 * prototype should re-read them (or restart the run) in `onChange`.
 */
export function createTuningPanel(options: TuningPanelOptions): TuningPanel {
  const skipKeys = options.skipKeys ?? DEFAULT_SKIP_KEYS;
  const pane = new Pane({
    container: options.container,
    title: options.title,
    expanded: options.expanded,
  });

  // Edited files export with version + 1, so a replay or session log
  // recorded against the old numbers can never claim the new version.
  const edited = new Set<string>();

  for (const file of options.files) {
    const folder = pane.addFolder({ title: `${file.name}.json`, expanded: true });
    bindObject(folder, file.config, file, skipKeys, "", () => {
      edited.add(file.name);
      options.onChange?.(file);
    });
    folder.addButton({ title: "Export JSON" }).on("click", () => {
      const bump = edited.has(file.name) && typeof file.config[VERSION_KEY] === "number";
      if (bump) file.config[VERSION_KEY] = (file.config[VERSION_KEY] as number) + 1;
      downloadJson(`${file.name}.json`, file.config);
      if (bump) options.onChange?.(file);
      edited.delete(file.name);
    });
  }

  const element = pane.element;
  element.style.position = "fixed";
  element.style.top = "8px";
  element.style.right = "8px";
  element.style.width = "280px";
  element.style.zIndex = "10";

  const panel: TuningPanel = {
    element,
    visible: true,
    setVisible(visible) {
      panel.visible = visible;
      pane.hidden = !visible;
    },
    toggle: () => panel.setVisible(!panel.visible),
    refresh: () => pane.refresh(),
    dispose: () => {
      if (options.hotkey) window.removeEventListener("keydown", onKeyDown);
      pane.dispose();
    },
  };

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== options.hotkey || isTyping(event.target) || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    panel.toggle();
  }
  if (options.hotkey) window.addEventListener("keydown", onKeyDown);

  return panel;
}
