import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getScoreReference, ENGINE_VERSION, LANGUAGE_VERSION, SCORING_VERSION, SEASON_ID } from "../app/scoring/score.ts";
import { validateScope, validateRunPayload, verifyRunResult } from "../worker/validation.mjs";
import { validateStageCases, usesSecretAction } from "../app/stage/validator.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";

const read = (file) => JSON.parse(readFileSync(new URL("../" + file, import.meta.url), "utf8"));
const manifest = read("public/stages/manifest.json");

test("two advanced worlds require deliberate pace choices, but precise instructions preserve speed", () => {
  for (const number of [13, 25]) {
    const id = "stage-" + number;
    const stage = read("public/stages/" + id + ".json");
    const checks = read("stage-checks/" + id + ".json");
    const report = validateStageCases(id, stage, checks);
    assert.equal(report.pass, true, id + JSON.stringify(report.issues));
    const byName = (name) => report.cases.find((item) => item.name === name);
    const walk = byName("wide-sensor-walk-clears");
    const danger = byName("wide-sensor-unsafe-run-hits-nearby-hole");
    const switched = byName("wide-sensor-slow-down-before-hole-clears");
    const precise = byName("precise-run-remains-valid");
    assert.equal(walk?.outcome, "cleared", id);
    assert.equal(danger?.failureReason, "hole", id);
    assert.equal(switched?.outcome, "cleared", id);
    assert.equal(precise?.outcome, "cleared", id);
    assert.ok(switched.elapsedTicks < walk.elapsedTicks, id + " slowing must beat walking");
    assert.ok(precise.elapsedTicks < switched.elapsedTicks, id + " accurate commands reward full running");
    assert.equal(usesSecretAction(switched.source), false, id);
  }
});

test("previous leaderboard scopes remain visible while new versions are used for server replay", () => {
  for (const number of [13, 25]) {
    const id = "stage-" + number;
    assert.equal(manifest.stages.find((stage) => stage.id === id)?.version, "2026-10-25-r2");
    const scope = (stageVersion) => ({
      seasonId: SEASON_ID, stageId: id, stageVersion, engineVersion: ENGINE_VERSION,
      languageVersion: LANGUAGE_VERSION, scoringVersion: SCORING_VERSION,
    });
    assert.equal(validateScope(scope("2026-10-20-r1")).stageVersion, "2026-10-20-r1");
    assert.equal(validateScope(scope("2026-10-25-r2")).stageVersion, "2026-10-25-r2");
    assert.throws(() => validateRunPayload(scope("2026-10-20-r1")), /old stage version is read-only/);
    const original = getScoreReference(id, "2026-10-20-r1");
    const revised = getScoreReference(id, "2026-10-25-r2");
    assert.ok(original && revised);
    assert.equal(original.product, revised.product);
    const checks = read("stage-checks/" + id + ".json");
    const baseline = checks.cases.find((item) => item.role === "beginner");
    const stage = read("public/stages/" + id + ".json");
    const validation = validateStageCases(id, stage, checks);
    const measured = validation.cases.find((item) => item.role === "beginner");
    assert.ok(measured?.pass, id);
    assert.equal(verifyRunResult({ stageId: id, source: baseline.source, elapsedTicks: measured.elapsedTicks }), revised.timeTicks);
  }
});

test("broad ahead rules create a verified walking versus running trade-off in three stages", () => {
  for (const number of [5, 13, 25]) {
    const stage = read("public/stages/stage-" + number + ".json");
    const base = "まえとぶ\nおばけしゃがむ\nこいんとる";
    const run = (source) => {
      const parsed = analyzeProgram(source);
      assert.deepEqual(parsed.diagnostics, [], source);
      return runToCompletion(createGame(stage, parsed.program), 20000);
    };
    const walking = run("あるく\n" + base);
    const running = run("はしる\n" + base);
    assert.equal(walking.status, "cleared", "stage-" + number);
    assert.equal(running.status, "failed", "stage-" + number);
    assert.equal(running.failureReason, "hole", "stage-" + number);
  }
});
