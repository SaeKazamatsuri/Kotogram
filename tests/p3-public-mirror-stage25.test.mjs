import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { validateStage, validateStageCases } from "../app/stage/validator.ts";
import { countSourceCharacters, getScoreReference, ENGINE_VERSION, LANGUAGE_VERSION, SCORING_VERSION, SEASON_ID } from "../app/scoring/score.ts";
import { validateScope, validateRunPayload, verifyRunResult } from "../worker/validation.mjs";

const read = path => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const stage = read("public/stages/stage-25.json");
const manifest = read("public/stages/manifest.json");
const checks = read("stage-checks/stage-25.json");
const scope = { seasonId: SEASON_ID, stageId: "stage-25", stageVersion: "2026-10-26-r1", engineVersion: ENGINE_VERSION, languageVersion: LANGUAGE_VERSION, scoringVersion: SCORING_VERSION };
const source = name => checks.cases.find(item => item.name === name).source;
const play = text => {
  const parsed = analyzeProgram(text);
  assert.deepEqual(parsed.diagnostics, [], text);
  return runToCompletion(createGame(stage, parsed.program), 20000);
};

test("public mirror route and established stage25 strategies remain valid", () => {
  assert.deepEqual(validateStage("stage-25", stage, true), []);
  const report = validateStageCases("stage-25", stage, checks);
  assert.equal(report.pass, true, JSON.stringify(report));
  assert.equal(manifest.stages.find(x => x.id === "stage-25").version, scope.stageVersion);
  assert.equal(stage.objects.filter(x => x.type === "mirror").length, 2);
  assert.equal(stage.requiredCoins, 3);

  const directSource = source("mirror-declined-sprint");
  const mirrorSource = source("mirror-return-full-sprint");
  const direct = play(directSource);
  const returnRoute = play(mirrorSource);
  assert.equal(direct.status, "cleared");
  assert.equal(returnRoute.status, "cleared");
  assert.equal(direct.mirrors.every(x => !x.used), true);
  assert.equal(returnRoute.mirrors.every(x => x.used), true);
  assert.equal(direct.coins.find(x => x.id === "return-coin").collected, false);
  assert.equal(returnRoute.coins.find(x => x.id === "return-coin").collected, true);
  assert.equal(objectiveProgress(direct).completionBp, 7666);
  assert.equal(objectiveProgress(returnRoute).completionBp, 10000);
  assert.ok(direct.elapsedTicks < returnRoute.elapsedTicks);
  assert.ok(countSourceCharacters(directSource) < countSourceCharacters(mirrorSource));

  for (const [code, game] of [[directSource, direct], [mirrorSource, returnRoute]]) {
    const valid = { ...scope, runId: "00000000-0000-4000-8000-000000000001", playerId: "00000000-0000-4000-8000-000000000002", source: code, elapsedTicks: game.elapsedTicks, charCount: countSourceCharacters(code), completionBp: objectiveProgress(game).completionBp };
    assert.equal(validateRunPayload(valid).stageVersion, scope.stageVersion);
    assert.equal(verifyRunResult(valid), game.elapsedTicks);
    assert.throws(() => verifyRunResult({ ...valid, completionBp: game === direct ? 10000 : 7666 }), /objective progress/);
    assert.throws(() => verifyRunResult({ ...valid, elapsedTicks: game.elapsedTicks - 1 }), /clear time/);
  }
});

test("previous stage25 leaderboard stays readable but cannot receive new runs", () => {
  assert.equal(getScoreReference("stage-25", "2026-10-25-r3").product, 25220);
  assert.equal(getScoreReference("stage-25", "2026-10-26-r1").product, 25220);
  assert.equal(validateScope({ ...scope, stageVersion: "2026-10-25-r3" }).stageVersion, "2026-10-25-r3");
  const code = source("mirror-return-full-sprint");
  const game = play(code);
  const payload = { ...scope, stageVersion: "2026-10-25-r3", runId: "00000000-0000-4000-8000-000000000001", playerId: "00000000-0000-4000-8000-000000000002", source: code, elapsedTicks: game.elapsedTicks, charCount: countSourceCharacters(code), completionBp: objectiveProgress(game).completionBp };
  assert.throws(() => validateRunPayload(payload), /read-only/);
});

test("published stage25 reflection is deterministic on repeated replay", () => {
  const code = source("mirror-return-full-sprint");
  const first = play(code);
  const expected = [first.status, first.elapsedTicks, first.coins.map(x => x.collected), first.mirrors.map(x => x.used)];
  for (let i = 0; i < 100; i++) {
    const run = play(code);
    assert.deepEqual([run.status, run.elapsedTicks, run.coins.map(x => x.collected), run.mirrors.map(x => x.used)], expected);
  }
});
