import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAME, createGame, runToCompletion, stepGame } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { countSourceCharacters } from "../app/scoring/score.ts";
import { validateStage } from "../app/stage/validator.ts";

const read = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const stage = read("experiments/stages/pace-route.json");
const programs = {
  walk: "まえとぶ\nおばけしゃがむ",
  unsafeRun: "はしる\nまえとぶ\nおばけしゃがむ",
  switchAtHole: "はしる\nあなあるく\nまえとぶ\nおばけしゃがむ",
  switchBackAtWall: "はしる\nあなあるく\nかべはしる\nまえとぶ\nおばけしゃがむ",
  preciseRun: "はしる\nおばけしゃがむ\nあなとぶ\nかべとぶ",
};

function run(source) {
  const analysis = analyzeProgram(source);
  assert.deepEqual(analysis.diagnostics, [], source);
  return runToCompletion(createGame(stage, analysis.program));
}

test("実験ステージは検証スキーマを満たし公開マニフェストとは分離する", () => {
  assert.deepEqual(validateStage(stage.id, stage, true), []);
  const manifest = read("public/stages/manifest.json");
  assert.ok(!manifest.stages.some((item) => item.id === stage.id));
});

test("歩行は成功するが同じ前方ジャンプのまま走ると穴で失敗する", () => {
  const walk = run(programs.walk);
  const runOnly = run(programs.unsafeRun);
  assert.equal(walk.status, "cleared");
  assert.equal(runOnly.status, "failed");
  assert.equal(runOnly.failureReason, "hole");
  assert.ok(runOnly.elapsedTicks < walk.elapsedTicks);
});

test("走る→穴で歩く→壁で走るは安全で歩き続けるより短時間", () => {
  const walk = run(programs.walk);
  const slowDown = run(programs.switchAtHole);
  const speedUp = run(programs.switchBackAtWall);
  assert.equal(slowDown.status, "cleared");
  assert.equal(speedUp.status, "cleared");
  assert.ok(speedUp.elapsedTicks < slowDown.elapsedTicks);
  assert.ok(slowDown.elapsedTicks < walk.elapsedTicks);
  assert.ok(walk.elapsedTicks - speedUp.elapsedTicks >= 30);
  assert.ok(countSourceCharacters(programs.walk) < countSourceCharacters(programs.switchBackAtWall));
});

test("正確な条件の組合せなら走り続けても成功し、速度切替が必須とは限らない", () => {
  const precise = run(programs.preciseRun);
  const switched = run(programs.switchBackAtWall);
  assert.equal(precise.status, "cleared");
  assert.ok(precise.elapsedTicks < switched.elapsedTicks);
});

test("速度切替はゲーム中のGameState.vxを変え、公式tickは決定論的", () => {
  const analysis = analyzeProgram(programs.switchBackAtWall);
  assert.deepEqual(analysis.diagnostics, []);
  const game = createGame(stage, analysis.program);
  const speedTransitions = [];
  let lastSpeed = game.vx;
  while (game.status === "running" && game.elapsedTicks < 20000) {
    stepGame(game);
    if (game.vx !== lastSpeed) {
      speedTransitions.push({ speed: game.vx, tick: game.elapsedTicks });
      lastSpeed = game.vx;
    }
  }
  assert.equal(game.status, "cleared");
  assert.deepEqual(speedTransitions.map(({ speed }) => speed), [
    GAME.runMultiplier * stage.scrollSpeed,
    stage.scrollSpeed,
    GAME.runMultiplier * stage.scrollSpeed,
  ]);
  assert.ok(speedTransitions[1].tick - speedTransitions[0].tick >= 10);
  assert.ok(speedTransitions[2].tick - speedTransitions[1].tick >= 10);
  const second = run(programs.switchBackAtWall);
  assert.equal(game.elapsedTicks, second.elapsedTicks);
});

test("公開ステージ1〜7の公式解法は無改変で成功し、高速解法も維持する", () => {
  const manifest = read("public/stages/manifest.json");
  const targets = manifest.stages.filter((entry) => /^stage-[1-7]$/.test(entry.id));
  assert.equal(targets.length, 7);
  for (const item of targets) {
    const published = read("public/stages/" + item.id + ".json");
    const checks = read("stage-checks/" + item.id + ".json");
    for (const check of checks.cases.filter(({ role }) => ["beginner", "short", "fast"].includes(role))) {
      const analysis = analyzeProgram(check.source);
      assert.deepEqual(analysis.diagnostics, [], item.id + ":" + check.name);
      const result = runToCompletion(createGame(published, analysis.program));
      assert.equal(result.status, "cleared", item.id + ":" + check.name);
      assert.equal(result.elapsedTicks, check.expectedTicks, item.id + ":" + check.name);
    }
  }
});
