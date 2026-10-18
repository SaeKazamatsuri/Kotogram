import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import {
  validateManifest, validateStage, validateChecks, validateStageCases,
  countProgramCharacters,
} from "../app/stage/validator.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => JSON.parse(readFileSync(join(root, file), "utf8"));
const manifest = read("public/stages/manifest.json");

test("2025 stage manifest and all 3 stage JSON files are schema-valid", () => {
  assert.deepEqual(validateManifest(manifest), []);
  for (const { id, file } of manifest.stages) {
    assert.deepEqual(validateStage(id, read("public" + file)), [], id);
    assert.deepEqual(validateChecks(id, read(`stage-checks/${id}.json`)), [], id);
  }
});

test("rejects duplicate IDs, duplicate files, traversal and mismatched paths", () => {
  const invalid = structuredClone(manifest);
  invalid.stages[1].id = invalid.stages[0].id;
  invalid.stages[1].file = "/stages/../../.env";
  assert.ok(validateManifest(invalid).some((e) => e.message.includes("duplicate")));
  assert.ok(validateManifest(invalid).some((e) => e.message.includes("path")));
});

test("rejects unsupported types, duplicate obstacles, NaN and invalid dimensions", () => {
  const stage = { goal: 3000, scrollSpeed: 3, objects: [
    { type: "wall", position: 600, id: "a" },
    { type: "wall", position: 600, id: "a" },
    { type: "coin", position: 900 },
    { type: "hole", position: 1000, width: 0 },
  ] };
  const errors = validateStage("stage-example", stage);
  assert.ok(errors.some((e) => e.message.includes("duplicate")));
  assert.ok(errors.some((e) => e.message.includes("unsupported")));
  assert.ok(errors.some((e) => e.path.includes("width")));
  assert.ok(validateStage("stage-example", { ...stage, scrollSpeed: Infinity }).some((e) => e.path === "scrollSpeed"));
});

test("rejects a goal that would be silently relocated by the game engine", () => {
  assert.ok(validateStage("stage-example", {
    goal: 750, scrollSpeed: 3, objects: [{ type: "wall", position: 700 }],
  }).some((e) => e.path === "goal"));
});

test("normalizes fullwidth digits and combining marks; whitespace has no character cost", () => {
  assert.equal(countProgramCharacters(" かべとぶ\n あなとぶ\t"), 8);
  assert.equal(countProgramCharacters("かべ３かいとぶ"), countProgramCharacters("かべ3かいとぶ"));
  assert.equal(countProgramCharacters("か\u3099"), 1);
});

test("invalid references and duplicate test case names are reported", () => {
  const invalid = { stageId: "stage-1", cases: [
    { name: "first", role: "beginner", source: "かべとぶ", expect: "cleared" },
    { name: "first", role: "short", source: "かべとぶ", expect: "cleared" },
  ] };
  assert.ok(validateChecks("stage-1", invalid).some((e) => e.message.includes("duplicate")));
});

test("all registered stage cases pass with frozen tick snapshots", () => {
  for (const { id, file } of manifest.stages) {
    const report = validateStageCases(id, read("public" + file), read(`stage-checks/${id}.json`));
    assert.equal(report.pass, true, JSON.stringify(report.issues));
    assert.ok(report.cases.some((entry) => entry.role === "beginner" && entry.outcome === "cleared"));
    assert.ok(report.cases.some((entry) => entry.role === "negative" && entry.outcome === "failed"));
    assert.equal(report.improvements.shorterThanBeginner, true);
    assert.equal(report.improvements.fasterThanBeginner, false);
    assert.equal(report.warnings.length, 1);
    assert.ok(report.bestKnown.ticks > 0);
    assert.ok(report.bestKnown.characters > 0);
    assert.ok(report.bestKnown.timeCharactersProduct > 0);
  }
});

test("regression in expected ticks and in expected outcome breaks validation", () => {
  const stage = read("public/stages/stage-1.json");
  const checks = read("stage-checks/stage-1.json");
  checks.cases[0].expectedTicks += 1;
  checks.cases[1].expect = "failed";
  const report = validateStageCases("stage-1", stage, checks);
  assert.equal(report.pass, false);
  assert.ok(report.cases[0].errors.some((m) => m.includes("expected") && m.includes("ticks")));
  assert.ok(report.cases[1].errors.some((m) => m.includes("expected failed")));
});

test("invalid code never executes a partial stage program", () => {
  const data = read("stage-checks/stage-1.json");
  data.cases[0].source = "かべとぶ\nまちがい";
  const report = validateStageCases("stage-1", read("public/stages/stage-1.json"), data);
  assert.equal(report.pass, false);
  assert.equal(report.cases[0].outcome, "invalid");
  assert.ok(report.cases[0].diagnostics.length > 0);
});

test("CLI supports JSON output and targeted validation", () => {
  const output = execFileSync(process.execPath, [
    "--disable-warning=ExperimentalWarning", "--experimental-strip-types", "scripts/validate-stages.mjs",
    "--json", "--stage", "stage-2",
  ], { cwd: root, encoding: "utf8" });
  const result = JSON.parse(output);
  assert.equal(result.pass, true);
  assert.equal(result.stages.length, 1);
  assert.equal(result.stages[0].stageId, "stage-2");
});
