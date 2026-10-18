import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, stepGame, runToCompletion } from "../app/game/core.ts";

const compile = (source) => {
  const analysis = analyzeProgram(source);
  assert.deepEqual(analysis.diagnostics, [], JSON.stringify(analysis.diagnostics));
  return analysis.program;
};
const stageWith = (sequence, goal = 3000) => ({
  goal,
  scrollSpeed: 3,
  objects: sequence.map(([type, position]) => ({ type, position })),
});

test("standalone conditions continue watching every matching obstacle", () => {
  const run = runToCompletion(createGame(
    stageWith([["wall",600],["wall",1000],["wall",1400]], 1800),
    compile("かべとぶ"),
  ));
  assert.equal(run.status, "cleared");
  assert.equal(run.fired[0].size, 3);
  assert.equal(run.cursor, 0);
});

test("multi-rule repeat waits for distinct matching obstacles in sequence", () => {
  const stage = stageWith([
    ["wall",600],["ghost",1000],["wall",1400],
    ["ghost",1800],["wall",2200],["ghost",2600],
  ]);
  const source = "3かいくりかえす\nかべとぶ\nおばけしゃがむ\nおわり";
  const program = compile(source);
  assert.equal(program.watchers.length, 0);
  assert.deepEqual(program.steps.map((step) => step.op), [
    "repeat-start", "wait", "wait", "repeat-end",
  ]);
  const run = runToCompletion(createGame(stage, program));
  assert.equal(run.status, "cleared");
  assert.equal(run.cursor, program.steps.length);
  assert.equal(run.sequenceConsumed.size, 6);
  assert.deepEqual(run.loops, []);
});

test("same wall cannot satisfy two subsequent waits", () => {
  const program = compile("2かいくりかえす\nかべとぶ\nかべとぶ\nおわり");
  const run = runToCompletion(createGame(stageWith([["wall",600]], 850), program));
  assert.equal(run.status, "cleared");
  assert.equal(run.cursor, 2);
  assert.equal(run.sequenceConsumed.size, 1);
});

test("nested loops preserve the program counter without unrolling", () => {
  const source = "2かいくりかえす\n2かいくりかえす\nかべとぶ\nおわり\nおばけしゃがむ\nおわり";
  const stage = stageWith([
    ["wall",600],["wall",1000],["ghost",1400],
    ["wall",1800],["wall",2200],["ghost",2600],
  ]);
  const program = compile(source);
  assert.equal(program.steps.length, 6);
  const run = runToCompletion(createGame(stage, program));
  assert.equal(run.status, "cleared");
  assert.equal(run.cursor, program.steps.length);
  assert.equal(run.sequenceConsumed.size, 6);
});

test("3かいとぶ waits for each jump to be accepted", () => {
  const program = compile("3かいとぶ");
  assert.deepEqual(program.steps, [{ op: "action", action: "jump", count: 3 }]);
  const run = runToCompletion(createGame({ goal: 1400, scrollSpeed: 3 }, program));
  assert.equal(run.status, "cleared");
  assert.equal(run.cursor, 1);
  assert.equal(run.sequenceProgress, 0);
});

test("top-level if watches continuously alongside a procedure", () => {
  const program = compile("もし かべが あったら\nとぶ\nおわり\nしゃがむ");
  assert.equal(program.watchers.length, 1);
  assert.deepEqual(program.steps, [{ op: "action", action: "crouch", count: 1 }]);
  const run = runToCompletion(createGame(stageWith([["wall",600],["wall",1000]],1300), program));
  assert.equal(run.status, "cleared");
  assert.equal(run.fired[0].size, 2);
  assert.equal(run.cursor, 1);
});

test("if inside repeat waits for one event then executes its body", () => {
  const source = "2かいくりかえす\nもし かべが あったら\nとぶ\nおわり\nおばけしゃがむ\nおわり";
  const program = compile(source);
  const stage = stageWith([["wall",600],["ghost",1000],["wall",1400],["ghost",1800]],2150);
  const run = runToCompletion(createGame(stage, program));
  assert.equal(run.status, "cleared");
  assert.equal(run.cursor, program.steps.length);
});

test("continuous watchers remain active when a sequence blocks", () => {
  const source = "かべとぶ\n2かいくりかえす\nおばけしゃがむ\nあなとぶ\nおわり";
  const program = compile(source);
  const run = runToCompletion(createGame(stageWith([["wall",600],["wall",1000]],1550), program));
  assert.equal(run.status, "cleared");
  assert.equal(run.fired[0].size, 2);
  assert.equal(run.cursor, 1);
});

test("replay resets runtime state and completed games cannot advance", () => {
  const source = "3かいくりかえす\nかべとぶ\nおばけしゃがむ\nおわり";
  const stage = stageWith([["wall",600],["ghost",1000]],1600);
  const first = runToCompletion(createGame(stage, compile(source)));
  assert.equal(first.status, "cleared");
  const snapshot = [first.elapsedTicks, first.cursor, first.sequenceConsumed.size];
  stepGame(first);
  assert.deepEqual([first.elapsedTicks, first.cursor, first.sequenceConsumed.size], snapshot);
  const second = runToCompletion(createGame(stage, compile(source)));
  assert.deepEqual([second.elapsedTicks, second.cursor, second.sequenceConsumed.size], snapshot);
});

test("repeating crouch does not consume all iterations in one tick", () => {
  const program = compile("3かいくりかえす\nしゃがむ\nおわり");
  const state = createGame({ goal: 500 }, program);
  stepGame(state);
  assert.equal(state.cursor, 1);
  assert.equal(state.loops[0].remaining, 2);
  stepGame(state);
  assert.equal(state.cursor, 1);
  assert.equal(state.loops[0].remaining, 1);
  stepGame(state);
  assert.equal(state.cursor, 3);
  assert.equal(state.loops.length, 0);
});
