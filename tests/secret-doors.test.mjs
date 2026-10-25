import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion, stepGame } from "../app/game/core.ts";
import { validateStage } from "../app/stage/validator.ts";
import { suggestedStageWords } from "../app/stage/vocabulary.ts";
import { PREVIOUS_ENGINE_VERSION, ENGINE_VERSION } from "../app/scoring/score.ts";
import { validateScope, validateRunPayload } from "../worker/validation.mjs";

const stage = { goal: 900, scrollSpeed: 3, objects: [
  { type: "switch", id: "sw", position: 280, targetDoorId: "gate" },
  { type: "door", id: "gate", position: 480, breakable: true, vaultable: true },
] };
function run(source, world = stage) {
  const result = analyzeProgram(source);
  assert.deepEqual(result.diagnostics, [], source);
  return runToCompletion(createGame(world, result.program));
}
test("めっちゃとぶ is a full dictionary hidden alias", () => {
  assert.deepEqual(analyzeProgram("めっちゃとぶ").rules, analyzeProgram("すごいじゃんぷ").rules);
  assert.deepEqual(analyzeProgram("とびらをやぶる").rules[0], { action: "breakDoor", conds: ["door"], maxFires: undefined });
  assert.ok(!suggestedStageWords(stage).conditions.includes("door"));
  assert.ok(!suggestedStageWords(stage).actions.includes("breakDoor"));
  assert.equal(suggestedStageWords(stage).examples.some(t => t.includes("とびら")), false);
});
test("switch route, break route and power-jump vault route each clear opt-in door", () => {
  for (const source of ["すいっちおす", "とびらをやぶる", "とびらめっちゃとぶ"]) {
    const game = run(source);
    assert.equal(game.status, "cleared", source + ": " + game.failureReason);
    assert.equal(run(source).elapsedTicks, game.elapsedTicks);
    if (source.includes("やぶる")) assert.equal(game.doors[0].broken, true);
    if (source.includes("めっちゃ")) assert.equal(game.doors[0].vaulted, true);
  }
});
test("normal jump and non-opt-in doors remain physically blocked", () => {
  const normal = run("とびらとぶ");
  assert.equal(normal.status, "failed");
  assert.equal(normal.failureReason, "door");
  const legacy = { ...stage, objects: stage.objects.map(obj => obj.type === "door" ? { ...obj, vaultable: false, breakable: false } : obj) };
  for (const source of ["とびらをやぶる", "とびらめっちゃとぶ"]) {
    const game = run(source, legacy);
    assert.notEqual(game.status, "cleared", source);
  }
});
test("door break cannot hit out-of-range door and affects only matching one", () => {
  const extra = { goal: 1600, scrollSpeed: 3, objects: [
    { type: "door", id: "first", position: 480, breakable: true },
    { type: "door", id: "second", position: 950, breakable: true },
  ] };
  const game = createGame(extra, analyzeProgram("とびらをやぶる").program);
  stepGame(game);
  assert.equal(game.doors.every(d => !d.open), true);
  runToCompletion(game);
  assert.equal(game.status, "cleared");
  assert.deepEqual(game.doors.map(d => d.broken), [true, true]);
  assert.equal(game.fired[0].size, 2);
});
test("stage JSON rejects invalid secret-door capabilities", () => {
  assert.deepEqual(validateStage("stage-door", stage), []);
  for (const key of ["breakable", "vaultable"]) {
    const bad = { ...stage, objects: stage.objects.map(o => o.type === "door" ? { ...o, [key]: "yes" } : o) };
    assert.ok(validateStage("stage-door", bad).some(e => e.path.endsWith("." + key)));
  }
});
test("new engine scope rejects old posts but supports read-only archived leaderboards", () => {
  assert.equal(ENGINE_VERSION, "2026-core-v4");
  assert.equal(PREVIOUS_ENGINE_VERSION, "2026-core-v2");
  const scope = { seasonId: "2026-festival", stageId: "stage-8", stageVersion: "2026-10-20-r2", engineVersion: PREVIOUS_ENGINE_VERSION, languageVersion: "2026-language-v4", scoringVersion: "2026-v1" };
  assert.deepEqual(validateScope(scope), scope);
  assert.throws(() => validateRunPayload({ ...scope }), /read-only/);
});
