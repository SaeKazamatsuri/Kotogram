import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { analyzeJumpTrajectories } from "../app/game/trajectory.ts";
import { validateStage } from "../app/stage/validator.ts";

const load = (name) => JSON.parse(readFileSync(new URL("../experiments/stages/" + name + ".json", import.meta.url), "utf8"));
const play = (stage, source) => runToCompletion(createGame(stage, analyzeProgram(source).program));

test("公開ステージのデフォルト物理は変わらず互換性を保持", () => {
  const publicStage = JSON.parse(readFileSync(new URL("../public/stages/stage-1.json", import.meta.url), "utf8"));
  const game = play(publicStage, "かべとぶ");
  assert.equal(game.jumpSensorProfile, "legacy");
  assert.equal(game.status, "cleared");
  assert.equal(game.elapsedTicks, 712);
});

test("ステージ3短縮の実験版は初心者・最短・高速でクリアする", () => {
  const stage = load("stage-3-short");
  assert.deepEqual(validateStage(stage.id, stage, true), []);
  for (const source of [
    "かべならじゃんぷ\nあなならじゃんぷ\nおばけならしゃがむ",
    "かべとあなとぶ\nおばけしゃがむ",
    "はしる\nかべとあなとぶ\nおばけしゃがむ",
  ]) {
    const game = play(stage, source);
    assert.equal(game.status, "cleared", source);
    assert.ok(game.elapsedTicks <= 900, source);
  }
});

test("穴の幅に合わせたセンサー補正で最高点が穴の中央に近づく", () => {
  const stage = load("stage-3-short");
  const source = "かべとあなとぶ\nおばけしゃがむ";
  const parsed = analyzeProgram(source).program;
  const centered = analyzeJumpTrajectories(stage, parsed);
  const legacy = analyzeJumpTrajectories({ ...stage, jumpSensorProfile: undefined }, parsed);
  assert.equal(centered.status, "cleared");
  assert.equal(legacy.status, "cleared");
  const holes = centered.jumps.filter((jump) => jump.target?.type === "hole");
  const old = legacy.jumps.filter((jump) => jump.target?.type === "hole");
  assert.equal(holes.length, 2);
  for (let index = 0; index < holes.length; index++) {
    assert.ok(Math.abs(holes[index].peakOffsetX) < Math.abs(old[index].peakOffsetX));
    assert.ok(Math.abs(holes[index].peakOffsetX) <= 20);
  }
});

test("前方を何でも跳ぶ命令では速度のリスクが生まれる配置を検証", () => {
  const stage = load("speed-risk");
  assert.deepEqual(validateStage(stage.id, stage, true), []);
  const walk = play(stage, "まえとぶ\nおばけしゃがむ");
  const run = play(stage, "はしる\nまえとぶ\nおばけしゃがむ");
  assert.equal(walk.status, "cleared");
  assert.equal(run.status, "failed");
  assert.equal(run.failureReason, "hole");
});

test("まえとぶの成功例と失敗例を明示する", () => {
  const easy = { goal: 900, scrollSpeed: 3, objects: [{ type: "wall", position: 500 }] };
  assert.equal(play(easy, "まえとぶ").status, "cleared");
  assert.equal(play(load("speed-risk"), "まえとぶ").status, "failed");
});
