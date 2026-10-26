import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAME, createGame, runToCompletion } from "../app/game/core.ts";
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
    const alignedCenter = holes[index].peakOffsetX - GAME.playerWidth / 2;
    const legacyCenter = old[index].peakOffsetX - GAME.playerWidth / 2;
    assert.ok(Math.abs(alignedCenter) < Math.abs(legacyCenter));
    assert.ok(Math.abs(alignedCenter) <= stage.scrollSpeed + 2);
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

const repeatSource = "3かいくりかえす\nこいんとる\nすいっちおす\nおわり";
const repeatedSingleSource = Array(3).fill("1かいくりかえす\nこいんとる\nすいっちおす\nおわり").join("\n");

test("experimental sequence stage requires ordered repetitions rather than always-on watchers", () => {
  const stage = load("repeat-sequence");
  assert.deepEqual(validateStage(stage.id, stage, true), []);
  const loop = analyzeProgram(repeatSource);
  assert.deepEqual(loop.diagnostics, []);
  assert.deepEqual(loop.program.steps.map((step) => step.op), ["repeat-start", "wait", "wait", "repeat-end"]);
  const executed = runToCompletion(createGame(stage, loop.program));
  assert.equal(executed.status, "cleared");
  assert.equal(executed.cursor, loop.program.steps.length);
  assert.equal(executed.sequenceConsumed.size, 6);
  assert.equal(executed.coins.filter((coin) => coin.collected).length, 3);
  assert.equal(executed.switches.filter((item) => item.activated).length, 3);
  assert.equal(executed.switches.filter((item) => item.trap && item.activated).length, 0);
  const expanded = play(stage, repeatedSingleSource);
  assert.equal(expanded.status, "cleared");
  assert.equal(expanded.elapsedTicks, executed.elapsedTicks);
  assert.ok(repeatSource.length < repeatedSingleSource.length);
});

test("the same prototype rejects indiscriminate watcher rules and incorrect order", () => {
  const stage = load("repeat-sequence");
  for (const source of [
    "こいんとる\nすいっちおす",
    "3かいくりかえす\nすいっちおす\nこいんとる\nおわり",
  ]) {
    const result = play(stage, source);
    assert.equal(result.status, "failed", source);
    assert.equal(result.failureReason, "trap", source);
  }
  const insufficient = play(stage, "2かいくりかえす\nこいんとる\nすいっちおす\nおわり");
  assert.equal(insufficient.status, "failed");
  assert.equal(insufficient.failureReason, "door");
});
