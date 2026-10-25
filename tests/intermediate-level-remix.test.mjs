import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { countSourceCharacters } from "../app/scoring/score.ts";

const read = p => JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
for (const n of [11, 15]) {
  test("Intermediate level " + n + " has distinct deterministic floor and score routes", () => {
    const stage = read("public/stages/stage-" + n + ".json");
    const cases = read("stage-checks/stage-" + n + ".json").cases;
    const summary = cases.map(c => {
      const parsed = analyzeProgram(c.source);
      assert.deepEqual(parsed.diagnostics, [], c.name);
      const game = runToCompletion(createGame(stage, parsed.program));
      const repeat = runToCompletion(createGame(stage, parsed.program));
      assert.deepEqual([game.status, game.failureReason, game.elapsedTicks, objectiveProgress(game)],
        [repeat.status, repeat.failureReason, repeat.elapsedTicks, objectiveProgress(repeat)]);
      return { name: c.name, role: c.role, state: game.status, failure: game.failureReason,
        ticks: game.elapsedTicks, chars: countSourceCharacters(c.source), bp: objectiveProgress(game).completionBp };
    });
    for (const [index, outcome] of summary.entries()) {
      const expected = cases[index];
      assert.equal(outcome.state, expected.expect, expected.name);
      if (expected.expectedTicks !== undefined) assert.equal(outcome.ticks, expected.expectedTicks, expected.name);
      if (expected.failureReason !== undefined) assert.equal(outcome.failure, expected.failureReason, expected.name);
    }
    assert.equal(summary.find(x => x.role === "beginner").bp, 10000);
    if (n === 11) assert.equal(summary.find(x => x.name === "first-fragile-floor-requires-reaction").failure, "hole");
    if (n === 15) assert.equal(summary.find(x => x.name === "optional-coins-low-score").bp, 3000);
  });
}
