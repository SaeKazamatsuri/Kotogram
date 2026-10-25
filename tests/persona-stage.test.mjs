import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { validateStageCases } from "../app/stage/validator.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const manifest = read("public/stages/manifest.json");
const stages = manifest.stages.map(({ id, file }) => ({
  id,
  stage: read("public" + file),
  checks: read(`stage-checks/${id}.json`),
}));

function simulate(stage, source, maxTicks = 20000) {
  const parsed = analyzeProgram(source);
  assert.deepEqual(parsed.diagnostics, [], source + ": " + JSON.stringify(parsed.diagnostics));
  return runToCompletion(createGame(stage, parsed.program), maxTicks);
}

function paraphrase(source) {
  return source
    .replaceAll("すいっち", "ぼたん")
    .replaceAll("かべとぶ", "かべじゃんぷ")
    .replaceAll("あなとぶ", "あなじゃんぷ")
    .replaceAll("おばけしゃがむ", "てきかがむ")
    .replaceAll("こいんとる", "おかねひろう")
    .replaceAll("すごいじゃんぷ", "すごいとぶ");
}

test("persona round 1: beginner and vocabulary explorer cover all 30 stages", () => {
  assert.equal(stages.length, 30);
  for (const { id, stage, checks } of stages) {
    const beginner = checks.cases.find((item) => item.role === "beginner");
    assert.ok(beginner, id);
    const ordinary = simulate(stage, beginner.source, checks.maxTicks);
    const explorer = simulate(stage, paraphrase(beginner.source), checks.maxTicks);
    assert.equal(ordinary.status, "cleared", id + " beginner");
    assert.deepEqual([explorer.status, explorer.elapsedTicks, explorer.failureReason],
      [ordinary.status, ordinary.elapsedTicks, ordinary.failureReason], id + " paraphrase");
  }
});

test("persona round 2: speedrunner and shortcut explorer cover all 30 stages", () => {
  for (const { id, stage, checks } of stages) {
    const runner = checks.cases.find((item) => item.role === "fast");
    const explorer = checks.cases.find((item) => item.role === "overall");
    assert.ok(runner && explorer, id);
    for (const item of [runner, explorer]) {
      const result = simulate(stage, item.source, checks.maxTicks);
      assert.equal(result.status, item.expect, id + " " + item.name);
      if (item.expectedTicks) assert.equal(result.elapsedTicks, item.expectedTicks, id + " " + item.name);
    }
  }
});

test("persona round 3: adversarial and experimental routes replay every registered stage scenario", () => {
  for (const { id, stage, checks } of stages) {
    const result = validateStageCases(id, stage, checks);
    assert.equal(result.pass, true, id + ": " + JSON.stringify(result.issues));
    for (const item of checks.cases.filter((entry) => entry.role === "negative" || entry.role === "regression")) {
      const first = simulate(stage, item.source, checks.maxTicks);
      const second = simulate(stage, item.source, checks.maxTicks);
      assert.deepEqual([first.status, first.elapsedTicks, first.failureReason],
        [second.status, second.elapsedTicks, second.failureReason], id + " " + item.name);
      assert.equal(first.status, item.expect, id + " " + item.name);
    }
  }
});

test("persona color explorer: grouped colors and shapes work on stages 14 and 19", () => {
  const stage14 = stages.find((item) => item.id === "stage-14").stage;
  const successful = simulate(stage14, "あかとむらさきのぼたんみおくる\nみどりときいろのぼたんおす");
  assert.equal(successful.status, "cleared");
  assert.deepEqual(successful.switches.filter((item) => item.activated).map((item) => item.id), ["safe-2", "safe-5"]);
  const dangerous = simulate(stage14, "みどりとあかのぼたんをおす");
  assert.equal(dangerous.status, "failed");
  assert.equal(dangerous.failureReason, "trap");
  const stage19 = stages.find((item) => item.id === "stage-19").stage;
  const alternate = simulate(stage19,
    "あかときいろのぼたんみおくる\nみどりとあおのぼたんおす\nおばけしゃがむ\nかべとぶ");
  assert.equal(alternate.status, "cleared");
});

test("persona shortcut explorer: stage 14 supports power vaults but not normal jumps", () => {
  const stage = stages.find((item) => item.id === "stage-14").stage;
  const bypass = simulate(stage, "めっちゃはしる\nとびらをすごいじゃんぷ");
  assert.equal(bypass.status, "cleared");
  assert.ok(bypass.doors.every((item) => item.vaulted));
  const normal = simulate(stage, "めっちゃはしる\nとびらをじゃんぷ");
  assert.equal(normal.status, "failed");
  assert.equal(normal.failureReason, "door");
});
