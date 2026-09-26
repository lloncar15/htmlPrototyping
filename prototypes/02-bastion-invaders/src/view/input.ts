// Keyboard -> the tick's `input` object. Keybindings live in
// config/ui.json; nothing is hard-coded here.
//
// Input is sampled, not queued: the sim asks "what is held right now?"
// once per tick. Fire is held too; the sim's cooldown decides the rate.
// A tap shorter than a tick would fall between two samples, so a fire
// press is latched until the next read: tapping Space always throws.
//
// The designer layer wins over the game: while the tuning panel or the
// note box is open, `suspended()` is true and everything reads zero.
import type { Input } from "../sim";

export type KeyBindings = { left: string[]; right: string[]; fire: string[] };

export type InputReader = {
  read(): Input;
  dispose(): void;
};

export function createInput(keys: KeyBindings, suspended: () => boolean): InputReader {
  const held = new Set<string>();
  const bound = new Set([...keys.left, ...keys.right, ...keys.fire].map((k) => k.toLowerCase()));
  const fireKeys = new Set(keys.fire.map((k) => k.toLowerCase()));
  const anyHeld = (list: string[]): boolean => list.some((k) => held.has(k.toLowerCase()));
  let firePressed = false;

  const onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (!bound.has(key) || suspended()) return;
    // Space and arrows scroll the page otherwise.
    event.preventDefault();
    held.add(key);
    if (fireKeys.has(key)) firePressed = true;
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    held.delete(event.key.toLowerCase());
  };
  // Alt-tabbing away with a key down would otherwise leave it held forever.
  const onBlur = (): void => {
    held.clear();
    firePressed = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return {
    read() {
      const fire = firePressed || anyHeld(keys.fire);
      firePressed = false;
      if (suspended()) return { moveX: 0, fire: 0 };
      return {
        moveX: (anyHeld(keys.right) ? 1 : 0) - (anyHeld(keys.left) ? 1 : 0),
        fire: fire ? 1 : 0,
      };
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      held.clear();
    },
  };
}
