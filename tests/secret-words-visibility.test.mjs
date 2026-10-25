import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { suggestedStageWords } from "../app/stage/vocabulary.ts";
import { failReasonLabel, defaultFailHint } from "../app/types/game.ts";

test("秘密の『とびら』は全30ステージの学習文・失敗文・おすすめ辞典に表示しない", () => {
  for (let number = 1; number <= 30; number++) {
    const json = readFileSync(new URL(`../public/stages/stage-${number}.json`, import.meta.url), "utf8");
    const stage = JSON.parse(json);
    assert.equal(JSON.stringify({ learningObjectives: stage.learningObjectives, meta: stage.meta }).includes("とびら"), false, "stage-" + number);
    const words = suggestedStageWords(stage);
    assert.ok(!words.conditions.includes("door"), "stage-" + number);
    assert.ok(!words.actions.includes("breakDoor"), "stage-" + number);
  }
  assert.equal(failReasonLabel("door").includes("とびら"), false);
  assert.equal(defaultFailHint("door").includes("とびら"), false);
});

test("非公開の単語は表示しなくてもパーサーがいつでも理解する", () => {
  assert.deepEqual(analyzeProgram("とびらをやぶる").diagnostics, []);
  assert.equal(analyzeProgram("めっちゃとぶ").rules[0]?.action, "powerJump");
});
