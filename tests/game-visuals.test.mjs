import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../app/game/core.ts";
import { getPlayerPose } from "../app/game/visuals.ts";

test("visual poses reflect physics but never mutate the simulation", () => {
  const game = createGame({ goal: 2000, scrollSpeed: 3 });
  const before = { px: game.px, py: game.py, vy: game.vy, vx: game.vx, elapsedTicks: game.elapsedTicks };
  assert.equal(getPlayerPose(game), "walking");
  game.vx = game.baseSpeed * 1.3;
  assert.equal(getPlayerPose(game), "running");
  game.vy = -5;
  assert.equal(getPlayerPose(game), "jumping");
  game.crouchUntilTick = game.elapsedTicks + 10;
  assert.equal(getPlayerPose(game), "crouch-jumping");
  game.vy = 0;
  game.py = 272;
  assert.equal(getPlayerPose(game), "crouching");
  game.crouchUntilTick = -1;
  assert.equal(getPlayerPose(game), "running");
  assert.deepEqual({ px: game.px, py: game.py, vx: game.vx, elapsedTicks: game.elapsedTicks }, { px: before.px, py: before.py, vx: before.vx * 1.3, elapsedTicks: before.elapsedTicks });
});
