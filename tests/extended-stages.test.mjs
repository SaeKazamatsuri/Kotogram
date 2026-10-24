import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import manifest from "../public/stages/manifest.json" with { type: "json" };
import { validateStageCases } from "../app/stage/validator.ts";
import { countSourceCharacters, getScoreReference } from "../app/scoring/score.ts";
import { replayStageIds } from "../worker/validation.mjs";

test("all thirty public stages have replay entries and score references", () => {
  assert.equal(manifest.stages.length, 30);
  assert.deepEqual(replayStageIds, manifest.stages.map((entry) => entry.id));
  for (const entry of manifest.stages) assert.ok(getScoreReference(entry.id, entry.version ?? manifest.version));
});

test("new stages have reproducible clears and per-stage score baselines", () => {
  for (let index = 9; index <= 30; index++) {
    const stage = JSON.parse(readFileSync(new URL(`../public/stages/stage-${index}.json`, import.meta.url), "utf8"));
    const checks = JSON.parse(readFileSync(new URL(`../stage-checks/stage-${index}.json`, import.meta.url), "utf8"));
    const report = validateStageCases(`stage-${index}`, stage, checks);
    assert.equal(report.pass, true, `${index}: ${JSON.stringify(report.cases.filter((entry) => !entry.pass).map((entry) => ({ name: entry.name, errors: entry.errors, diagnostics: entry.diagnostics })))} ${JSON.stringify(report.issues)}`);
    const baseline = getScoreReference(`stage-${index}`, "2026-10-20-r1");
    const beginner = report.cases.find((entry) => entry.role === "beginner");
    const shorter = report.cases.find((entry) => entry.role === "short");
    assert.equal(shorter?.outcome, "cleared", `stage-${index}: short program must clear`);
    assert.ok(shorter.characters < beginner.characters,
      `stage-${index}: short program must use fewer characters than beginner`);
    assert.equal(baseline.timeTicks, beginner.elapsedTicks);
    assert.equal(baseline.characters, countSourceCharacters(beginner.source));
  }
});
