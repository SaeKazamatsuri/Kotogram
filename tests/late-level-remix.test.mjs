import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { getScoreReference } from "../app/scoring/score.ts";

const read = path => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));

for (const n of [22, 28]) {
  test("later world " + n + " remixed condition/choice routes remain deterministic", () => {
    const stage = read("public/stages/stage-" + n + ".json");
    const checks = read("stage-checks/stage-" + n + ".json");
    const report = [];
    for (const item of checks.cases) {
      const parsed = analyzeProgram(item.source);
      assert.deepEqual(parsed.diagnostics, [], item.name);
      const game = runToCompletion(createGame(stage, parsed.program));
      const again = runToCompletion(createGame(stage, parsed.program));
      assert.deepEqual([game.status, game.failureReason, game.elapsedTicks, objectiveProgress(game)],
        [again.status, again.failureReason, again.elapsedTicks, objectiveProgress(again)], item.name);
      report.push({ name: item.name, role: item.role, status: game.status, reason: game.failureReason,
        ticks: game.elapsedTicks, chars: [...item.source.replace(/\\s/g,"")].length, bp: objectiveProgress(game).completionBp,
        opened: game.doors.filter(d => d.open).length, broken: game.doors.filter(d => d.broken).length });
    }
    for (const [index, actual] of report.entries()) {
      const expected = checks.cases[index];
      assert.equal(actual.status, expected.expect, expected.name);
      if (expected.expectedTicks !== undefined) assert.equal(actual.ticks, expected.expectedTicks, expected.name);
      if (expected.failureReason !== undefined) assert.equal(actual.reason, expected.failureReason, expected.name);
    }
    assert.equal(report.find(item => item.role === "beginner").bp, 10000);
    assert.equal(report.find(item => item.role === "overall").bp, 10000);
    if (n === 22) {
      assert.equal(report.find(item => item.name === "optional-last-gate-route").bp, 6133);
      assert.equal(report.find(item => item.name === "optional-last-gate-route").broken, 1);
      assert.equal(report.find(item => item.name === "color-shape-selectors").bp, 10000);
    }
    if (n === 28) {
      assert.equal(report.find(item => item.name === "fragile-floor-required").reason, "hole");
      assert.equal(report.find(item => item.name === "alternative-last-gate").broken, 1);
      assert.equal(report.find(item => item.name === "alternative-last-gate").bp, 7013);
    }
    assert.ok(getScoreReference(stage.id, "2026-10-25-r2"));
  });
}
