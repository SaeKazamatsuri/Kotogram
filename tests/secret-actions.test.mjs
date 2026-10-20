import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProgram } from "../app/language/parser.ts";
import { GAME, createGame, runToCompletion, stepGame } from "../app/game/core.ts";
import { worldMapPosition } from "../app/stage/world-map.ts";

const parse = (source) => {
  const result = analyzeProgram(source);
  assert.deepEqual(result.diagnostics, []);
  return result.program;
};

test("secret command words parse as single actions", () => {
  assert.equal(parse("すごいじゃんぷ").steps[0].action, "powerJump");
  assert.equal(parse("めっちゃはしる").steps[0].action, "sprint");
  assert.equal(parse("かべすごいじゃんぷ").watchers[0].action, "powerJump");
  assert.equal(parse("すいっちじゃんぷ").watchers[0].action, "jump");
});

test("one powered jump can leap two close walls while one normal jump cannot", () => {
  const stage = { goal: 1050, scrollSpeed: 3, objects: [
    { type: "wall", position: 450 }, { type: "wall", position: 570 },
  ] };
  const normal = runToCompletion(createGame(stage, parse("かべ1かいじゃんぷ")));
  const powered = runToCompletion(createGame(stage, parse("かべ1かいすごいじゃんぷ")));
  assert.equal(normal.status, "failed");
  assert.equal(normal.failureReason, "wall");
  assert.equal(powered.status, "cleared");
});

test("sprint is faster but walking resets speed, and neither mutates default speed", () => {
  const fast = createGame({ goal: 800, scrollSpeed: 3 }, parse("めっちゃはしる"));
  stepGame(fast);
  assert.equal(fast.vx, 3 * GAME.sprintMultiplier);
  const restored = createGame({ goal: 800, scrollSpeed: 3 }, parse("めっちゃはしる\nあるく"));
  stepGame(restored);
  assert.equal(restored.vx, 3);
  assert.equal(GAME.runMultiplier, 1.3);
});

test("an airborne switch crossing counts as a deliberate skip, but simply walking past does not", () => {
  const stage = { goal: 1050, scrollSpeed: 3, requiredSkips: 1, objects: [
    { type: "switch", id: "trap", position: 350, targetDoorId: "door", trap: true },
    { type: "switch", id: "safe", position: 580, targetDoorId: "door" },
    { type: "door", id: "door", position: 780 },
  ] };
  const manual = runToCompletion(createGame(stage, parse("1かいくりかえす\nすいっちみおくる\nすいっちおす\nおわり")));
  const airborne = runToCompletion(createGame(stage, parse("1かいくりかえす\nすいっちじゃんぷ\nすいっちおす\nおわり")));
  const accidental = runToCompletion(createGame(stage, parse("すいっちおす")));
  assert.equal(manual.status, "cleared");
  assert.equal(airborne.status, "cleared");
  assert.equal(airborne.switches[0].skipped, true);
  assert.equal(accidental.status, "failed");
  assert.equal(accidental.failureReason, "trap");
});

test("a thirty-stop map is traversable on both orientations", () => {
  const positions = Array.from({ length: 30 }, (_, index) => worldMapPosition(index, 30));
  assert.equal(new Set(positions.map((point) => point.x)).size, 30);
  assert.ok(positions.every((point, index) => index === 0 || point.mobileY > positions[index - 1].mobileY));
  assert.ok(positions.every((point) => point.x > 0 && point.x < 100 && point.mobileY > 0 && point.mobileY < 100));
});
