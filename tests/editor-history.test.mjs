import test from "node:test";
import assert from "node:assert/strict";
import { EditorHistory } from "../app/editor/history.ts";

test("editor history supports undo and redo without losing a previous branch", () => {
  const history = new EditorHistory();
  history.record({ text: "か", start: 1, end: 1 });
  history.record({ text: "かべ", start: 2, end: 2 });
  assert.deepEqual(history.undo(), { text: "か", start: 1, end: 1 });
  assert.deepEqual(history.undo(), { text: "", start: 0, end: 0 });
  assert.equal(history.undo(), null);
  assert.deepEqual(history.redo(), { text: "か", start: 1, end: 1 });
  history.record({ text: "かと", start: 2, end: 2 });
  assert.equal(history.canRedo, false);
  assert.deepEqual(history.undo(), { text: "か", start: 1, end: 1 });
});

test("editor history caps memory and ignores cursor-only changes", () => {
  const history = new EditorHistory();
  for (let i = 1; i <= 150; i++) history.record({ text: "あ".repeat(i), start: i, end: i });
  history.record({ text: "あ".repeat(150), start: 0, end: 0 });
  let steps = 0;
  while (history.undo()) steps++;
  assert.equal(steps, 99);
});
