import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGame, stepGame } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { getPlayerPose, getRepeatProgress } from "../app/game/visuals.ts";

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

test("ステージ8の3回ループは待機・実行中・完了の回数を表示できる", () => {
  const stage = JSON.parse(readFileSync(new URL("../public/stages/stage-8.json", import.meta.url), "utf8"));
  const parsed = analyzeProgram("3かいくりかえす\nこいんとる\nすいっちおす\nおわり");
  assert.deepEqual(parsed.diagnostics, []);
  const game = createGame(stage, parsed.program);
  assert.deepEqual(getRepeatProgress(game), { current: 0, total: 3 });
  const observed = new Set([0]);
  while (game.status === "running" && game.elapsedTicks < 2000) {
    stepGame(game);
    const progress = getRepeatProgress(game);
    assert.ok(progress);
    assert.equal(progress.total, 3);
    observed.add(progress.current);
  }
  assert.equal(game.status, "cleared");
  assert.equal(game.elapsedTicks, 846);
  assert.deepEqual([...observed].sort(), [0, 1, 2, 3]);
  assert.deepEqual(getRepeatProgress(game), { current: 3, total: 3 });
});

test("ループを使わない解法と1回ずつの列挙では繰り返し表示を出さない", () => {
  const stage = JSON.parse(readFileSync(new URL("../public/stages/stage-8.json", import.meta.url), "utf8"));
  const watchers = createGame(stage, analyzeProgram("こいんとる\nすいっちおす").program);
  assert.equal(getRepeatProgress(watchers), null);
  const expanded = Array(3).fill("1かいくりかえす\nこいんとる\nすいっちおす\nおわり").join("\n");
  const program = analyzeProgram(expanded);
  assert.deepEqual(program.diagnostics, []);
  assert.equal(getRepeatProgress(createGame(stage, program.program)), null);
});

test("表示用の繰り返し状態取得はGameStateに影響しない", () => {
  const program = analyzeProgram("3かいくりかえす\nこいんとる\nおわり").program;
  const game = createGame({ goal: 900 }, program);
  const before = JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value);
  assert.deepEqual(getRepeatProgress(game), { current: 0, total: 3 });
  assert.equal(JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value), before);
});
