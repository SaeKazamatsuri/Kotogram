import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { validateStage } from "../app/stage/validator.ts";

const load = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const candidate = load("experiments/stages/stage-5-pace-candidate.json");
const original = load("public/stages/stage-5.json");

function play(stage, source) {
  const parsed = analyzeProgram(source);
  assert.deepEqual(parsed.diagnostics, [], source);
  return runToCompletion(createGame(stage, parsed.program));
}

test("ステージ5 r2には実験候補の配置を採用し、候補fixtureは非公開のままにする", () => {
  assert.deepEqual(validateStage(candidate.id, candidate, true), []);
  assert.deepEqual(validateStage(original.id, original, true), []);
  assert.deepEqual(original.objects, candidate.objects);
  assert.equal(original.objects.find(({ id }) => id === "solo-ghost").position, 1340);
  assert.equal(original.objects.find(({ id }) => id === "middle-hole").position, 1456);
  const manifest = load("public/stages/manifest.json");
  assert.equal(manifest.stages.find(({ id }) => id === "stage-5").version, "2026-10-20-r2");
  assert.ok(!manifest.stages.some(({ id }) => id === candidate.id));
});

test("ステージ5候補は既存の初心者・正確な高速解法の学習内容を維持する", () => {
  const beginner = play(candidate, "かべならじゃんぷ\nあなならじゃんぷ\nおばけならしゃがむ");
  const fast = play(candidate, "はしる\nかべとあなとぶ\nおばけしゃがむ");
  assert.equal(beginner.status, "cleared");
  assert.equal(fast.status, "cleared");
  assert.ok(fast.elapsedTicks < beginner.elapsedTicks);
});

test("広い前方条件では歩く/走るの難易度が変わり、減速で回避できる", () => {
  const walking = play(candidate, "まえとぶ\nおばけしゃがむ");
  const running = play(candidate, "はしる\nまえとぶ\nおばけしゃがむ");
  const slowdown = play(candidate, "はしる\nあなあるく\nまえとぶ\nおばけしゃがむ");
  assert.equal(walking.status, "cleared");
  assert.equal(running.status, "failed");
  assert.equal(running.failureReason, "hole");
  assert.equal(slowdown.status, "cleared");
  assert.ok(slowdown.elapsedTicks < walking.elapsedTicks);
});
