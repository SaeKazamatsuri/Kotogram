import test from "node:test";
import assert from "node:assert/strict";
import { editNicknameWithSoftKey as edit } from "../app/ranking/nickname-input.ts";

test("ソフトウェアキーボードで名前の追加、消去、濁点変換ができる", () => {
  const initial = { text: "", start: 0, end: 0 };
  const first = edit(initial, { kind: "insert", text: "か" });
  assert.deepEqual(first, { text: "か", start: 1, end: 1 });
  const voiced = edit(first, { kind: "dakuten" });
  assert.equal(voiced.text, "が");
  const name = edit(voiced, { kind: "insert", text: "め" });
  assert.equal(name.text, "がめ");
  assert.equal(edit(name, { kind: "backspace" }).text, "が");
});

test("名前は16文字まで、改行なし、範囲選択とカーソル移動にも対応", () => {
  const full = { text: "あ".repeat(16), start: 16, end: 16 };
  assert.deepEqual(edit(full, { kind: "insert", text: "い" }), full);
  assert.equal(edit({ text: "あい", start: 0, end: 1 }, { kind: "insert", text: "か" }).text, "かい");
  assert.equal(edit({ text: "あい", start: 1, end: 1 }, { kind: "insert", text: "\n" }).text, "あい");
  assert.equal(edit({ text: "あい", start: 1, end: 1 }, { kind: "left" }).start, 0);
  assert.equal(edit({ text: "あい", start: 2, end: 2 }, { kind: "right" }).start, 2);
});
