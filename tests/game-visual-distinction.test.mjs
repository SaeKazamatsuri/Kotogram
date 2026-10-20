import test from "node:test";
import assert from "node:assert/strict";
import { createGame, GAME } from "../app/game/core.ts";
import { drawAnimatedCharacter, resolveCharacterMotion } from "../app/game/character.ts";
import { drawHoles, drawWorldObjects } from "../app/game/obstacles.ts";

function canvasSpy() {
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key === "createLinearGradient") return () => ({ addColorStop() {} });
      return target[key] ?? ((...args) => calls.push([key, ...args]));
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { ctx, calls };
}

test("通常ジャンプとしゃがみジャンプは輪郭の動きが異なる", () => {
  const game = createGame({ goal: 800 });
  game.vy = -3;
  game.py = GAME.groundY - GAME.epsilon - 72;
  const before = JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value);
  const jump = canvasSpy();
  drawAnimatedCharacter(jump.ctx, game, 42);
  game.crouchUntilTick = game.elapsedTicks + 5;
  const crouch = canvasSpy();
  drawAnimatedCharacter(crouch.ctx, game, 42);
  assert.equal(resolveCharacterMotion(game).pose, "crouch-jumping");
  assert.notDeepEqual(jump.calls.filter(([method]) => method === "lineTo"), crouch.calls.filter(([method]) => method === "lineTo"));
  game.crouchUntilTick = -1;
  assert.equal(JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value), before);
});

test("影は高さによって小さくなるが物理状態は変化しない", () => {
  const game = createGame({ goal: 800 });
  const grounded = resolveCharacterMotion(game);
  game.vy = -4;
  game.py -= 100;
  const high = resolveCharacterMotion(game);
  assert.equal(grounded.shadowScale, 1);
  assert.ok(high.shadowScale < grounded.shadowScale);
  assert.ok(high.shadowScale >= 0.5);
});

test("穴の両端と壁の当たり判定境界が描画から読み取れる", () => {
  const game = createGame({ goal: 800, objects: [
    { type: "hole", position: 180, width: 100 },
    { type: "wall", position: 340 },
    { type: "door", position: 440, id: "door-a" },
  ] });
  const snapshot = JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value);
  const { ctx, calls } = canvasSpy();
  drawHoles(ctx, game);
  drawWorldObjects(ctx, game);
  assert.ok(calls.some(([method, x, y, width, height]) =>
    method === "strokeRect" && x === 340 - (game.px - GAME.playerScreenX) && y === GAME.groundY - GAME.wallHeight && width === GAME.wallWidth && height === GAME.wallHeight));
  assert.equal(JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value), snapshot);
});
