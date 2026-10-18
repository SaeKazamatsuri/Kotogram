import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../app/game/core.ts";
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
  renderGameFrame(ctx, game, resolveScenePalette("sunset"), { player: null, wall: null, ghost: null, goal: null });
  assert.ok(calls.some(([method]) => method === "fillRect"));
  assert.ok(calls.some(([method]) => method === "fillText"));
  assert.equal(JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value), before);
});
