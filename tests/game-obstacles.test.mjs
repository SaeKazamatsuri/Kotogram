import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../app/game/core.ts";
import { obstaclePhase, drawHoles, drawWorldObjects, drawFinish } from "../app/game/obstacles.ts";

test("障害物アニメーションの位相は同じtickで同じ値になる", () => {
  assert.equal(obstaclePhase(32, 2, 0.07), obstaclePhase(32, 2, 0.07));
  assert.notEqual(obstaclePhase(32, 2, 0.07), obstaclePhase(33, 2, 0.07));
});

test("すべての障害物の装飾描画は物理状態へ影響しない", () => {
  const game = createGame({
    goal: 840,
    objects: [
      { type: "hole", position: 100, width: 80 },
      { type: "wall", position: 180 },
      { type: "ghost", position: 220 },
      { type: "coin", id: "coin-1", position: 250 },
      { type: "door", id: "door-1", position: 300 },
      { type: "switch", id: "switch-1", position: 270, targetDoorId: "door-1" }
    ],
  });
  const before = JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value);
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key === "createLinearGradient") return () => ({ addColorStop() {} });
      return target[key] ?? ((...args) => calls.push([key, ...args]));
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  drawHoles(ctx, game);
  drawWorldObjects(ctx, game, 40);
  drawFinish(ctx, game);
  assert.ok(calls.some(([name]) => name === "roundRect"));
  assert.equal(JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value), before);
});

test("待機中もコインとおばけが見た目だけ動き、判定と公式tickは変化しない", () => {
  const game = createGame({
    goal: 1000,
    objects: [
      { type: "coin", id: "coin-a", position: 250 },
      { type: "ghost", position: 350 },
    ],
  });
  const originalState = JSON.stringify(game, (_key, v) => v instanceof Set ? [...v] : v);
  const drawAt = (visualTick) => {
    const calls = [];
    const ctx = new Proxy({}, {
      get(target, key) {
        if (key === "createLinearGradient") return () => ({ addColorStop() {} });
        return target[key] ?? ((...args) => calls.push([key, ...args]));
      },
      set(target, key, value) { target[key] = value; return true; },
    });
    drawWorldObjects(ctx, game, visualTick);
    return calls;
  };
  const before = drawAt(0);
  const after = drawAt(43);
  assert.notDeepEqual(after, before);
  assert.equal(JSON.stringify(game, (_key, v) => v instanceof Set ? [...v] : v), originalState);
  assert.equal(game.elapsedTicks, 0);
});
