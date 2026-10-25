import test from "node:test";
import assert from "node:assert/strict";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { validateStage } from "../app/stage/validator.ts";
import { suggestedStageWords } from "../app/stage/vocabulary.ts";

const solve = (stage, source = "あるく") => {
  const code = analyzeProgram(source);
  assert.deepEqual(code.diagnostics, [], source);
  return runToCompletion(createGame(stage, code.program));
};

test("時限扉は固定tickで閉じ、急いでも時間切れなら通れない", () => {
  const stage = { goal: 950, scrollSpeed: 3, objects: [
    { type: "switch", id: "sw", position: 280, targetDoorId: "gate" },
    { type: "door", id: "gate", position: 650, autoCloseTicks: 65 },
  ] };
  assert.deepEqual(validateStage("stage-timed", stage), []);
  const timedOut = solve(stage, "すいっちおす");
  assert.equal(timedOut.status, "failed");
  assert.equal(timedOut.failureReason, "door");
  const longer = { ...stage, objects: stage.objects.map(o => o.type === "door" ? { ...o, autoCloseTicks: 300 } : o) };
  assert.equal(solve(longer, "すいっちおす").status, "cleared");
  assert.equal(solve(longer, "すいっちおす").elapsedTicks, solve(longer, "すいっちおす").elapsedTicks);
});

test("うごくゆかは接地時だけ速度を変え、描画に依存せず同じtickで決着する", () => {
  const stage = { goal: 950, scrollSpeed: 3, objects: [
    { type: "conveyor", id: "c", position: 300, width: 180, multiplier: 2 },
  ] };
  assert.deepEqual(validateStage("stage-conveyor", stage), []);
  const normal = solve({ ...stage, objects: [] });
  const fast = solve(stage);
  assert.equal(normal.status, "cleared");
  assert.equal(fast.status, "cleared");
  assert.ok(fast.elapsedTicks < normal.elapsedTicks);
  assert.equal(solve(stage).elapsedTicks, fast.elapsedTicks);
  assert.deepEqual(analyzeProgram("うごくゆかならあるく").rules[0].conds, ["conveyor"]);
  assert.ok(suggestedStageWords(stage).conditions.includes("conveyor"));
});

test("もろいゆかは踏んだ固定tick後に崩れ、空中ではまだ崩れない", () => {
  const stage = { goal: 950, scrollSpeed: 3, objects: [
    { type: "fragileFloor", id: "f", position: 300, width: 260, breakAfterTicks: 10 },
  ] };
  assert.deepEqual(validateStage("stage-fragile", stage), []);
  const game = solve(stage);
  assert.equal(game.fragileFloors[0].collapsed, true);
  assert.equal(game.status, "failed");
  assert.equal(game.failureReason, "hole");
  assert.deepEqual(analyzeProgram("もろいゆかがあったらとぶ").rules[0].conds, ["fragileFloor"]);
  assert.ok(suggestedStageWords(stage).conditions.includes("fragileFloor"));
});

test("新ギミックの異常な寸法とtick指定は登録前に拒否する", () => {
  const invalid = [
    { type: "conveyor", position: 300, width: -1, multiplier: 3 },
    { type: "fragileFloor", position: 300, width: 20, breakAfterTicks: 0 },
    { type: "door", id: "g", position: 700, autoCloseTicks: 0 },
  ];
  for (const object of invalid) {
    const issues = validateStage("invalid", { goal: 1500, scrollSpeed: 3, objects: [object] });
    assert.ok(issues.some(v => /(width|multiplier|breakAfterTicks|autoCloseTicks)/.test(v.path)), JSON.stringify(object));
  }
});
