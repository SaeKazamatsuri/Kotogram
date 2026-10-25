import test from "node:test";
import assert from "node:assert/strict";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { calculateScores, compareRuns, selectBestRuns, SCORING_VERSION, PREVIOUS_SCORING_VERSION } from "../app/scoring/score.ts";
import { validateScope, verifyRunResult } from "../worker/validation.mjs";

const stage = { goal: 700, scrollSpeed: 3, optionalObjectives: true, requiredCoins: 2, requiredSkips: 2,
  objects: [
    { type: "coin", id: "coin1", position: 260 },
    { type: "coin", id: "coin2", position: 400 },
    { type: "switch", id: "trap1", position: 300, targetDoorId: "gate", trap: true },
    { type: "switch", id: "trap2", position: 450, targetDoorId: "gate", trap: true },
    { type: "switch", id: "safe", position: 500, targetDoorId: "gate" },
    { type: "door", id: "gate", position: 590 },
  ],
};
const noDoorStage = { goal: 700, scrollSpeed: 3, optionalObjectives: true, requiredCoins: 2, requiredSkips: 2,
  objects: stage.objects.filter(o => o.type === "coin" || o.trap).map(o => o.type === "switch" ? { ...o, targetDoorId: "none" } : o) };
function play(source, world = noDoorStage) {
  const parsed = analyzeProgram(source);
  assert.deepEqual(parsed.diagnostics, [], source);
  return runToCompletion(createGame(world, parsed.program));
}
test("optional objectives permit clears with none, some or all collected", () => {
  const empty = play("あるく");
  const all = play("こいんとる\nばつのぼたんみおくる");
  assert.equal(empty.status, "cleared");
  assert.equal(all.status, "cleared");
  assert.deepEqual(objectiveProgress(empty), { collected: 0, coinTarget: 2, skipped: 0, skipTarget: 2, completionBp: 1200 });
  assert.deepEqual(objectiveProgress(all), { collected: 2, coinTarget: 2, skipped: 2, skipTarget: 2, completionBp: 10000 });
  assert.equal(objectiveProgress(play("こいんとる")).completionBp, 4000);
});
test("legacy-required objectives still fail; trap and unopened door remain fatal", () => {
  const old = play("あるく", { ...noDoorStage, optionalObjectives: false });
  assert.equal(old.status, "failed");
  assert.equal(old.failureReason, "coin");
  const unsafe = play("あかいぼたんおす", stage);
  assert.equal(unsafe.status, "failed");
  assert.equal(unsafe.failureReason, "trap");
  const closed = play("あるく", stage);
  assert.equal(closed.status, "failed");
  assert.equal(closed.failureReason, "door");
});
test("all 3 scores use same rate and adjusted bests rank progress rather than raw brevity", () => {
  const ref = { stageId: "example", stageVersion: "1", scoringVersion: "2026-v2", timeTicks: 400, characters: 10, product: 4000 };
  const complete = { runId: "complete", source: "かべとぶ", elapsedTicks: 500, charCount: 10, completionBp: 10000 };
  const shortcut = { runId: "shortcut", source: "とぶ", elapsedTicks: 100, charCount: 2, completionBp: 1200 };
  const scores = calculateScores(ref, shortcut);
  assert.equal(scores.time, 480);
  assert.equal(scores.chars, 600);
  assert.equal(scores.overall, 2400);
  assert.ok(compareRuns("time", complete, shortcut) < 0);
  assert.equal(selectBestRuns([complete, shortcut]).time?.runId, "complete");
  assert.equal(selectBestRuns([complete, shortcut]).chars?.runId, "complete");
  const reference = { ...shortcut, completionBp: 10000 };
  assert.ok(calculateScores(ref, reference).overall > scores.overall);
});
test("score scopes remain separated and archived v1 rankings readable", () => {
  assert.equal(SCORING_VERSION, "2026-v2");
  assert.equal(PREVIOUS_SCORING_VERSION, "2026-v1");
  const scope = { seasonId: "2026-festival", stageId: "stage-8", stageVersion: "2026-10-20-r2", engineVersion: "2026-core-v2", languageVersion: "2026-language-v4", scoringVersion: "2026-v1" };
  assert.deepEqual(validateScope(scope), scope);
});

test("Worker rejects forged completion rates and recomputes progress from the source", () => {
  const run = { stageId: "stage-1", source: "かべとぶ", elapsedTicks: 712, completionBp: 10000 };
  assert.equal(verifyRunResult(run), 712);
  assert.throws(() => verifyRunResult({ ...run, completionBp: 1200 }), /objective progress/);
});
