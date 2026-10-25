import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { countSourceCharacters } from "../app/scoring/score.ts";

const read = p => JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));

test("Final stage combines all five movement/bonus mechanisms without nondeterminism", () => {
  const stage = read("public/stages/stage-30.json");
  const cases = read("stage-checks/stage-30.json").cases;
  const results = cases.map(c => {
    const parsed = analyzeProgram(c.source);
    assert.deepEqual(parsed.diagnostics, [], c.name);
    const first = runToCompletion(createGame(stage, parsed.program));
    const second = runToCompletion(createGame(stage, parsed.program));
    assert.deepEqual([first.status, first.failureReason, first.elapsedTicks, objectiveProgress(first)],
      [second.status, second.failureReason, second.elapsedTicks, objectiveProgress(second)], c.name);
    return { name: c.name, role: c.role, status: first.status, reason: first.failureReason,
      ticks: first.elapsedTicks, chars: countSourceCharacters(c.source), bp: objectiveProgress(first).completionBp,
      broken: first.doors.filter(x => x.broken).length };
  });
  for (const [i, result] of results.entries()) {
    assert.equal(result.status, cases[i].expect, result.name);
    if (cases[i].expectedTicks !== undefined) assert.equal(result.ticks, cases[i].expectedTicks, result.name);
    if (cases[i].failureReason !== undefined) assert.equal(result.reason, cases[i].failureReason, result.name);
  }
  assert.equal(results.find(x => x.role === "beginner").bp, 10000);
  assert.equal(results.find(x => x.name === "broken-floor-cannot-be-ignored").reason, "hole");
  assert.equal(results.find(x => x.name === "bonus-coins-optional").bp, 3000);
  assert.equal(results.find(x => x.name === "hidden-last-gate-shortcut").bp, 6133);
  assert.equal(results.find(x => x.name === "hidden-last-gate-shortcut").broken, 1);
});
