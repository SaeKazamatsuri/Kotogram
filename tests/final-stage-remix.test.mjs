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
  console.log("FINAL_STAGE_REPORT " + JSON.stringify(results));
});
