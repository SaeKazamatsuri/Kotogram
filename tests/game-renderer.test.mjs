import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGame } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { renderGameFrame } from "../app/game/renderer.ts";
import { resolveScenePalette } from "../app/game/scenery.ts";

test("描画処理はGameStateを書き換えない", () => {
  const game = createGame({
    goal: 840,
    objects: [
      { type: "wall", position: 260 },
      { type: "ghost", position: 360 },
      { type: "hole", position: 470, width: 80 },
      { type: "coin", position: 530, id: "coin-1" },
      { type: "switch", position: 590, id: "switch-1", targetDoorId: "door-1" },
      { type: "door", position: 660, id: "door-1" },
    ],
  });
  const before = JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value);
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key === "createLinearGradient") return () => ({ addColorStop() {} });
      return target[key] ?? ((...args) => calls.push([key, ...args]));
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  renderGameFrame(ctx, game, resolveScenePalette("sunset"), 120);
  assert.ok(calls.some(([method]) => method === "fillRect"));
  assert.ok(calls.some(([method]) => method === "fillText"));
  assert.equal(JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value), before);
});

test("ステージ8の実行画面にはくりかえしの進行状況を描く", () => {
  const stage = JSON.parse(readFileSync(new URL("../public/stages/stage-8.json", import.meta.url), "utf8"));
  const parsed = analyzeProgram("3かいくりかえす\nこいんとる\nすいっちおす\nおわり");
  assert.deepEqual(parsed.diagnostics, []);
  const game = createGame(stage, parsed.program);
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key === "createLinearGradient") return () => ({ addColorStop() {} });
      return target[key] ?? ((...args) => calls.push([key, ...args]));
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  renderGameFrame(ctx, game, resolveScenePalette("sunset"));
  assert.ok(calls.some(([method, label]) => method === "fillText" && label === "くりかえし 0 / 3"));
  assert.ok(calls.some(([method, label]) => method === "fillText" && label === "こいん 0 / 2"));
});

test("idle preview clouds keep stable coordinates across clock changes", () => {
  const game = createGame({ goal: 2300, objects: [{ type: "wall", position: 600 }] });
  function clouds(view, tick, idle) {
    const ellipses = [];
    const ctx = new Proxy({}, {
      get(target, key) {
        if (key === "createLinearGradient") return () => ({ addColorStop() {} });
        if (key === "ellipse") return (...args) => ellipses.push(args);
        return target[key] ?? (() => {});
      },
      set(target, key, value) { target[key] = value; return true; },
    });
    renderGameFrame(ctx, view, resolveScenePalette("day"), tick, idle);
    return ellipses.slice(0, 18);
  }
  assert.deepEqual(clouds(game, 20, true), clouds(game, 5000, true));
  assert.notDeepEqual(clouds(game, 20, false), clouds(game, 5000, false));
  assert.notDeepEqual(clouds(game, 20, true), clouds({ ...game, px: game.px + 300 }, 20, true));
});
