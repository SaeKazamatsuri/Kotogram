import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProgram, tokenizeLine, normalizeLine } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";

function valid(source, vocabulary) {
  const parsed = analyzeProgram(source, vocabulary);
  assert.deepEqual(parsed.diagnostics, [], JSON.stringify(parsed.diagnostics));
  return parsed;
}

test("short and detailed conditional commands are equivalent", () => {
  const short = valid("かべとぶ");
  assert.deepEqual(short.rules[0].conds, ["wall"]);
  for (const phrase of ["かべならとぶ", "まえにかべならじゃんぷ", "まえにかべがあったらとぶ"]) {
    assert.deepEqual(valid(phrase).rules, short.rules);
  }
  assert.deepEqual(valid("もし まえに かべが あったら\nとぶ\nおわり").rules, short.rules);
});

test("OR conditions tokenize and execute as a single rule", () => {
  const parsed = valid("かべとあなとぶ");
  assert.equal(parsed.body[0].kind, "rule");
  assert.deepEqual(parsed.body[0].conditions, ["wall", "hole"]);
  assert.deepEqual(parsed.rules[0].conds, ["wall", "hole"]);
  assert.deepEqual(tokenizeLine("かべとあなとぶ", 1).map(t => t.kind), ["condition", "or", "condition", "action"]);
  const stage = { goal: 1800, scrollSpeed: 3, objects: [
    { type: "wall", position: 600 },
    { type: "hole", position: 1000, width: 80 },
    { type: "wall", position: 1400 }
  ]};
  const game = runToCompletion(createGame(stage, parsed.rules));
  assert.equal(game.status, "cleared");
  assert.equal(game.fired[0].size, 3);
});

test("ahead and unconditioned commands retain distinct meanings", () => {
  assert.deepEqual(valid("まえとぶ").rules[0].conds, ["ahead"]);
  assert.deepEqual(valid("まえにあながあったらとぶ").rules[0].conds, ["hole"]);
  assert.deepEqual(valid("とぶ").rules, [{ action: "jump" }]);
});

test("limited repeated conditions stop after their successful count", () => {
  const parsed = valid("かべとあな３かいとぶ");
  assert.equal(parsed.body[0].maxFires, 3);
  assert.equal(parsed.rules[0].maxFires, 3);
  const stage = { goal: 1600, scrollSpeed: 3, objects: [600, 1000, 1400].map(position => ({ type: "wall", position })) };
  const twice = runToCompletion(createGame(stage, valid("かべ2かいとぶ").rules));
  assert.equal(twice.status, "failed");
  assert.equal(twice.failureReason, "wall");
  assert.equal(twice.fired[0].size, 2);
  assert.equal(runToCompletion(createGame(stage, valid("かべ3かいとぶ").rules)).status, "cleared");
});

test("one rule repeat block becomes a bounded conditional rule", () => {
  const parsed = valid("3かいくりかえす\nかべとぶ\nおわり");
  assert.equal(parsed.body[0].kind, "repeat");
  assert.equal(parsed.body[0].repeat, 3);
  assert.deepEqual(parsed.rules, [{ action: "jump", conds: ["wall"], maxFires: 3 }]);
});

test("invalid expressions produce diagnostics and never partial output", () => {
  const invalid = [
    "かべ", "かべあなとぶ", "かべとあなと", "ほげとぶ",
    "かべ0かいとぶ", "かべ99999かいとぶ", "おわり",
    "3かいくりかえす\nかべとぶ", "かべとぶ\nわからない"
  ];
  for (const source of invalid) {
    const parsed = analyzeProgram(source);
    assert.ok(parsed.diagnostics.length > 0, source);
    assert.deepEqual(parsed.rules, [], source);
    assert.ok(parsed.diagnostics.every(d => d.line >= 1 && d.column >= 1));
  }
});

test("procedural repetition and multi-command loops compile into bytecode", () => {
  const repeated = analyzeProgram("3かいとぶ");
  assert.deepEqual(repeated.diagnostics, []);
  assert.equal(repeated.body[0].kind, "action");
  assert.deepEqual(repeated.program.steps, [
    { op: "action", action: "jump", count: 3 }
  ]);

  const multi = analyzeProgram("3かいくりかえす\nかべとぶ\nあなとぶ\nおわり");
  assert.deepEqual(multi.diagnostics, []);
  assert.equal(multi.body[0].kind, "repeat");
  assert.deepEqual(multi.program.steps.map((s) => s.op), [
    "repeat-start", "wait", "wait", "repeat-end"
  ]);
});


test("whitespace, tab and digits normalize without indentation semantics", () => {
  assert.equal(normalizeLine(" かべ\tとぶ　"), "かべとぶ");
  assert.equal(normalizeLine("かべ３かいとぶ"), "かべ3かいとぶ");
  assert.deepEqual(valid("　かべ　とぶ　").rules, valid("かべとぶ").rules);
  assert.deepEqual(valid("かべ\tとぶ").rules, valid("かべとぶ").rules);
  assert.equal(analyzeProgram("カベとぶ").diagnostics[0].code, "unknown");
});

test("vocabulary extensions work without substring guessing", () => {
  const dict = { conditions: { wall: ["うぉーる"] }, actions: { jump: ["はねる"] } };
  const parsed = valid("うぉーるはねる", dict);
  assert.deepEqual(parsed.rules[0].conds, ["wall"]);
  assert.equal(parsed.rules[0].action, "jump");
  assert.equal(tokenizeLine("とぶ", 1, dict)[0].kind, "action");
});

test("source and repetition caps reject pathological input", () => {
  assert.equal(analyzeProgram("あ".repeat(2100)).diagnostics[0].code, "limit");
  assert.equal(analyzeProgram("かべとぶ\n".repeat(120)).diagnostics[0].code, "limit");
  assert.equal(analyzeProgram("999999999999999999999かいとぶ").diagnostics[0].code, "count");
});
