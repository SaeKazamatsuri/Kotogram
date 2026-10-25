import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { countSourceCharacters, ENGINE_VERSION, LANGUAGE_VERSION, SCORING_VERSION, SEASON_ID } from "../app/scoring/score.ts";
import { validateScope, validateRunPayload, verifyRunResult } from "../worker/validation.mjs";

const read = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const manifest = read("public/stages/manifest.json");
const play = (stage, source) => {
  const parsed = analyzeProgram(source);
  assert.deepEqual(parsed.diagnostics, [], source);
  return runToCompletion(createGame(stage, parsed.program));
};

for (const number of [8, 10]) {
  test(`stage ${number} supports 3 physical routes while ordinary jumping remains blocked`, () => {
    const stage = read(`public/stages/stage-${number}.json`);
    const checks = read(`stage-checks/stage-${number}.json`);
    const beginner = checks.cases.find((entry) => entry.role === "beginner");
    const regular = play(stage, beginner.source);
    assert.equal(regular.status, "cleared");
    assert.equal(objectiveProgress(regular).completionBp, 10000);
    const blocked = play(stage, "とびらとぶ");
    assert.equal(blocked.status, "failed");
    assert.equal(blocked.failureReason, "door");
    for (const [source, flag] of [["とびらをやぶる", "broken"], ["とびらめっちゃとぶ", "vaulted"]]) {
      const run = play(stage, source);
      const second = play(stage, source);
      assert.equal(run.status, "cleared", source);
      assert.equal(run.elapsedTicks, second.elapsedTicks);
      assert.deepEqual(run.doors.map((door) => door[flag]), [true, true]);
      assert.equal(objectiveProgress(run).completionBp, 1200);
    }
    for (const source of ["すいっちみおくる\nこいんとる\nとびらをやぶる", "すいっちみおくる\nこいんとる\nとびらめっちゃとぶ"]) {
      const run = play(stage, source);
      assert.equal(run.status, "cleared", source);
      assert.equal(objectiveProgress(run).completionBp, 10000, source);
      assert.equal(verifyRunResult({stageId: `stage-${number}`, source, elapsedTicks: run.elapsedTicks, completionBp: 10000}), run.elapsedTicks);
      assert.throws(() => verifyRunResult({stageId: `stage-${number}`, source, elapsedTicks: run.elapsedTicks, completionBp: 1200}), /objective progress/);
    }
  });

  test(`stage ${number} publishes r4 ranking without accepting r3 writes`, () => {
    const stageId = `stage-${number}`;
    const entry = manifest.stages.find((item) => item.id === stageId);
    assert.equal(entry.version, "2026-10-25-r4");
    const oldScope = {seasonId: SEASON_ID, stageId, stageVersion: "2026-10-25-r3", engineVersion: ENGINE_VERSION, languageVersion: LANGUAGE_VERSION, scoringVersion: SCORING_VERSION};
    const scope = {...oldScope, stageVersion: entry.version};
    assert.deepEqual(validateScope(oldScope), oldScope);
    assert.deepEqual(validateScope(scope), scope);
    const source = "とびらをやぶる";
    const run = play(read(`public/stages/${stageId}.json`), source);
    const input = {...scope, runId: "00000000-0000-4000-8000-000000000001", playerId: "00000000-0000-4000-8000-000000000002", source, elapsedTicks: run.elapsedTicks, charCount: countSourceCharacters(source), completionBp: objectiveProgress(run).completionBp};
    assert.equal(validateRunPayload(input).stageVersion, "2026-10-25-r4");
    assert.throws(() => validateRunPayload({...input, ...oldScope}), /read-only/);
    assert.equal(verifyRunResult(input), run.elapsedTicks);
  });
}
