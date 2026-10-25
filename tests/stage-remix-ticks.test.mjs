import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";

const read = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));

for (const number of [8, 9, 10]) {
  test("再設計のステージ" + number + "は色・形と得点のルートを毎回同じtickで実行する", () => {
    const stage = read("public/stages/stage-" + number + ".json");
    const checks = read("stage-checks/stage-" + number + ".json");
    const result = checks.cases.map((item) => {
      const parsed = analyzeProgram(item.source);
      if (parsed.diagnostics.length) return { name: item.name, diagnostics: parsed.diagnostics };
      const first = runToCompletion(createGame(stage, parsed.program));
      const second = runToCompletion(createGame(stage, parsed.program));
      assert.deepEqual([first.status, first.elapsedTicks, objectiveProgress(first)], [second.status, second.elapsedTicks, objectiveProgress(second)], item.name);
      return { name: item.name, role: item.role, status: first.status, ticks: first.elapsedTicks, chars: [...item.source.replace(/\s/g, "")].length, failureReason: first.failureReason, progress: objectiveProgress(first) };
    });
    for (const [index, actual] of result.entries()) {
      const expected = checks.cases[index];
      assert.equal(actual.status, expected.expect, expected.name);
      if (expected.expectedTicks !== undefined) assert.equal(actual.ticks, expected.expectedTicks, expected.name);
    }
    assert.equal(result.find(item => item.role === "beginner").progress.completionBp, 10000);
    if (number === 8) assert.equal(result.find(item => item.name === "optional-coin-without-deliberate-skip").progress.completionBp, 4000);
    if (number === 9) assert.equal(result.find(item => item.name === "overall-secret-break").progress.completionBp, 4000);
    if (number === 10) assert.equal(result.find(item => item.name === "skip-optional-bonus-route").progress.completionBp, 1200);
  });
}
