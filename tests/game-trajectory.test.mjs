import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { analyzeProgram } from "../app/language/parser.ts";
import { analyzeJumpTrajectories } from "../app/game/trajectory.ts";

const load = (name) => JSON.parse(readFileSync(new URL("../public/stages/" + name + ".json", import.meta.url), "utf8"));

test("公開ステージのジャンプは描画なしで開始・頂点・着地を計測できる", () => {
  for (const id of ["stage-1", "stage-2", "stage-3", "stage-5"]) {
    const stage = load(id);
    const program = analyzeProgram(id === "stage-1" ? "かべとぶ" : id === "stage-5" ? "かべとあなとぶ\nおばけしゃがむ" : id === "stage-2" ? "かべとあなとぶ" : "かべとあなとぶ\nおばけしゃがむ").program;
    const first = analyzeJumpTrajectories(stage, program);
    const again = analyzeJumpTrajectories(stage, program);
    assert.deepEqual(again, first);
    assert.equal(first.status, "cleared", id);
    assert.ok(first.jumps.length >= 3, id);
    for (const jump of first.jumps) {
      assert.ok(jump.startTick <= jump.peakTick);
      assert.ok(jump.landingTick > jump.peakTick);
      assert.ok(jump.peakY < 272);
      assert.ok(Number.isFinite(jump.peakOffsetX));
      assert.ok(jump.landingFrontX > jump.startFrontX);
    }
  }
});

test("穴と壁は違う中心座標を持ち幅100と120の穴も計測できる", () => {
  const analysis = analyzeJumpTrajectories(load("stage-3"), analyzeProgram("かべとあなとぶ\nおばけしゃがむ").program);
  assert.equal(analysis.jumps.filter((jump) => jump.target?.type === "hole").length, 3);
  for (const jump of analysis.jumps.filter((item) => item.target?.type === "hole")) {
    assert.ok(jump.target.right - jump.target.left >= 100);
    assert.equal(jump.target.center, (jump.target.left + jump.target.right) / 2);
  }
});

test("trajectory CLI supports stage and speed selection", () => {
  const output = execFileSync(process.execPath, ["--experimental-strip-types", "scripts/analyze-jumps.mjs", "--stage=stage-3", "--fast"], { encoding: "utf8" });
  const { reports } = JSON.parse(output);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].stageId, "stage-3");
  assert.equal(reports[0].status, "cleared");
  assert.ok(reports[0].jumps.length > 0);
});

test("trajectory analysis rejects unbounded work", () => {
  assert.throws(() => analyzeJumpTrajectories(load("stage-1"), analyzeProgram("かべとぶ").program, 100001), RangeError);
});
