// Theme loader. config/theme.json is the only visual file code reads, so
// a designer can reskin a prototype without touching logic. Every key
// becomes a CSS custom property: { "bg": "#111" } -> `--bg: #111`.
// Numbers are written unitless; use calc(var(--radius) * 1px) in CSS.

export type Theme = Record<string, string | number>;

/** Write every theme key onto `element` as a CSS custom property. */
export function applyTheme(element: HTMLElement, theme: Theme): void {
  for (const [key, value] of Object.entries(theme)) {
    element.style.setProperty(`--${key}`, String(value));
  }
}

/**
 * Apply a theme and keep it applied. Call the returned function with a
 * changed theme (from the tuning panel) to re-apply it live.
 */
export function createThemeLoader(element: HTMLElement, theme: Theme): (next?: Theme) => void {
  let current = theme;
  const load = (next?: Theme): void => {
    if (next) current = next;
    applyTheme(element, current);
  };
  load();
  return load;
}
