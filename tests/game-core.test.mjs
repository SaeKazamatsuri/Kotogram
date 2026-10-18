import test from "node:test";
import assert from "node:assert/strict";
import { createGame, stepGame, runToCompletion, elapsedSeconds, GAME } from "../app/game/core.ts";

const wallStage = {
  goal: 2200,
  scrollSpeed: 3,
  objects: [600, 1000, 1400].map((position) => ({ type: "wall", position })),
};

const comboStage = {
  goal: 1500,
  scrollSpeed: 3,
  objects: [
    { type: "wall", position: 600 },
    { type: "ghost", position: 600 },
    { type: "wall", position: 1000 },
    { type: "ghost", position: 1000 },
  ],
};

test("fixed tick clear time and deterministic replay", () => {
  const program = [{ cond: "wall", action: "jump" }];
  const result = runToCompletion(createGame(wallStage, program));
  assert.equal(result.status, "cleared");
  assert.equal(elapsedSeconds(result), result.elapsedTicks / GAME.tickRate);
  for (let i = 0; i < 15; i++) {
    const replay = runToCompletion(createGame(wallStage, program));
    assert.deepEqual(
      [replay.status, replay.elapsedTicks, replay.walls.every((wall) => wall.cleared)],
      [result.status, result.elapsedTicks, true],
    );
  }
});

test("one continuous wall rule handles all walls", () => {
  const result = runToCompletion(createGame(wallStage, [{ cond: "wall", action: "jump" }]));
  assert.equal(result.status, "cleared");
  assert.equal(result.fired[0].size, 3);
});

test("no jump command fails on the first wall", () => {
  const result = runToCompletion(createGame(wallStage, []));
  assert.equal(result.status, "failed");
  assert.equal(result.failureReason, "wall");
});

test("crouch and jump may execute simultaneously", () => {
  const result = runToCompletion(createGame(comboStage, [
    { cond: "wall", action: "jump" },
    { cond: "enemy", action: "crouch" },
  ]));
  assert.equal(result.status, "cleared");
  assert.ok(result.walls.every((wall) => wall.cleared));
  assert.ok(result.ghosts.every((ghost) => ghost.cleared));
});

test("unconditional command is one-shot and finished runs do not advance", () => {
  const result = runToCompletion(createGame({ goal: 350, scrollSpeed: 3 }, [{ action: "jump" }]));
  assert.equal(result.status, "cleared");
  assert.equal(result.fired[0].size, 1);
  const ticks = result.elapsedTicks;
  stepGame(result);
  assert.equal(result.elapsedTicks, ticks);
});

test("max tick prevents unbounded simulations", () => {
  const result = runToCompletion(createGame({ goal: 1e9, scrollSpeed: 3 }), 10);
  assert.equal(result.status, "timeout");
  assert.equal(result.elapsedTicks, 10);
});

test("legacy stage coordinates work", () => {
  const result = createGame({ goal: 900, walls: [200, 400], holes: [500, { x: 700, w: 90 }], ghosts: [300] });
  assert.deepEqual(result.walls.map((wall) => wall.x), [200, 400]);
  assert.deepEqual(result.holes.map((hole) => hole.w), [80, 90]);
  assert.equal(result.ghosts.length, 1);
});

test("stage 2 walls and holes can be cleared", () => {
  const stage = {
    goal: 3600,
    scrollSpeed: 3.6,
    objects: [
      { type: "wall", position: 600 },
      { type: "hole", position: 1100, width: 80 },
      { type: "wall", position: 1600 },
      { type: "hole", position: 2100, width: 100 },
      { type: "wall", position: 2600 },
      { type: "wall", position: 3100 },
    ],
  };
  const result = runToCompletion(createGame(stage, [
    { cond: "wall", action: "jump" },
    { cond: "hole", action: "jump" },
  ]));
  assert.equal(result.status, "cleared");
});

test("stage 3 walls, holes and ghosts can be cleared", () => {
  const objects = [
    ["wall", 600], ["ghost", 1000], ["hole", 1400, 100],
    ["wall", 1800], ["ghost", 2200], ["wall", 2600],
    ["hole", 3000, 120], ["ghost", 3400], ["wall", 3800],
    ["ghost", 4200], ["hole", 4600, 100], ["wall", 5000], ["wall", 5400],
  ].map(([type, position, width]) => ({ type, position, width }));
  const result = runToCompletion(createGame({ goal: 5800, scrollSpeed: 4, objects }, [
    { cond: "wall", action: "jump" },
    { cond: "hole", action: "jump" },
    { cond: "enemy", action: "crouch" },
  ]));
  assert.equal(result.status, "cleared");
});

test("collect watcher picks separate coins once and fulfills the clear requirement", () => {
  const stage = {
    goal: 1000, scrollSpeed: 3, requiredCoins: 2,
    objects: [{ id: "a", type: "coin", position: 280 }, { id: "b", type: "coin", position: 720 }],
  };
  const coinRule = [{ cond: "coin", action: "collect" }];
  const finished = runToCompletion(createGame(stage, coinRule));
  assert.equal(finished.status, "cleared");
  assert.equal(finished.coins.filter((coin) => coin.collected).length, 2);
  assert.equal(finished.fired[0].size, 2);
  const absent = runToCompletion(createGame(stage, []));
  assert.equal(absent.status, "failed");
  assert.equal(absent.failureReason, "coin");
  assert.equal(absent.coins.filter((coin) => coin.collected).length, 0);
  assert.equal(runToCompletion(createGame(stage, coinRule)).elapsedTicks, finished.elapsedTicks);
});

test("collect action does not consume one-shot execution until a coin is reachable", () => {
  const game = createGame({ goal: 520, scrollSpeed: 3, requiredCoins: 1, objects: [{ type: "coin", position: 280 }] }, {
    watchers: [], steps: [{ op: "action", action: "collect", count: 1 }],
  });
  stepGame(game);
  assert.equal(game.cursor, 0);
  assert.equal(game.coins[0].collected, false);
  const result = runToCompletion(game);
  assert.equal(result.status, "cleared");
  assert.equal(result.cursor, 1);
  assert.equal(result.coins[0].collected, true);
});
