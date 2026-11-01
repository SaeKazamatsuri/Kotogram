import test from "node:test";
import assert from "node:assert/strict";
import { createTripleEscapeDetector } from "../app/game/escape-shortcut.ts";

function key(key = "Escape", options = {}) {
  return { key, repeat: false, isComposing: false, ctrlKey: false, altKey: false, metaKey: false, ...options };
}

test("three successive escape presses trigger once and reset the counter", () => {
  let clock = 100;
  const detector = createTripleEscapeDetector(() => clock);
  assert.equal(detector.keydown(key()), false);
  clock += 350;
  assert.equal(detector.keydown(key()), false);
  clock += 350;
  assert.equal(detector.keydown(key()), true);
  clock += 350;
  assert.equal(detector.keydown(key()), false);
});

test("a long pause or another key breaks the escape sequence", () => {
  let clock = 100;
  const detector = createTripleEscapeDetector(() => clock);
  assert.equal(detector.keydown(key()), false);
  clock += 1201;
  assert.equal(detector.keydown(key()), false);
  clock += 100;
  assert.equal(detector.keydown(key("Shift")), false);
  clock += 100;
  assert.equal(detector.keydown(key()), false);
  clock += 100;
  assert.equal(detector.keydown(key()), false);
  clock += 100;
  assert.equal(detector.keydown(key()), true);
});

test("held Escape, modifier chords and IME cancellation do not trigger reset", () => {
  let clock = 100;
  const detector = createTripleEscapeDetector(() => clock);
  assert.equal(detector.keydown(key()), false);
  for (let i = 0; i < 4; i++) {
    clock += 50;
    assert.equal(detector.keydown(key("Escape", { repeat: true })), false);
  }
  clock += 50;
  assert.equal(detector.keydown(key("Escape", { isComposing: true })), false);
  clock += 50;
  assert.equal(detector.keydown(key("Escape", { ctrlKey: true })), false);
  clock += 50;
  assert.equal(detector.keydown(key()), false);
  clock += 50;
  assert.equal(detector.keydown(key()), false);
  clock += 50;
  assert.equal(detector.keydown(key()), true);
});

test("resetting on blur cancels an unfinished sequence", () => {
  const detector = createTripleEscapeDetector();
  assert.equal(detector.keydown(key()), false);
  assert.equal(detector.keydown(key()), false);
  detector.reset();
  assert.equal(detector.keydown(key()), false);
  assert.equal(detector.keydown(key()), false);
  assert.equal(detector.keydown(key()), true);
});
