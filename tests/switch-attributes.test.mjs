import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { validateStage } from "../app/stage/validator.ts";
import { suggestedStageWords } from "../app/stage/vocabulary.ts";
import { LANGUAGE_VERSION, PREVIOUS_LANGUAGE_VERSION } from "../app/scoring/score.ts";
import { validateScope } from "../worker/validation.mjs";

function valid(source) {
  const parsed = analyzeProgram(source);
  assert.deepEqual(parsed.diagnostics, [], source);
  return parsed;
}

const switchStage = {
  goal: 950, scrollSpeed: 3,
  objects: [
    { id: "bad", type: "switch", trap: true, position: 280, targetDoorId: "door" },
    { id: "good", type: "switch", position: 420, targetDoorId: "door" },
    { id: "door", type: "door", position: 710 },
  ],
};

test("日本語の色・図形は同じスイッチの別表現として解釈する", () => {
  assert.deepEqual(valid("あかいぼたんをみおくる").rules[0].conds, ["switch:red:*"]);
  assert.deepEqual(valid("みどりのすいっちをおす").rules[0].conds, ["switch:green:*"]);
  assert.deepEqual(valid("ばつのぼたんをみおくる").rules[0].conds, ["switch:*:cross"]);
  assert.deepEqual(valid("まるのぼたんをおす").rules[0].conds, ["switch:*:circle"]);
  assert.deepEqual(valid("あかいまるのぼたんをおす").rules[0].conds, ["switch:red:circle"]);
  assert.deepEqual(valid("あかいぼたんとあおのすいっちをみおくる").rules[0].conds, ["switch:red:*", "switch:blue:*"]);
  assert.deepEqual(valid("もしばつのぼたんがあったら\nみおくる\nおわり").program.watchers[0].conds, ["switch:*:cross"]);
});

test("色と図形のどちらでも罠を避けて安全な扉を開ける", () => {
  const routes = [
    "あかいぼたんをみおくる\nみどりのすいっちをおす",
    "ばつのぼたんをみおくる\nまるのぼたんをおす",
  ];
  for (const source of routes) {
    const finished = runToCompletion(createGame(switchStage, valid(source).program));
    assert.equal(finished.status, "cleared", source);
    assert.equal(finished.switches.find((item) => item.id === "bad").skipped, true);
    assert.equal(finished.switches.find((item) => item.id === "good").activated, true);
    assert.equal(finished.doors[0].open, true);
    assert.equal(runToCompletion(createGame(switchStage, valid(source).program)).elapsedTicks, finished.elapsedTicks);
  }
  const mistake = runToCompletion(createGame(switchStage, valid("あかいぼたんをおす").program));
  assert.equal(mistake.status, "failed");
  assert.equal(mistake.failureReason, "trap");
});

test("複合指定は色と形の両方を満たす対象だけ選択する", () => {
  const stage = {
    goal: 950, scrollSpeed: 3,
    objects: [
      { id: "wrong", type: "switch", trap: true, color: "red", shape: "cross", position: 280, targetDoorId: "door" },
      { id: "right", type: "switch", color: "red", shape: "circle", position: 420, targetDoorId: "door" },
      { id: "door", type: "door", position: 710 },
    ],
  };
  assert.deepEqual(validateStage("stage-colors", stage), []);
  const game = runToCompletion(createGame(stage, valid("ばつのぼたんをみおくる\nあかいまるのぼたんをおす").program));
  assert.equal(game.status, "cleared");
  assert.equal(game.switches.find((item) => item.id === "wrong").skipped, true);
  assert.equal(game.switches.find((item) => item.id === "right").activated, true);
  assert.equal(game.switches.find((item) => item.id === "right").color, "red");
  assert.equal(game.switches.find((item) => item.id === "right").shape, "circle");
});

test("存在しない属性・矛盾した色・対象外の修飾は解析とステージ検証で拒否する", () => {
  for (const phrase of ["あかいかべとぶ", "あかいみどりのぼたんおす", "さんかくばつのぼたんおす", "あかいぼたんみおくるとこいんとる"]) {
    assert.ok(analyzeProgram(phrase).diagnostics.length > 0, phrase);
  }
  assert.ok(validateStage("stage-colors", { ...switchStage, objects: switchStage.objects.map((o, i) => i === 0 ? { ...o, color: "rainbow" } : o) })
    .some((issue) => issue.path.endsWith(".color")));
  assert.ok(validateStage("stage-colors", { ...switchStage, objects: switchStage.objects.map((o, i) => i === 0 ? { ...o, shape: "diamond" } : o) })
    .some((issue) => issue.path.endsWith(".shape")));
});

test("辞典に出さない言葉もパーサーはそのまま受理する", () => {
  const stage1 = JSON.parse(readFileSync(new URL("../public/stages/stage-1.json", import.meta.url), "utf8"));
  const stage8 = JSON.parse(readFileSync(new URL("../public/stages/stage-8.json", import.meta.url), "utf8"));
  const beginner = suggestedStageWords(stage1);
  assert.ok(beginner.conditions.includes("wall"));
  assert.ok(beginner.actions.includes("jump"));
  assert.ok(!beginner.conditions.includes("coin"));
  assert.ok(!beginner.conditions.includes("switch"));
  assert.ok(!beginner.actions.includes("run"));
  const switchWords = suggestedStageWords(stage8);
  assert.ok(switchWords.conditions.includes("switch"));
  assert.ok(switchWords.actions.includes("skip"));
  assert.ok(switchWords.examples.includes("あかいぼたん"));
  assert.ok(switchWords.examples.includes("ばつのぼたん"));
  assert.ok(switchWords.examples.includes("みどりのぼたん"));
  assert.ok(switchWords.examples.includes("まるのぼたん"));
  const guide = suggestedStageWords({ ...stage8, meta: { dictionary: { conditions: ["switch"], actions: ["press"], examples: ["まるのぼたん"] } } });
  assert.deepEqual(guide, { conditions: ["switch"], actions: ["press"], examples: ["まるのぼたん"] });
  assert.deepEqual(valid("めっちゃはしる").diagnostics, []);
  assert.deepEqual(valid("かべとぶ").diagnostics, []);
});

test("言語v4は旧v3とランキングのスコープを分離する", () => {
  assert.equal(LANGUAGE_VERSION, "2026-language-v4");
  assert.equal(PREVIOUS_LANGUAGE_VERSION, "2026-language-v3");
  const v3 = validateScope({ seasonId: "2026-festival", stageId: "stage-8", stageVersion: "2026-10-20-r2", engineVersion: "2026-core-v2", languageVersion: PREVIOUS_LANGUAGE_VERSION, scoringVersion: "2026-v1" });
  const v4 = validateScope({ ...v3, languageVersion: LANGUAGE_VERSION });
  assert.equal(v3.languageVersion, PREVIOUS_LANGUAGE_VERSION);
  assert.equal(v4.languageVersion, LANGUAGE_VERSION);
});
