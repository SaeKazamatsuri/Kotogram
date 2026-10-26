import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram, tokenizeLine } from "../app/language/parser.ts";
import { GAME, aimedJumpRange, createGame, stepGame } from "../app/game/core.ts";
import { analyzeJumpTrajectories } from "../app/game/trajectory.ts";
import { syntaxPieces, TOKEN_CLASS } from "../app/editor/syntax-colors.ts";
import { inspectGameObject } from "../app/game/object-inspection.ts";

const loadStage = (id) => JSON.parse(readFileSync(new URL("../public/stages/" + id + ".json", import.meta.url), "utf8"));

test("wall jump apex follows the obstacle center at normal, running, and sprint speed", () => {
  for (const command of ["", "はしる\n", "めっちゃはしる\n"]) {
    const stage = loadStage("stage-1");
    const speed = stage.scrollSpeed * (command.includes("めっちゃ") ? GAME.sprintMultiplier : command ? GAME.runMultiplier : 1);
    const result = analyzeJumpTrajectories(stage, analyzeProgram(command + "かべじゃんぷ").program);
    assert.equal(result.status, "cleared", command);
    assert.equal(result.jumps.length, 3);
    for (const jump of result.jumps) {
      assert.equal(jump.target?.type, "wall");
      const playerCenterAtPeak = jump.peakFrontX - GAME.playerWidth / 2;
      assert.ok(Math.abs(playerCenterAtPeak - jump.target.center) <= speed + 2, JSON.stringify({ command, jump }));
    }
    assert.ok(aimedJumpRange(speed, GAME.wallWidth) > 0);
  }
});

test("centered holes line up the character midpoint rather than the front of the hitbox", () => {
  const stage = loadStage("stage-3");
  const result = analyzeJumpTrajectories(stage, analyzeProgram("かべとあなとぶ\nおばけしゃがむ").program);
  assert.equal(result.status, "cleared");
  for (const jump of result.jumps.filter(item => item.target?.type === "hole")) {
    const delta = jump.peakFrontX - GAME.playerWidth / 2 - jump.target.center;
    assert.ok(Math.abs(delta) <= stage.scrollSpeed + 2, JSON.stringify(jump));
  }
});

test("syntax segments preserve source and encode roles beyond color alone", () => {
  for (const source of ["かべをまえにみつけたらじゃんぷする", "あかいまるぼたんをおす", "3かいくりかえす", " みどりとほしぼたんをみおくる"]) {
    const pieces = syntaxPieces(source, tokenizeLine(source, 1));
    assert.equal(pieces.map(piece => piece.text).join(""), source);
    assert.ok(pieces.every(piece => TOKEN_CLASS[piece.kind]));
  }
  const pieces = syntaxPieces("あかいまるぼたんをおす", tokenizeLine("あかいまるぼたんをおす", 1));
  assert.ok(pieces.some(piece => piece.kind === "attribute"));
  assert.ok(pieces.some(piece => piece.kind === "condition"));
  assert.ok(pieces.some(piece => piece.kind === "action"));
  assert.match(TOKEN_CLASS.condition, /underline/);
  assert.match(TOKEN_CLASS.attribute, /underline/);
});

test("hover hitboxes follow scrolling and distinguish wall, hole, switch, and ghost", () => {
  const game = createGame({ goal: 1500, objects: [
    { type: "wall", position: 600 },
    { type: "hole", position: 800, width: 100 },
    { type: "switch", id: "sw", position: 520, color: "red", shape: "cross", targetDoorId: "gate" },
    { type: "door", id: "gate", position: 1000 },
    { type: "ghost", position: 680 },
  ] });
  game.px = GAME.playerScreenX + 500;
  assert.equal(inspectGameObject(game, 114, 230)?.name, "かべ");
  assert.equal(inspectGameObject(game, 330, 310)?.name, "あな");
  assert.equal(inspectGameObject(game, 20, 250)?.name, "あかのばつボタン");
  assert.equal(inspectGameObject(game, 200, 180)?.name, "おばけ");
  assert.equal(inspectGameObject(game, 700, 0), null);
  assert.equal(inspectGameObject(game, Number.NaN, 200), null);
});

test("inspection follows rendered coin, key, wind and vertical-platform geometry", () => {
  const game = createGame({ goal: 2500, objects: [
    { type: "coin", position: 600 },
    { type: "key", position: 700 },
    { type: "wind", position: 900, width: 100, multiplier: 0.8 },
    { type: "verticalPlatform", position: 1100, width: 80, topY: 170, travelY: 30, period: 120 },
  ] });
  game.px = GAME.playerScreenX + 500;
  assert.equal(inspectGameObject(game, 100, 258)?.name, "コイン");
  assert.equal(inspectGameObject(game, 222, 241)?.name, "かぎ");
  assert.equal(inspectGameObject(game, 450, 135)?.name, "風");
  assert.equal(inspectGameObject(game, 640, 170)?.name, "上下する足場");
  assert.equal(inspectGameObject(game, 450, 125), null);
});

test("power jumps peak over vaultable door centers at normal and sprint pace", () => {
  for (const prefix of ["", "めっちゃはしる\n"]) {
    const stage = { goal: 960, scrollSpeed: 3, objects: [
      { type: "door", id: "gate", position: 500, vaultable: true },
    ] };
    const parsed = analyzeProgram(prefix + "とびらすごいじゃんぷ");
    assert.deepEqual(parsed.diagnostics, []);
    const game = createGame(stage, parsed.program);
    let peakY = Infinity;
    let peakCenterX = 0;
    while (game.status === "running" && game.elapsedTicks < 1000) {
      stepGame(game);
      if (game.py < peakY) {
        peakY = game.py;
        peakCenterX = game.px + GAME.playerWidth / 2;
      }
    }
    assert.equal(game.status, "cleared", prefix);
    const gateCenter = 500 + GAME.doorWidth / 2;
    assert.ok(Math.abs(peakCenterX - gateCenter) <= game.vx + 2, JSON.stringify({ prefix, peakCenterX, gateCenter }));
    assert.equal(game.doors[0].vaulted, true);
  }
});
