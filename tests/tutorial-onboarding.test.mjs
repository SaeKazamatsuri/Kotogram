import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProgram } from "../app/language/parser.ts";
import {
  FIRST_STAGE_EXAMPLE,
  FIRST_STAGE_SHORT,
  failureLearningHint,
  isStageOneShortForm,
  shouldShowFirstClearLesson,
  hasStageTutorial,
  stageTutorialSteps,
  tutorialStorageKey,
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

test("the first stage demonstrates drag, editor, run, inspection and dictionary in order", () => {
  const steps = stageTutorialSteps("stage-1");
  assert.deepEqual(steps.map(step => step.target), ["canvas", "editor", "run", "canvas", "dictionary"]);
  assert.equal(steps[0].dragDemo, true);
  assert.match(steps[3].message, /マウス.*タップ/);
  assert.match(steps[4].message, /使える言葉/);
  assert.deepEqual(stageTutorialSteps("stage-1", true).map(step => step.target), ["editor"]);
});

test("new mechanics have contextual guidance without writing a complete answer", () => {
  for (const stageNumber of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]) {
    const id = `stage-${stageNumber}`;
    assert.equal(hasStageTutorial(id), true, id);
    const steps = stageTutorialSteps(id);
    assert.ok(steps.length >= 2, id);
    assert.equal(steps[0].target, "canvas", id);
    assert.equal(steps.at(-1).target, "dictionary", id);
  }
  assert.equal(hasStageTutorial("stage-17"), false);
  assert.equal(hasStageTutorial("stage-30"), false);
  assert.deepEqual(stageTutorialSteps("stage-30"), []);
});

test("tutorial dismissal is isolated per stage and preserves the legacy first-stage key", () => {
  assert.equal(tutorialStorageKey("stage-1"), "kotogram.tutorial.introDismissed");
  assert.equal(tutorialStorageKey("stage-2"), "kotogram.tutorial.introDismissed.stage-2");
  assert.notEqual(tutorialStorageKey("stage-2"), tutorialStorageKey("stage-3"));
});
