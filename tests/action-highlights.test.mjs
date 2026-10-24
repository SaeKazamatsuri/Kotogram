import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProgram } from "../app/language/parser.ts";
import { GAME, createGame, runToCompletion, stepGame } from "../app/game/core.ts";
import { createActionHighlights } from "../app/game/action-highlights.ts";

const parse = (source) => {
  const compiled = analyzeProgram(source);
  assert.deepEqual(compiled.diagnostics, []);
  return compiled;
};
const stage = { goal: 1700, scrollSpeed: 3, objects: [
  { type: "wall", position: 600 },
] };

test("run flashes on activation, then remains dim until another speed command", () => {
  const parsed = parse("はしる\nかべとぶ");
  const game = createGame(stage, parsed.program);
  const highlights = createActionHighlights();
  stepGame(game, (event) => highlights.record(event, parsed.sourceMap));
  assert.deepEqual(highlights.snapshot(game).active, [1]);
  assert.deepEqual(highlights.snapshot(game).sustained, [{ line: 1, action: "run" }]);
  for (let tick = 0; tick < 35; tick++) stepGame(game, (event) => highlights.record(event, parsed.sourceMap));
  assert.equal(game.status, "running");
  assert.ok(!highlights.snapshot(game).active.includes(1));
  assert.deepEqual(highlights.snapshot(game).sustained, [{ line: 1, action: "run" }]);
  highlights.reset();
  assert.deepEqual(highlights.snapshot(game), { active: [], sustained: [] });
});

test("walk supersedes the old running line while a jump only flashes", () => {
  const parsed = parse("はしる\nかべあるく\nかべとぶ");
  const game = createGame(stage, parsed.program);
  const highlights = createActionHighlights();
  let walkHappened = false;
  for (let i = 0; i < 200 && game.status === "running"; i++) {
    stepGame(game, (event) => {
      highlights.record(event, parsed.sourceMap);
      if (event.action === "walk") walkHappened = true;
    });
    if (walkHappened) break;
  }
  assert.equal(walkHappened, true);
  assert.equal(game.vx, game.baseSpeed);
  assert.deepEqual(highlights.snapshot(game).sustained, [{ line: 2, action: "walk" }]);
  assert.ok(highlights.snapshot(game).active.includes(2));
  let jumped = highlights.snapshot(game).active.includes(3);
  for (let i = 0; i < 35 && game.status === "running"; i++) {
    stepGame(game, (event) => {
      highlights.record(event, parsed.sourceMap);
      if (event.action === "jump") jumped = true;
    });
  }
  assert.equal(jumped, true);
  assert.ok(!highlights.snapshot(game).sustained.some((item) => item.line === 1));
  assert.ok(!highlights.snapshot(game).sustained.some((item) => item.line === 3));
});

test("sprint keeps its distinct origin even after the pulse disappears", () => {
  const parsed = parse("めっちゃはしる\nかべとぶ");
  const game = createGame(stage, parsed.program);
  const highlights = createActionHighlights();
  stepGame(game, (event) => highlights.record(event, parsed.sourceMap));
  for (let i = 0; i < 33; i++) stepGame(game, (event) => highlights.record(event, parsed.sourceMap));
  assert.deepEqual(highlights.snapshot(game).sustained, [{ line: 1, action: "sprint" }]);
  assert.equal(highlights.snapshot(game).active.includes(1), false);
  assert.equal(game.vx, game.baseSpeed * GAME.sprintMultiplier);
});

test("crouch changes to dim before the effect expires, then goes dark", () => {
  const parsed = parse("しゃがむ");
  const game = createGame({ goal: 1200, scrollSpeed: 3 }, parsed.program);
  const highlights = createActionHighlights();
  stepGame(game, (event) => highlights.record(event, parsed.sourceMap));
  assert.deepEqual(highlights.snapshot(game).active, [1]);
  assert.deepEqual(highlights.snapshot(game).sustained, [{ line: 1, action: "crouch" }]);
  for (let i = 0; i < 13; i++) stepGame(game, (event) => highlights.record(event, parsed.sourceMap));
  assert.equal(highlights.snapshot(game).active.includes(1), false);
  assert.deepEqual(highlights.snapshot(game).sustained, [{ line: 1, action: "crouch" }]);
  for (let i = 0; i < 25; i++) stepGame(game, (event) => highlights.record(event, parsed.sourceMap));
  assert.deepEqual(highlights.snapshot(game).sustained, []);
});

test("watching a condition without accepting an action never illuminates it", () => {
  const parsed = parse("かべとぶ");
  const game = createGame({ goal: 1800, scrollSpeed: 3, objects: [{ type: "wall", position: 1200 }] }, parsed.program);
  const highlights = createActionHighlights();
  for (let i = 0; i < 12; i++) stepGame(game, (event) => highlights.record(event, parsed.sourceMap));
  assert.deepEqual(highlights.snapshot(game), { active: [], sustained: [] });
});

test("observing action highlights leaves deterministic game and score ticks unchanged", () => {
  const parsed = parse("はしる\nかべとぶ");
  const baseline = runToCompletion(createGame(stage, parsed.program));
  const game = createGame(stage, parsed.program);
  const highlights = createActionHighlights();
  while (game.status === "running") {
    stepGame(game, (event) => highlights.record(event, parsed.sourceMap));
    highlights.snapshot(game);
  }
  assert.equal(game.status, baseline.status);
  assert.equal(game.elapsedTicks, baseline.elapsedTicks);
  assert.equal(game.px, baseline.px);
  assert.equal(game.py, baseline.py);
});
