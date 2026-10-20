import test from "node:test";
import assert from "node:assert/strict";
import { createGame, GAME } from "../app/game/core.ts";
import { failureAnimationDuration, resolveCharacterMotion } from "../app/game/character.ts";

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

test("ゲームオーバーのアニメーションは失敗理由で変わり、ゲーム状態を変更しない", () => {
  const game = createGame({ goal: 1000 });
  game.status = "failed";
  const before = JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value);
  const motions = {};
  for (const reason of ["wall", "door", "enemy", "hole", "coin", "void"]) {
    game.failureReason = reason;
    const first = resolveCharacterMotion(game, 40, false, 0);
    const middle = resolveCharacterMotion(game, 40, false, 0.5);
    const final = resolveCharacterMotion(game, 40, false, 1);
    assert.equal(first.stunned, true);
    assert.equal(middle.stride, 0);
    assert.notDeepEqual([middle.offsetX, middle.offsetY, middle.tilt], [first.offsetX, first.offsetY, first.tilt]);
    motions[reason] = { middle, final };
  }
  assert.ok(motions.wall.middle.offsetX < 0);
  assert.ok(motions.door.middle.offsetX < 0);
  assert.ok(motions.enemy.middle.offsetY < 0);
  assert.ok(motions.hole.final.offsetY > motions.hole.middle.offsetY);
  assert.equal(motions.hole.final.fade, 0);
  assert.ok(motions.coin.middle.offsetY > 0);
  game.failureReason = undefined;
  assert.equal(JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value), before);
});

test("失敗演出は穴で長く、コイン不足で短い", () => {
  assert.ok(failureAnimationDuration("hole") > failureAnimationDuration("wall"));
  assert.ok(failureAnimationDuration("coin") < failureAnimationDuration("wall"));
  assert.equal(failureAnimationDuration("door"), failureAnimationDuration("enemy"));
});
