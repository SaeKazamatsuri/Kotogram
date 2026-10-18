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

test("manifest-listed stage JSON and checks are schema-valid", () => {
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
    { type: "laser", position: 900 },
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
    assert.equal(report.improvements.fasterThanBeginner, true);
    assert.equal(report.warnings.length, 0);
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

test("stage 4 independently verifies its capped watchers, shorter code and faster solution", () => {
  const report = validateStageCases("stage-4", read("public/stages/stage-4.json"), read("stage-checks/stage-4.json"));
  assert.equal(report.pass, true, JSON.stringify(report.issues));
  assert.equal(report.bestKnown.ticks, 620);
  assert.equal(report.improvements.shorterThanBeginner, true);
  assert.equal(report.improvements.fasterThanBeginner, true);
  assert.equal(report.cases.find((entry) => entry.name === "count-three-fails-at-fourth")?.failureReason, "wall");
});

test("stage 5 requires concurrent crouch and jump at the same obstacle position", () => {
  const stage = read("public/stages/stage-5.json");
  const report = validateStageCases("stage-5", stage, read("stage-checks/stage-5.json"));
  assert.equal(report.pass, true, JSON.stringify(report.issues));
  assert.equal(report.improvements.shorterThanBeginner, true);
  assert.equal(report.improvements.fasterThanBeginner, true);
  assert.equal(report.bestKnown.ticks, 574);
  assert.equal(report.cases.find((entry) => entry.name === "jump-alone-fails-on-coincident-ghost")?.failureReason, "enemy");
  assert.equal(report.cases.find((entry) => entry.name === "crouch-alone-fails-on-coincident-wall")?.failureReason, "wall");
});

test("all three original stages have verifiable running routes faster than walking", () => {
  for (const id of ["stage-1", "stage-2", "stage-3"]) {
    const report = validateStageCases(id, read("public/stages/" + id + ".json"), read("stage-checks/" + id + ".json"));
    assert.equal(report.pass, true);
    const walking = report.cases.find((entry) => entry.role === "beginner");
    const running = report.cases.find((entry) => entry.name === "fast-run-with-watchers");
    assert.equal(running?.outcome, "cleared");
    assert.ok(running.elapsedTicks < walking.elapsedTicks);
    const unprotected = report.cases.find((entry) => entry.name === "run-without-jump-still-fails");
    assert.equal(unprotected?.failureReason, "wall");
  }
});

test("coin schema checks required count and object identity", () => {
  const stage = { goal: 1200, scrollSpeed: 3, requiredCoins: 2, objects: [
    { id: "coin-a", type: "coin", position: 300 },
    { id: "coin-b", type: "coin", position: 600 },
  ] };
  assert.deepEqual(validateStage("stage-coins", stage), []);
  assert.ok(validateStage("stage-coins", { ...stage, requiredCoins: 3 }).some((issue) => issue.path === "requiredCoins"));
  assert.ok(validateStage("stage-coins", { ...stage, requiredCoins: -1 }).some((issue) => issue.path === "requiredCoins"));
});

test("stage 6 requires both coins, supports short source and improves speed", () => {
  const report = validateStageCases("stage-6", read("public/stages/stage-6.json"), read("stage-checks/stage-6.json"));
  assert.equal(report.pass, true, JSON.stringify(report));
  assert.equal(report.bestKnown.ticks, 394);
  assert.equal(report.bestKnown.characters, 9);
  assert.equal(report.cases.find((entry) => entry.name === "missing-coin-at-goal")?.failureReason, "coin");
});

test("switch and door require valid ID references and reaction room", () => {
  const objects = [
    { type: "switch", id: "sw", position: 280, targetDoorId: "gate" },
    { type: "door", id: "gate", position: 750 },
  ];
  assert.deepEqual(validateStage("stage-switch", { goal: 1200, scrollSpeed: 3, objects }), []);
  const wrongDoor = [{ ...objects[0], targetDoorId: "unknown" }, objects[1]];
  assert.ok(validateStage("stage-switch", { goal: 1200, scrollSpeed: 3, objects: wrongDoor })
    .some((item) => item.path.endsWith("targetDoorId")));
  const tooClose = [{ ...objects[0], position: 740 }, objects[1]];
  assert.ok(validateStage("stage-switch", { goal: 1200, scrollSpeed: 3, objects: tooClose })
    .some((item) => item.path.endsWith("position")));
  const noId = [{ type: "switch", position: 280, targetDoorId: "gate" }, objects[1]];
  assert.ok(validateStage("stage-switch", { goal: 1200, scrollSpeed: 3, objects: noId })
    .some((item) => item.path.endsWith(".id")));
});

test("stage 7 requires switches before doors and jump after opening", () => {
  const report = validateStageCases("stage-7", read("public/stages/stage-7.json"), read("stage-checks/stage-7.json"));
  assert.equal(report.pass, true, JSON.stringify(report));
  assert.equal(report.bestKnown.ticks, 523);
  assert.equal(report.bestKnown.characters, 10);
  assert.equal(report.cases.find((item) => item.name === "count-limited-switch")?.failureReason, "door");
});

test("stage learning objectives must be meaningful and bounded", () => {
  const source = { goal: 800, scrollSpeed: 3 };
  assert.deepEqual(validateStage("stage-learning", { ...source, learningObjectives: ["かべを とぶ"] }), []);
  assert.ok(validateStage("stage-learning", { ...source, learningObjectives: [""] })
    .some((issue) => issue.path === "learningObjectives"));
  assert.ok(validateStage("stage-learning", { ...source, learningObjectives: "ひらがな" })
    .some((issue) => issue.path === "learningObjectives"));
  assert.ok(validateStage("stage-learning", { ...source, learningObjectives: Array(6).fill("とぶ") })
    .some((issue) => issue.path === "learningObjectives"));
});
