import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, stepGame, runToCompletion } from "../app/game/core.ts";
import { stageMastery } from "../app/stage/mastery.ts";
import { validateStageCases } from "../app/stage/validator.ts";
import { classifyStrategy, getScoreReference } from "../app/scoring/score.ts";

const load = (file) => JSON.parse(readFileSync(new URL("../" + file, import.meta.url), "utf8"));

test("compiler preserves source line indices separately from ranked bytecode", () => {
  const source = "かべとぶ\n\n3かいくりかえす\nおばけしゃがむ\nあなとぶ\nおわり";
  const parsed = analyzeProgram(source);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(parsed.sourceMap.watchers, [1]);
  assert.deepEqual(parsed.sourceMap.steps, [3, 4, 5, 6]);
  assert.deepEqual(parsed.program.watchers[0], { action: "jump", conds: ["wall"], maxFires: undefined });
  assert.deepEqual(parsed.program.steps.map(({ op }) => op), ["repeat-start", "wait", "wait", "repeat-end"]);
});

test("runtime trace fires only accepted actions and records simultaneous events", () => {
  const parsed = analyzeProgram("かべとぶ\nおばけしゃがむ");
  const stage = { goal: 1500, scrollSpeed: 3, objects: [
    { type: "wall", position: 600 }, { type: "ghost", position: 600 },
    { type: "wall", position: 1000 }, { type: "ghost", position: 1000 },
  ] };
  const game = createGame(stage, parsed.program);
  const byTick = new Map();
  while (game.status === "running") {
    stepGame(game, (event) => {
      if (!byTick.has(event.tick)) byTick.set(event.tick, []);
      byTick.get(event.tick).push(parsed.sourceMap.watchers[event.index]);
    });
  }
  assert.equal(game.status, "cleared");
  assert.ok([...byTick.values()].some((lines) => lines.includes(1) && lines.includes(2)));
  assert.ok([...byTick.values()].every((lines) => lines.every((line) => line === 1 || line === 2)));
});

test("loop trace visits correct source lines without changing results", () => {
  const stage = load("public/stages/stage-17.json");
  const source = "3かいくりかえす\nかべとぶ\nおばけしゃがむ\nおわり";
  const parsed = analyzeProgram(source);
  const recorded = [];
  const game = createGame(stage, parsed.program);
  while (game.status === "running") stepGame(game, (event) => recorded.push({
    kind: event.kind, line: parsed.sourceMap.steps[event.index], tick: event.tick,
  }));
  assert.equal(game.status, "cleared");
  assert.deepEqual([1, 2, 3], [1, 2, 3].filter((line) => recorded.some((event) => event.line === line)));
  assert.equal(recorded.filter((event) => event.kind === "step").length, 6);
  assert.equal(recorded.filter((event) => event.kind === "repeat").length, 3);
  const reference = runToCompletion(createGame(stage, parsed.program));
  assert.equal(game.elapsedTicks, reference.elapsedTicks);
});

test("new natural Japanese connectors preserve previous rule semantics", () => {
  const base = analyzeProgram("かべとぶ").rules;
  for (const phrase of [
    "かべがみつかったらじゃんぷしてね",
    "かべがちかづいたらとんでね",
    "かべがあらわれたらとんでください",
    "かべがみえたときじゃんぷする",
    "かべをみつけるたびにとぶ",
    "かべにぶつかりそうならじゃんぷする",
  ]) {
    const parsed = analyzeProgram(phrase);
    assert.deepEqual(parsed.diagnostics, [], phrase);
    assert.deepEqual(parsed.rules, base, phrase);
  }
  const disjunction = analyzeProgram("かべまたはあなをみつけたらとぶ");
  assert.deepEqual(disjunction.diagnostics, []);
  assert.deepEqual(disjunction.program.watchers[0].conds, ["wall", "hole"]);
});

test("repeat and hidden achievements are optional and leave scoring unchanged", () => {
  const repeat = stageMastery("stage-17", "3かいくりかえす\nかべとぶ\nおばけしゃがむ\nおわり");
  assert.equal(repeat.loopChallenge, true);
  assert.equal(repeat.repeatUsed, true);
  assert.equal(repeat.secretFound, false);
  assert.equal(stageMastery("stage-17", "かべとぶ\nおばけしゃがむ").repeatUsed, false);
  assert.equal(stageMastery("stage-12", "かべすごいとぶ").secretFound, true);
  assert.equal(stageMastery("stage-12", "かべとぶ").secretFound, false);
  assert.equal(stageMastery("stage-12", "なぞのことば").secretFound, false);
});

test("stage 18 is a longer two-hole loop puzzle with an isolated ranking version", () => {
  const stage = load("public/stages/stage-18.json");
  const checks = load("stage-checks/stage-18.json");
  const report = validateStageCases("stage-18", stage, checks);
  assert.equal(stage.objects.filter((obstacle) => obstacle.type === "hole").length, 2);
  assert.equal(report.pass, true, JSON.stringify(report.issues));
  const byName = (name) => report.cases.find((entry) => entry.name === name);
  assert.equal(byName("repeat-two-wide-holes")?.outcome, "cleared");
  assert.equal(byName("repeat-once-does-not-cross-second-hole")?.failureReason, "hole");
  assert.ok(getScoreReference("stage-18", "2026-10-20-r1"));
  const newReference = getScoreReference("stage-18", "2026-10-25-r2");
  assert.equal(newReference?.timeTicks, byName("beginner")?.elapsedTicks);
  assert.ok(newReference.timeTicks > 500);
});

test("optimized watcher retains the repeat header line and fire limit", () => {
  const parsed = analyzeProgram("3かいくりかえす\nかべとぶ\nおわり");
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(parsed.sourceMap.watchers, [2]);
  assert.deepEqual(parsed.sourceMap.watcherLoops, [1]);
  assert.equal(parsed.program.watchers[0].maxFires, 3);
});

test("three score strategies remain distinct without touching ranked score results", () => {
  assert.equal(classifyStrategy({ time: 1450, chars: 1080, overall: 1566 }), "speed");
  assert.equal(classifyStrategy({ time: 950, chars: 1800, overall: 1710 }), "compact");
  assert.equal(classifyStrategy({ time: 1040, chars: 1000, overall: 1040 }), "balanced");
  const unchanged = getScoreReference("stage-18", "2026-10-20-r1");
  assert.equal(unchanged?.timeTicks, 252);
  assert.equal(unchanged?.product, 2268);
});
