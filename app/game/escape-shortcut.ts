export type ShortcutKeyEvent = Pick<KeyboardEvent, "key" | "repeat" | "isComposing" | "ctrlKey" | "altKey" | "metaKey">;

export function createTripleEscapeDetector(now: () => number = () => Date.now(), maxGapMs = 1200) {
  let presses = 0;
  let lastPressedAt = 0;

  function reset() {
    presses = 0;
    lastPressedAt = 0;
  }

  function keydown(event: ShortcutKeyEvent): boolean {
    if (event.key !== "Escape" || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) {
      reset();
      return false;
    }
    if (event.repeat) return false;

    const pressedAt = now();
    presses = presses > 0 && pressedAt >= lastPressedAt && pressedAt - lastPressedAt <= maxGapMs ? presses + 1 : 1;
    lastPressedAt = pressedAt;

    if (presses < 3) return false;
    reset();
    return true;
  }

  return { keydown, reset };
}
