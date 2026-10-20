import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram, tokenizeLine } from "../app/language/parser.ts";
import { generateCelebrationWav } from "../app/game/celebration-music.ts";
import { createGame } from "../app/game/core.ts";
import { drawResultEffects } from "../app/game/effects.ts";

const read = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));

test("unsupported phrases are highlighted as full words, not one character", () => {
  const tokens = tokenizeLine("おばけよける", 3);
  const unknowns = tokens.filter((token) => token.kind === "unknown");
  assert.deepEqual(unknowns.map((token) => token.raw), ["よける"]);
  assert.deepEqual(unknowns.map((token) => [token.line, token.column]), [[3, 4]]);
  const report = analyzeProgram(["かべとぶ", "あなとぶ", "おばけよける"]);
  assert.equal(report.diagnostics.length, 1);
  assert.equal(report.diagnostics[0].line, 3);
  assert.equal(report.diagnostics[0].column, 4);
  assert.match(report.diagnostics[0].message, /『よける』/);
  assert.match(report.diagnostics[0].message, /しゃがむ/);
  assert.deepEqual(report.program.watchers, []);
  assert.deepEqual(report.program.steps, []);
  assert.deepEqual(tokenizeLine("ほげとぶ", 1).filter((item) => item.kind === "unknown").map((item) => item.raw), ["ほげ"]);
});

test("the displayed editor placeholder is also a runnable program", () => {
  const example = "かべがまえにあったらじゃんぷをする";
  const parsed = analyzeProgram(example);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(parsed.rules, [{ action: "jump", conds: ["wall"], maxFires: undefined }]);
  const editor = readFileSync(new URL("../app/components/editor/CommandEditor.vue", import.meta.url), "utf8");
  assert.ok(editor.includes(`placeholder="${example}"`));
  assert.deepEqual(analyzeProgram("まえにかべがあったらじゃんぷをする").diagnostics, []);
});

test("every published stage title matches the actual playable goal and manifest", () => {
  const manifest = read("public/stages/manifest.json");
  const wanted = [
    "かべで ジャンプ", "かべと あなで ジャンプ", "おばけには しゃがむ",
    "4回 ジャンプ", "ジャンプと しゃがむを 同時に", "コインを とる", "スイッチを おす",
  ];
  assert.deepEqual(manifest.stages.map((item) => item.title), wanted);
  for (const stage of manifest.stages) {
    const data = read("public" + stage.file);
    assert.equal(data.meta.title, stage.title);
    assert.ok(!data.meta.title.includes("よける"));
  }
});

test("clear music WAV is deterministic, audible PCM with distinct victory cues", () => {
  const intro = Buffer.from(generateCelebrationWav("clear_fanfare"));
  const loop = Buffer.from(generateCelebrationWav("clear_loop"));
  for (const buffer of [intro, loop]) {
    assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
    assert.equal(buffer.toString("ascii", 8, 12), "WAVE");
    assert.equal(buffer.readUInt32LE(24), 22050);
    assert.equal(buffer.readUInt16LE(34), 16);
    assert.equal(buffer.readUInt16LE(22), 1);
    assert.ok(buffer.subarray(44).some((value) => value !== 0));
    assert.equal(buffer.readUInt32LE(40), buffer.byteLength - 44);
  }
  assert.ok(loop.length > intro.length);
  assert.deepEqual(Buffer.from(generateCelebrationWav("clear_fanfare")), intro);
});

test("canvas no longer draws confetti on stage clear but preserves failure shading", () => {
  const game = createGame({ goal: 950 });
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, name) {
      if (name === "createLinearGradient") return () => ({ addColorStop() {} });
      return target[name] ?? ((...args) => calls.push([name, ...args]));
    },
    set(target, name, value) { target[name] = value; return true; },
  });
  game.status = "cleared";
  drawResultEffects(ctx, game);
  assert.deepEqual(calls, []);
  game.status = "failed";
  drawResultEffects(ctx, game);
  assert.ok(calls.some(([name]) => name === "fillRect"));
});
