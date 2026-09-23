// Saving a file from the page. Used by "Export JSON" in the tuning panel
// and by the session-log export, so a designer never needs a code editor
// to get values back out of a prototype.

/** Trigger a browser download of `text` as `filename`. */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoke on the next task: Safari needs the URL alive during the click.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Download `value` as pretty-printed JSON, matching the repo's file style. */
export function downloadJson(filename: string, value: unknown): void {
  downloadText(filename, `${JSON.stringify(value, null, 2)}\n`);
}
