import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateScores, compareRuns, countSourceCharacters, getScoreReference,
  rankRuns, rankingScopeKey, selectBestRuns,
} from "../app/scoring/score.ts";

const ref = { stageId: "test", stageVersion: "v1", scoringVersion: "v1", timeTicks: 100, characters: 4, product: 450 };
const run = (runId, elapsedTicks, charCount) => ({ runId, elapsedTicks, charCount, source: "かべとぶ" });

test("uses independent P_ref and permits scores above 1000", () => {
  const result = calculateScores(ref, run("a", 90, 4));
  assert.equal(result.time, 1000 * 100 / 90);
  assert.equal(result.chars, 1000);
  assert.equal(result.overall, 1250);
  assert.notEqual(result.overall, 1000 * (100 * 4) / (90 * 4));
  assert.throws(() => calculateScores(ref, run("x", 0, 4)), RangeError);
  assert.throws(() => calculateScores(ref, run("x", 100, 0)), RangeError);
  assert.throws(() => calculateScores(ref, run("x", 2 ** 53, 1)), RangeError);
});

test("characters share parser normalization and discard whitespace", () => {
  assert.equal(countSourceCharacters(" かべとぶ\n あなとぶ\t"), 8);
  assert.equal(countSourceCharacters("かべ３かいとぶ"), countSourceCharacters("かべ3かいとぶ"));
  assert.equal(countSourceCharacters("か\u3099"), 1);
  assert.equal(countSourceCharacters("かべとぶ\r\n"), 4);
});

test("independent bests can originate in three different runs", () => {
  const fastest = run("fast", 80, 20);
  const shortest = run("short", 200, 3);
  const balanced = run("balanced", 100, 4);
  assert.deepEqual(selectBestRuns([shortest, fastest, balanced]), {
    time: fastest, chars: shortest, overall: balanced,
  });
});

test("raw ticks, characters, and product define ranking instead of rounded displayed points", () => {
  const data = [run("b", 1001, 4), run("a", 1000, 4), run("c", 1000, 5)];
  assert.deepEqual(rankRuns("time", data).map(({rank, run}) => [rank, run.runId]), [[1, "a"], [2, "c"], [3, "b"]]);
  assert.deepEqual(rankRuns("chars", data).map(({rank, run}) => [rank, run.runId]), [[1, "a"], [2, "b"], [3, "c"]]);
  assert.ok(compareRuns("overall", data[0], data[2]) < 0);
});

test("complete ties share the same competition rank and sort stably", () => {
  assert.deepEqual(rankRuns("time", [run("z", 100, 4), run("a", 100, 4), run("b", 101, 4)])
    .map(({ rank, run }) => [rank, run.runId]), [[1, "a"], [1, "z"], [3, "b"]]);
});

test("reference is bound to stage version, not silently reused", () => {
  assert.equal(getScoreReference("stage-1", "2025-10-26")?.product, 2848);
  assert.equal(getScoreReference("stage-1", "other"), null);
  assert.equal(getScoreReference("missing", "2025-10-26"), null);
});

test("different rule or engine versions cannot share ranking scope keys", () => {
  const scope = {
    seasonId: "2026", stageId: "stage-1", stageVersion: "v1",
    engineVersion: "e1", languageVersion: "l1", scoringVersion: "s1",
  };
  assert.notEqual(rankingScopeKey(scope), rankingScopeKey({ ...scope, engineVersion: "e2" }));
  assert.notEqual(rankingScopeKey(scope), rankingScopeKey({ ...scope, scoringVersion: "s2" }));
});
