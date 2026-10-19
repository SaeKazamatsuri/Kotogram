import test from "node:test";
import assert from "node:assert/strict";
import { createGame, GAME, runToCompletion, stepGame } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { advanceFrameClock, createFrameClock } from "../app/game/frame-clock.ts";
import stage from "../public/stages/stage-1.json" with { type: "json" };

const program = analyzeProgram("かべとぶ").program;

function runWithFrames(fps, pause = false) {
  const game = createGame(stage, program);
  const interval = 1000 / fps;
  let clock = createFrameClock();
  let timestamp = 0;
  for (let frame = 0; frame < 10000 && game.status === "running"; frame++) {
    if (pause && frame === 40) timestamp += 30 * 60 * 1000;
    const advanced = advanceFrameClock(clock, timestamp, 1000 / GAME.tickRate);
    clock = advanced.clock;
    for (let i = 0; i < advanced.steps && game.status === "running"; i++) stepGame(game);
    timestamp += interval;
  }
  return { status: game.status, elapsedTicks: game.elapsedTicks };
}

test("5〜144fpsの描画条件でもクリア成否と公式tickは同じ", () => {
  const expected = runToCompletion(createGame(stage, program), 20000);
  assert.equal(expected.status, "cleared");
  for (const fps of [5, 10, 15, 30, 60, 120, 144]) {
    assert.deepEqual(runWithFrames(fps), { status: expected.status, elapsedTicks: expected.elapsedTicks }, String(fps));
  }
});

test("長時間タブが止まっても復帰直後の進行は最大5tick", () => {
  const tickMs = 1000 / GAME.tickRate;
  const first = advanceFrameClock(createFrameClock(), 0, tickMs);
  assert.equal(first.steps, 1);
  const resumed = advanceFrameClock(first.clock, 60 * 60 * 1000, tickMs);
  assert.equal(resumed.steps, 5);
  assert.ok(resumed.clock.accumulatedMs <= tickMs);
  assert.deepEqual(runWithFrames(60, true), runWithFrames(60));
});

test("時刻が巻き戻っても負の進行をしない", () => {
  const step = 1000 / GAME.tickRate;
  const first = advanceFrameClock(createFrameClock(), 100, step);
  const second = advanceFrameClock(first.clock, 90, step);
  assert.equal(second.steps, 0);
  assert.equal(second.clock.accumulatedMs, 0);
  assert.throws(() => advanceFrameClock(first.clock, NaN, step), /invalid/);
});
