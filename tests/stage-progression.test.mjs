import test from "node:test";
import assert from "node:assert/strict";
import { canPlayStage, nextStageId } from "../app/stage/progression.ts";

const stages = [{ id: "stage-1" }, { id: "stage-2" }, { id: "stage-3" }, { id: "stage-4" }];

test("stage progression follows manifest order and previous clear state", () => {
  const cleared = new Set(["stage-1", "stage-3"]);
  const hasCleared = (id) => cleared.has(id);
  assert.equal(canPlayStage("stage-1", stages, hasCleared), true);
  assert.equal(canPlayStage("stage-2", stages, hasCleared), true);
  assert.equal(canPlayStage("stage-3", stages, hasCleared), false);
  assert.equal(canPlayStage("stage-4", stages, hasCleared), true);
  assert.equal(canPlayStage("stage-99", stages, hasCleared), false);
  assert.equal(canPlayStage("stage-2", stages, () => false), false);
});

test("next-stage navigation never relies on a fixed final stage number", () => {
  assert.equal(nextStageId("stage-1", stages), "stage-2");
  assert.equal(nextStageId("stage-3", stages), "stage-4");
  assert.equal(nextStageId("stage-4", stages), null);
  assert.equal(nextStageId("unknown", stages), null);
});
