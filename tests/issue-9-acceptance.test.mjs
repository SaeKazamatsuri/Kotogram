import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateStageCases, usesSecretAction } from "../app/stage/validator.ts";
import { getScoreReference, countSourceCharacters, ENGINE_VERSION, LANGUAGE_VERSION, SCORING_VERSION, SEASON_ID } from "../app/scoring/score.ts";
import { validateScope, validateRunPayload, verifyRunResult } from "../worker/validation.mjs";

const read = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const manifest = read("public/stages/manifest.json");

test("thirty stages freeze beginner, short, fast and independently registered overall solutions", () => {
  assert.equal(manifest.stages.length, 30);
  for (const entry of manifest.stages) {
    const checks = read("stage-checks/" + entry.id + ".json");
    const stage = read("public/stages/" + entry.id + ".json");
    const report = validateStageCases(entry.id, stage, checks);
    assert.equal(report.pass, true, entry.id + ": " + JSON.stringify(report.cases.filter(x => !x.pass)));
    for (const role of ["beginner", "short", "fast", "overall"]) {
      const cases = checks.cases.filter(x => x.role === role);
      assert.equal(cases.length, 1, entry.id + ": " + role);
      assert.ok(Number.isSafeInteger(cases[0].expectedTicks) && cases[0].expectedTicks > 0, entry.id + ": " + role);
      assert.equal(report.cases.find(x => x.role === role)?.elapsedTicks, cases[0].expectedTicks);
    }
    const allClears = report.cases.filter(x => x.outcome === "cleared");
    const overall = report.cases.find(x => x.role === "overall");
    // Optional objectives are weighted by completion; raw time*chars no longer defines best overall.\n    if (!stage.optionalObjectives) assert.equal(overall.product, Math.min(...allClears.map(x => x.product)), entry.id + ": best-known product");
    const base = report.cases.find(x => x.role === "beginner");
    const reference = getScoreReference(entry.id, entry.version ?? manifest.version);
    assert.equal(base.elapsedTicks, reference.timeTicks, entry.id);
    if (Number(entry.id.slice(6)) >= 9) assert.equal(countSourceCharacters(base.source), reference.characters, entry.id);
    const learning = report.cases.find(x => x.role === "learning") ?? base;
    assert.equal(learning.outcome, "cleared", entry.id);
    assert.equal(usesSecretAction(learning.source), false, entry.id);
  }
});

test("stage 19 adds concurrent jump and crouch choices instead of repeating stage 10", () => {
  const first = read("public/stages/stage-10.json");
  const second = read("public/stages/stage-19.json");
  assert.notDeepEqual(first.objects.map(x => [x.type, x.position]), second.objects.map(x => [x.type, x.position]));
  assert.ok(second.objects.some(x => x.type === "ghost"));
  assert.ok(second.objects.some(x => x.type === "wall"));
  const report = validateStageCases("stage-19", second, read("stage-checks/stage-19.json"));
  assert.equal(report.pass, true);
  assert.equal(report.cases.find(x => x.name === "without-crouch-hits-ghost")?.failureReason, "enemy");
  assert.equal(report.cases.find(x => x.name === "without-jump-hits-wall")?.failureReason, "wall");
});

test("stage 19 keeps old ranking results readable but disallows posting to the previous version", () => {
  const scope = version => ({
    seasonId: SEASON_ID, stageId: "stage-19", stageVersion: version,
    engineVersion: ENGINE_VERSION, languageVersion: LANGUAGE_VERSION, scoringVersion: SCORING_VERSION,
  });
  assert.equal(getScoreReference("stage-19", "2026-10-20-r1")?.characters, 30);
  assert.equal(getScoreReference("stage-19", "2026-10-25-r2")?.characters, 41);
  assert.equal(validateScope(scope("2026-10-20-r1")).stageVersion, "2026-10-20-r1");
  assert.throws(() => validateRunPayload(scope("2026-10-20-r1")), /old stage version is read-only/);
  const latest = read("stage-checks/stage-19.json").cases.find(x => x.role === "beginner");
  assert.equal(verifyRunResult({ stageId: "stage-19", source: latest.source, elapsedTicks: latest.expectedTicks }), latest.expectedTicks);
});

test("blind secret sprint fails at close obstacles; correctly targeted fast programs clear", () => {
  for (const number of [5, 13, 25]) {
    const id = "stage-" + number;
    const stage = read("public/stages/" + id + ".json");
    const report = validateStageCases(id, stage, read("stage-checks/" + id + ".json"));
    assert.equal(report.pass, true, id);
    assert.equal(report.cases.find(x => x.name === "blind-sprint-hits-hole")?.failureReason, "hole", id);
    assert.equal(report.cases.find(x => x.role === "fast")?.outcome, "cleared", id);
  }
});

test("power jump enables counted single-activation routes where ordinary jump cannot", () => {
  for (const number of [12, 21, 24, 29, 30]) {
    const id = "stage-" + number;
    const report = validateStageCases(id, read("public/stages/" + id + ".json"), read("stage-checks/" + id + ".json"));
    assert.equal(report.pass, true, id);
    assert.equal(report.cases.find(x => x.name === "ordinary-single-jump-fails")?.outcome, "failed", id);
    assert.equal(report.cases.find(x => x.role === "beginner")?.outcome, "cleared", id);
    assert.equal(report.cases.find(x => x.role === "learning")?.outcome, "cleared", id);
  }
});
