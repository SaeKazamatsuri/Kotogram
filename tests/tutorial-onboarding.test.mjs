import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProgram } from "../app/language/parser.ts";
import {
  FIRST_STAGE_EXAMPLE,
  FIRST_STAGE_SHORT,
  failureLearningHint,
  isStageOneShortForm,
  shouldShowFirstClearLesson,
} from "../app/stage/onboarding.ts";

test("the first natural-language example and its short form produce the same rule", () => {
  const natural = analyzeProgram(FIRST_STAGE_EXAMPLE);
  const short = analyzeProgram(FIRST_STAGE_SHORT);
  assert.deepEqual(natural.diagnostics, []);
  assert.deepEqual(short.diagnostics, []);
  assert.deepEqual(natural.rules, short.rules);
});

test("the first-clear tutorial is shown once for an unshortened first solution", () => {
  assert.equal(shouldShowFirstClearLesson("stage-1", false, FIRST_STAGE_EXAMPLE), true);
  assert.equal(shouldShowFirstClearLesson("stage-1", true, FIRST_STAGE_EXAMPLE), false);
  assert.equal(shouldShowFirstClearLesson("stage-2", false, FIRST_STAGE_EXAMPLE), false);
  assert.equal(shouldShowFirstClearLesson("stage-1", false, FIRST_STAGE_SHORT), false);
  assert.equal(isStageOneShortForm(" かべ とぶ "), true);
  assert.equal(isStageOneShortForm("はしる\nかべとぶ"), true);
  assert.equal(isStageOneShortForm("かべじゃんぷ"), false);
});

test("failure guidance gives the player an inferable next action", () => {
  for (const reason of ["wall", "hole", "enemy", "door", "trap", "laser", "coin", "skip", "void"]) {
    assert.ok(failureLearningHint(reason).length > 12, reason);
  }
  assert.match(failureLearningHint("wall"), /かべ.*じゃんぷ/);
  assert.match(failureLearningHint("hole"), /あな.*じゃんぷ/);
  assert.match(failureLearningHint("enemy"), /おばけ.*しゃがんで/);
  assert.match(failureLearningHint("trap"), /みおくる/);
  assert.equal(failureLearningHint("unknown"), failureLearningHint("void"));
});
