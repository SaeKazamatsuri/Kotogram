import test from "node:test";
import assert from "node:assert/strict";
import { editWithSoftKey as edit } from "../app/editor/text-input.ts";

test("inserts at a middle caret and replaces a selection", () => {
  assert.deepEqual(edit({ text: "かべとぶ", start: 2, end: 2 }, { kind: "insert", text: "3かい" }),
    { text: "かべ3かいとぶ", start: 5, end: 5 });
  assert.deepEqual(edit({ text: "かべとぶ", start: 0, end: 2 }, { kind: "insert", text: "あな" }),
    { text: "あなとぶ", start: 2, end: 2 });
});

test("deletes selected range or one character and respects boundaries", () => {
  assert.equal(edit({ text: "かべとぶ", start: 2, end: 4 }, { kind: "backspace" }).text, "かべ");
  assert.equal(edit({ text: "かべ", start: 1, end: 1 }, { kind: "backspace" }).text, "べ");
  assert.equal(edit({ text: "かべ", start: 0, end: 0 }, { kind: "backspace" }).text, "かべ");
});

test("cursor buttons collapse selections and move at boundaries", () => {
  assert.equal(edit({ text: "かべ", start: 0, end: 2 }, { kind: "left" }).start, 0);
  assert.equal(edit({ text: "かべ", start: 0, end: 2 }, { kind: "right" }).start, 2);
  assert.equal(edit({ text: "かべ", start: 2, end: 2 }, { kind: "right" }).start, 2);
});

test("dakuten, handakuten, and small kana convert before caret", () => {
  assert.equal(edit({ text: "か", start: 1, end: 1 }, { kind: "dakuten" }).text, "が");
  assert.equal(edit({ text: "が", start: 1, end: 1 }, { kind: "dakuten" }).text, "か");
  assert.equal(edit({ text: "は", start: 1, end: 1 }, { kind: "handakuten" }).text, "ぱ");
  assert.equal(edit({ text: "つ", start: 1, end: 1 }, { kind: "small" }).text, "っ");
  assert.equal(edit({ text: "や", start: 0, end: 1 }, { kind: "small" }).text, "ゃ");
  assert.equal(edit({ text: "か", start: 1, end: 1 }, { kind: "handakuten" }).text, "か");
});

test("spaces and newline are inserted as characters, not command pieces", () => {
  const state = edit({ text: "かべとぶ", start: 4, end: 4 }, { kind: "insert", text: "\n" });
  assert.deepEqual(state, { text: "かべとぶ\n", start: 5, end: 5 });
});

test("複数文字の選択中は濁点・半濁点・小文字が範囲外の文字を書き換えない", () => {
  const selected = { text: "かはつや", start: 1, end: 3 };
  for (const kind of ["dakuten", "handakuten", "small"]) {
    assert.deepEqual(edit(selected, { kind }), selected);
  }
  assert.deepEqual(edit({ text: "かはつや", start: 1, end: 2 }, { kind: "handakuten" }), {
    text: "かぱつや", start: 2, end: 2,
  });
});
