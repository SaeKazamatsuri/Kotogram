import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProgram } from "../app/language/parser.ts";
import { GAME, createGame, runToCompletion, stepGame } from "../app/game/core.ts";
import { ENGINE_VERSION } from "../app/scoring/score.ts";

const stage = { goal: 800, scrollSpeed: 3 };

test("run and walk are accepted as hiragana procedural actions", () => {
  const fast = analyzeProgram("はしる\nかべとぶ");
  assert.deepEqual(fast.diagnostics, []);
  assert.equal(fast.program.steps[0].action, "run");
  assert.equal(fast.program.watchers[0].action, "jump");
  const slow = analyzeProgram("あるく");
  assert.deepEqual(slow.diagnostics, []);
  assert.equal(slow.program.steps[0].action, "walk");
});

test("run raises base velocity by 1.3x without changing tick rate", () => {
  const fast = createGame(stage, analyzeProgram("はしる").program);
  stepGame(fast);
  assert.equal(fast.baseSpeed, 3);
  assert.equal(fast.vx, 3 * GAME.runMultiplier);
  assert.equal(GAME.tickRate, 60);
  const plain = runToCompletion(createGame(stage));
  const rushed = runToCompletion(createGame(stage, analyzeProgram("はしる").program));
  assert.equal(plain.status, "cleared");
  assert.equal(rushed.status, "cleared");
  assert.ok(rushed.elapsedTicks < plain.elapsedTicks);
});

test("walk restores stage speed and repeat executions do not multiply velocity", () => {
  const game = createGame(stage, analyzeProgram("はしる\nあるく").program);
  stepGame(game);
  assert.equal(game.vx, game.baseSpeed);
  const repeated = createGame(stage, analyzeProgram("3かいはしる").program);
  for (let i = 0; i < 4; i++) stepGame(repeated);
  assert.equal(repeated.vx, repeated.baseSpeed * GAME.runMultiplier);
});

test("speed alone brings a wall collision forward, preserving risk", () => {
  const obstacleStage = { goal: 800, scrollSpeed: 3, objects: [{ type: "wall", position: 600 }] };
  const walking = runToCompletion(createGame(obstacleStage));
  const running = runToCompletion(createGame(obstacleStage, analyzeProgram("はしる").program));
  assert.equal(walking.status, "failed");
  assert.equal(running.status, "failed");
  assert.equal(running.failureReason, "wall");
  assert.ok(running.elapsedTicks < walking.elapsedTicks);
});

test("speed physics changes have a separate engine version for ranking isolation", () => {
  assert.equal(ENGINE_VERSION, "2026-core-v3");
});
