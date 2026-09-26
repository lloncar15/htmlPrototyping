// Keyboard -> the tick's `input` object. Keybindings live in
// config/ui.json; nothing is hard-coded here.
//
// Input is sampled, not queued: the sim asks "what is held right now?"
// once per tick, so a key pressed and released inside one tick is not a
// half-tick of movement. That is what makes a run reproducible from the
// recorded actions alone.
//
// The designer layer wins over the game: while the tuning panel or the
// note box is open, `suspended()` is true and every axis reads zero, so
// typing "was" into a note does not walk the capsule into a wall.
import type { Input } from "../sim";

export type KeyBindings = {
  forward: string[];
  back: string[];
  left: string[];
  right: string[];
};

export type InputReader = {
  read(): Input;
  /** True while a movement key is held, for the on-screen hint. */
  active(): boolean;
  dispose(): void;
};

export function createInput(keys: KeyBindings, suspended: () => boolean): InputReader {
  const held = new Set<string>();
  const bound = new Set([...keys.forward, ...keys.back, ...keys.left, ...keys.right].map((k) => k.toLowerCase()));

  const anyHeld = (list: string[]): boolean => list.some((k) => held.has(k.toLowerCase()));

  const onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (!bound.has(key)) return;
    // Arrow keys scroll the page otherwise, which jitters the canvas.
    event.preventDefault();
    held.add(key);
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    held.delete(event.key.toLowerCase());
  };
  // Alt-tabbing away with a key down would otherwise leave it held forever.
  const onBlur = (): void => held.clear();

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return {
    read() {
      if (suspended()) return { moveX: 0, moveZ: 0 };
      // -Z is forward: three.js is right-handed with the camera looking
      // down -Z, so "away from the camera" is negative.
      return {
        moveX: (anyHeld(keys.right) ? 1 : 0) - (anyHeld(keys.left) ? 1 : 0),
        moveZ: (anyHeld(keys.back) ? 1 : 0) - (anyHeld(keys.forward) ? 1 : 0),
      };
    },
    active() {
      return !suspended() && held.size > 0;
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      held.clear();
    },
  };
}
