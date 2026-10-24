import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateStageCases, usesSecretAction } from "../app/stage/validator.ts";
import { getScoreReference, countSourceCharacters } from "../app/scoring/score.ts";

const load = (file) => JSON.parse(readFileSync(new URL("../" + file, import.meta.url), "utf8"));
const manifest = load("public/stages/manifest.json");
const specialStages = new Set(["stage-12", "stage-18", "stage-21", "stage-24", "stage-29", "stage-30"]);

test("all thirty stages have a verified clear without secret commands", () => {
  assert.equal(manifest.stages.length, 30);
  for (const entry of manifest.stages) {
    const stage = load("public/stages/" + entry.id + ".json");
    const checks = load("stage-checks/" + entry.id + ".json");
    const report = validateStageCases(entry.id, stage, checks);
    assert.equal(report.pass, true, entry.id + ": " + JSON.stringify(report.issues));
    const learningCases = report.cases.filter((item) => item.role === "learning");
    const beginner = report.cases.find((item) => item.role === "beginner");
    assert.ok(beginner?.pass && beginner.outcome === "cleared", entry.id);
    assert.equal(learningCases.length, specialStages.has(entry.id) ? 1 : 0, entry.id);
    const learning = learningCases[0] ?? beginner;
    assert.equal(learning.outcome, "cleared", entry.id);
    assert.equal(usesSecretAction(learning.source), false, entry.id);
    const reference = getScoreReference(entry.id, entry.version ?? manifest.version);
    assert.ok(reference, entry.id);
    if (Number(entry.id.slice(6)) >= 9) {
      assert.equal(beginner.elapsedTicks, reference.timeTicks, entry.id);
      assert.equal(countSourceCharacters(beginner.source), reference.characters, entry.id);
    }
  }
});

test("learning route rejects hidden actions even under aliases, watchers or repeats", () => {
  assert.equal(usesSecretAction("すごいじゃんぷ"), true);
  assert.equal(usesSecretAction("かべすごいとぶ"), true);
  assert.equal(usesSecretAction("めっちゃはしる"), true);
  assert.equal(usesSecretAction("2かいくりかえす\nめっちゃはしる\nおわり"), true);
  assert.equal(usesSecretAction("かべとぶ\nあなとぶ\nはしる"), false);
  const stage = load("public/stages/stage-12.json");
  const checks = load("stage-checks/stage-12.json");
  checks.cases.find((entry) => entry.role === "learning").source = "かべすごいとぶ";
  const report = validateStageCases("stage-12", stage, checks);
  assert.equal(report.pass, false);
  assert.ok(report.cases.some((entry) => entry.role === "learning" && entry.errors.some((item) => item.includes("secret"))));
});
