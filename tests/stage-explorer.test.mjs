import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { candidatePrograms, exploreStage } from "../app/stage/explorer.ts";

const stage = JSON.parse(readFileSync(new URL("../public/stages/stage-1.json", import.meta.url), "utf8"));

test("bounded search finds separate time, character and combined best references", () => {
  const result = exploreStage(stage);
  assert.equal(result.truncated, false);
  assert.ok(result.cleared > 0);
  assert.equal(result.best.time?.elapsedTicks, 548);
  assert.equal(result.best.chars?.charCount, 4);
  assert.ok(result.best.overall?.product > 0);
  assert.deepEqual(result.best, exploreStage(stage).best);
});

test("candidate limits and invalid parameter guard against runaway searches", () => {
  assert.equal(new Set(candidatePrograms()).size, candidatePrograms().length);
  const bounded = exploreStage(stage, { maxCandidates: 1, maxTicks: 100 });
  assert.equal(bounded.checked, 1);
  assert.equal(bounded.truncated, true);
  assert.throws(() => exploreStage(stage, { maxCandidates: 0 }), RangeError);
  assert.throws(() => exploreStage(stage, { maxTicks: 100001 }), RangeError);
  assert.throws(() => exploreStage(stage, { maxCharacters: 2001 }), RangeError);
  assert.throws(() => exploreStage(stage, { maxMs: 0 }), RangeError);
});

test("CLI produces machine-readable reports for a selected stage", () => {
  const output = execFileSync(process.execPath, ["--experimental-strip-types", "scripts/explore-stages.mjs", "--json", "--stage=stage-4", "--max-candidates=32"], { encoding: "utf8" });
  const result = JSON.parse(output);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].stageId, "stage-4");
  assert.equal(result.reports[0].best.time.elapsedTicks, 620);
});

test("bounded explorer proposes a valid collection route for stage 6", () => {
  const coins = JSON.parse(readFileSync(new URL("../public/stages/stage-6.json", import.meta.url), "utf8"));
  const result = exploreStage(coins, { maxCandidates: 32 });
  assert.ok(result.cleared > 0);
  assert.ok(result.best.time?.elapsedTicks <= 512);
  assert.match(result.best.time?.source ?? "", /こいんとる/);
});
