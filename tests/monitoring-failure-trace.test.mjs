import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, stepGame } from "../app/game/core.ts";
import { createActionHighlights, monitoredSourceLines } from "../app/game/action-highlights.ts";

const compile = (source) => {
  const result = analyzeProgram(source);
  assert.deepEqual(result.diagnostics, []);
  return result;
};

test("every live conditional watcher is shown before it fires; unconditional commands are not", () => {
  const parsed = compile("はしる\nかべとぶ\nあなとぶ");
  const game = createGame({ goal: 1400, scrollSpeed: 3, objects: [{ type: "wall", position: 600 }] }, parsed.program);
  assert.deepEqual(monitoredSourceLines(game, parsed.sourceMap), [2, 3]);
  assert.deepEqual(monitoredSourceLines(game), []);
  for (let tick = 0; tick < 5; tick++) stepGame(game);
  assert.deepEqual(monitoredSourceLines(game, parsed.sourceMap), [2, 3]);
});

test("finished count-limited watchers are no longer marked as monitoring", () => {
  const parsed = compile("かべ1かいとぶ\nあなとぶ");
  const stage = { goal: 1600, scrollSpeed: 3, objects: [
    { type: "wall", position: 590 },
    { type: "hole", position: 1200, width: 80 },
  ] };
  const game = createGame(stage, parsed.program);
  assert.deepEqual(monitoredSourceLines(game, parsed.sourceMap), [1, 2]);
  for (let tick = 0; tick < 250 && game.fired[0]?.size === 0 && game.status === "running"; tick++) stepGame(game);
  assert.equal(game.status, "running");
  assert.equal(game.fired[0]?.size, 1);
  assert.deepEqual(monitoredSourceLines(game, parsed.sourceMap), [2]);
});

test("a もし conditional monitors its header while execution flashes its action line", () => {
  const parsed = compile("もしかべがあったら\nじゃんぷ\nおわり");
  const game = createGame({ goal: 1000, scrollSpeed: 3, objects: [{ type: "wall", position: 600 }] }, parsed.program);
  assert.deepEqual(parsed.sourceMap.watchers, [2]);
  assert.deepEqual(parsed.sourceMap.watcherConditions, [1]);
  assert.deepEqual(monitoredSourceLines(game, parsed.sourceMap), [1]);
  const highlights = createActionHighlights();
  while (game.status === "running" && highlights.lastActionLine() === null) {
    stepGame(game, (event) => highlights.record(event, parsed.sourceMap));
  }
  assert.equal(highlights.lastActionLine(), 2);
  assert.ok(monitoredSourceLines(game, parsed.sourceMap).includes(1));
});

test("a failure remembers only the last accepted instruction, even after the flash expires", () => {
  const parsed = compile("はしる");
  const stage = { goal: 1200, scrollSpeed: 3, objects: [{ type: "wall", position: 590 }] };
  const game = createGame(stage, parsed.program);
  const highlights = createActionHighlights();
  while (game.status === "running") {
    stepGame(game, (event) => highlights.record(event, parsed.sourceMap));
    highlights.snapshot(game);
  }
  assert.equal(game.status, "failed");
  assert.deepEqual(highlights.snapshot(game).active, []);
  assert.deepEqual(monitoredSourceLines(game, parsed.sourceMap), []);
  assert.equal(highlights.lastActionLine(), 1);
  const frozenLine = highlights.lastActionLine();
  highlights.reset();
  assert.equal(highlights.lastActionLine(), null);
  assert.equal(frozenLine, 1);
});

test("no command accepted before failure means no misleading last-action highlight", () => {
  const parsed = compile("かべとぶ");
  const stage = { goal: 900, scrollSpeed: 3, objects: [{ type: "hole", position: 500, width: 80 }] };
  const game = createGame(stage, parsed.program);
  const highlights = createActionHighlights();
  while (game.status === "running") {
    stepGame(game, (event) => highlights.record(event, parsed.sourceMap));
  }
  assert.equal(game.status, "failed");
  assert.equal(highlights.lastActionLine(), null);
});

test("monitoring and last-action observation do not change simulation outcomes", () => {
  const parsed = compile("はしる\nかべとぶ\nあなとぶ");
  const stage = { goal: 1450, scrollSpeed: 3, objects: [
    { type: "wall", position: 600 },
    { type: "hole", position: 1050, width: 80 },
  ] };
  const baseline = createGame(stage, parsed.program);
  const observed = createGame(stage, parsed.program);
  const highlights = createActionHighlights();
  while (baseline.status === "running") stepGame(baseline);
  while (observed.status === "running") {
    stepGame(observed, (event) => highlights.record(event, parsed.sourceMap));
    highlights.snapshot(observed);
    monitoredSourceLines(observed, parsed.sourceMap);
    highlights.lastActionLine();
  }
  assert.deepEqual([observed.status, observed.elapsedTicks, observed.px, observed.py],
    [baseline.status, baseline.elapsedTicks, baseline.px, baseline.py]);
});
