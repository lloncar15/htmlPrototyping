// Playtest note box. A hotkey opens a text box; what the designer types
// is stamped with the turn and the player it came from, so "turn 6 felt
// bad" can be found again in the session log.
//
// Notes are kept in memory and handed to the prototype through onNote;
// the prototype writes them into its session log (Stage 7) or exports
// them with `notes()`.

export type Note = { turn: number; playerId: string; text: string };

export type NoteBoxOptions = {
  /** Key that opens the box, e.g. "n". Ignored while typing elsewhere. */
  hotkey: string;
  /** Read at the moment the note is saved. */
  turn: () => number;
  playerId: () => string;
  onNote?: (note: Note) => void;
  container?: HTMLElement;
};

export type NoteBox = {
  element: HTMLElement;
  open(): void;
  close(): void;
  /**
   * True while the box is showing. A real-time prototype reads this and
   * ignores held keys, so typing a note does not also drive the game.
   */
  isOpen(): boolean;
  notes(): Note[];
  dispose(): void;
};

const BOX_STYLE = [
  "position:fixed",
  "left:50%",
  "bottom:56px",
  "transform:translateX(-50%)",
  "z-index:20",
  "width:min(520px, calc(100vw - 32px))",
  "padding:10px",
  "border-radius:8px",
  "background:rgba(12,14,18,0.95)",
  "border:1px solid #3a3f4a",
  "box-shadow:0 8px 24px rgba(0,0,0,0.4)",
  "display:none",
  "gap:6px",
].join(";");

export function createNoteBox(options: NoteBoxOptions): NoteBox {
  const notes: Note[] = [];

  const element = document.createElement("div");
  element.dataset.noteBox = "";
  element.style.cssText = BOX_STYLE;

  const input = document.createElement("textarea");
  input.rows = 2;
  input.placeholder = "Note for this turn — Enter to save, Esc to cancel";
  input.style.cssText = [
    "width:100%",
    "box-sizing:border-box",
    "resize:vertical",
    "background:#14161a",
    "color:#e6e8eb",
    "border:1px solid #3a3f4a",
    "border-radius:5px",
    "padding:7px",
    "font:13px/1.4 system-ui, sans-serif",
  ].join(";");

  const status = document.createElement("div");
  status.style.cssText = "color:#8b929c;font:11px/1.4 system-ui, sans-serif;margin-top:6px";

  element.append(input, status);
  (options.container ?? document.body).appendChild(element);

  const setStatus = (): void => {
    const last = notes[notes.length - 1];
    status.textContent = last
      ? `${notes.length} note(s) this session · last: turn ${last.turn} “${last.text}”`
      : "No notes yet this session.";
  };
  setStatus();

  const box: NoteBox = {
    element,
    open() {
      element.style.display = "block";
      // A pointer-locked game swallows the cursor and every key; the box
      // is useless until the lock is released. Harmless when unlocked.
      if (document.pointerLockElement) document.exitPointerLock();
      input.focus();
    },
    close() {
      element.style.display = "none";
      input.value = "";
      input.blur();
    },
    isOpen: () => element.style.display === "block",
    notes: () => notes.map((note) => ({ ...note })),
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      element.remove();
    },
  };

  function save(): void {
    const text = input.value.trim();
    if (text.length > 0) {
      const note: Note = { turn: options.turn(), playerId: options.playerId(), text };
      notes.push(note);
      setStatus();
      options.onNote?.(note);
    }
    box.close();
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      box.close();
    }
  });

  function onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typingElsewhere =
      target !== input &&
      target !== null &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    if (event.key.toLowerCase() !== options.hotkey.toLowerCase()) return;
    if (typingElsewhere || event.metaKey || event.ctrlKey) return;
    if (box.isOpen()) return;
    event.preventDefault();
    box.open();
  }
  window.addEventListener("keydown", onKeyDown);

  return box;
}
