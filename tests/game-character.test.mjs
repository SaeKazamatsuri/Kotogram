import test from "node:test";
import assert from "node:assert/strict";
import { createGame, GAME } from "../app/game/core.ts";
import { resolveCharacterMotion } from "../app/game/character.ts";

test("歩行と走行は公式tickに応じて脚と体が動く", () => {
  const game = createGame({ goal: 1000 });
  game.elapsedTicks = 3;
  const first = resolveCharacterMotion(game);
  game.elapsedTicks = 8;
  const second = resolveCharacterMotion(game);
  assert.notEqual(first.stride, second.stride);
  assert.notEqual(first.bounce, second.bounce);
  game.vx = game.baseSpeed * GAME.runMultiplier;
  assert.equal(resolveCharacterMotion(game).pose, "running");
});

test("しゃがみジャンプも視覚状態を維持しゲーム状態を書き換えない", () => {
  const game = createGame({ goal: 1000 });
  game.vy = -5;
  game.crouchUntilTick = game.elapsedTicks + 4;
  const before = JSON.stringify({ vy: game.vy, py: game.py, elapsedTicks: game.elapsedTicks });
  const motion = resolveCharacterMotion(game);
  assert.equal(motion.pose, "crouch-jumping");
  assert.equal(motion.squash, GAME.crouchHeight / GAME.playerHeight);
  assert.equal(JSON.stringify({ vy: game.vy, py: game.py, elapsedTicks: game.elapsedTicks }), before);
});
