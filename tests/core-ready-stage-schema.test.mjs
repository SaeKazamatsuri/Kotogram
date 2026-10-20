import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAME, createGame, createReadyGame, startGame, stepGame, runToCompletion } from "../app/game/core.ts";
import { validateStage, validateStageCases } from "../app/stage/validator.ts";

const readJson = (name) => JSON.parse(readFileSync(new URL("../" + name, import.meta.url), "utf8"));

test("ready state does not advance until explicitly started", () => {
  const stage = { goal: 350, scrollSpeed: 3, objects: [{ type: "wall", position: 200 }] };
  const game = createReadyGame(stage, [{ cond: "wall", action: "jump" }]);
  const initial = { px: game.px, elapsedTicks: game.elapsedTicks };
  assert.equal(game.status, "ready");
  assert.equal(stepGame(game), "ready");
  assert.deepEqual({ px: game.px, elapsedTicks: game.elapsedTicks }, initial);
  assert.throws(() => runToCompletion(game), /Start a ready game/);
  startGame(game);
  assert.equal(game.status, "running");
  assert.throws(() => startGame(game), /Only a ready game/);
  stepGame(game);
  assert.equal(game.elapsedTicks, 1);
  assert.ok(game.px > initial.px);
});

test("fresh ready game restores physics, firing history and obstacles after retry", () => {
  const stage = { goal: 1100, scrollSpeed: 3, objects: [
    { id: "wall:0", type: "wall", position: 440 },
    { id: "hole:0", type: "hole", position: 700, width: 80 },
  ] };
  const program = [{ cond: "wall", action: "jump" }, { cond: "hole", action: "jump" }];
  const previous = createReadyGame(stage, program);
  startGame(previous);
  const result = runToCompletion(previous);
  const retry = createReadyGame(stage, program);
  assert.equal(retry.status, "ready");
  assert.equal(retry.elapsedTicks, 0);
  assert.deepEqual(retry.walls.map((x) => x.cleared), [false]);
  assert.deepEqual(retry.holes.map((x) => x.id), ["hole:0"]);
  assert.deepEqual(retry.fired.map((history) => history.size), [0, 0]);
  assert.equal(retry.py, GAME.groundY - GAME.epsilon);
  assert.equal(retry.vy, 0);
  startGame(retry);
  const again = runToCompletion(retry);
  assert.equal(again.status, result.status);
  assert.equal(again.elapsedTicks, result.elapsedTicks);
  assert.deepEqual(again.fired.map((history) => [...history]), result.fired.map((history) => [...history]));
});

test("published stages have explicit metadata and legacy-compatible runtime identities", () => {
  const manifest = readJson("public/stages/manifest.json");
  for (const { id, file } of manifest.stages) {
    const stage = readJson("public" + file);
    const checks = readJson("stage-checks/" + id + ".json");
    assert.deepEqual(validateStage(id, stage, true), [], id);
    assert.ok(stage.learningObjectives.length > 0, id);
    const game = createGame(stage);
    for (const kind of ["wall", "ghost", "hole", "coin", "door", "switch"]) {
      const plural = { wall: "walls", ghost: "ghosts", hole: "holes", coin: "coins", door: "doors", switch: "switches" }[kind];
      const ids = stage.objects.filter((item) => item.type === kind).map((item) => item.id).sort();
      if (Number(id.slice(6)) <= 3) {
        assert.deepEqual(game[plural].map((item) => item.id).sort(), ids, id + " " + kind);
      }
    }
    assert.equal(validateStageCases(id, stage, checks).pass, true, id);
  }
});

test("published validation rejects missing IDs and learning objectives without banning legacy fixtures", () => {
  const stage = { goal: 900, scrollSpeed: 3, objects: [{ type: "wall", position: 250 }] };
  assert.deepEqual(validateStage("stage-test", stage), []);
  const errors = validateStage("stage-test", stage, true);
  assert.ok(errors.some((issue) => issue.path === "id"));
  assert.ok(errors.some((issue) => issue.path === "learningObjectives"));
  assert.ok(errors.some((issue) => issue.path === "objects[0].id"));
});
