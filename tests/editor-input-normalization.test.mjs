import test from "node:test";
import assert from "node:assert/strict";
import { codeInputNotice, sanitizeCodeInput } from "../app/editor/input-normalization.ts";

test("katakana are normalized into hiragana without losing valid commands", () => {
  assert.equal(sanitizeCodeInput("カベガマエニアッタラジャンプスル"), "かべがまえにあったらじゃんぷする");
  assert.equal(sanitizeCodeInput("コインヲトル"), "こいんをとる");
  assert.equal(codeInputNotice("カベトブ"), "かたかなを ひらがなに なおしたよ。");
});

test("unsupported input is explained instead of silently disappearing", () => {
  assert.equal(sanitizeCodeInput("壁をジャンプ"), "をじゃんぷ");
  assert.match(codeInputNotice("壁をジャンプ"), /つかえない もじ/);
  assert.equal(codeInputNotice("かべとぶ"), null);
  assert.equal(sanitizeCodeInput("かべとぶ\nあなとぶ"), "かべとぶ\nあなとぶ");
  assert.equal(sanitizeCodeInput("かべ２かいとぶ"), "かべ２かいとぶ");
});
