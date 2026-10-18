import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../app/game/core.ts";
import { decorativePhase, drawAmbientEffects, drawSpeedTrail, drawResultEffects } from "../app/game/effects.ts";
import { resolveCharacterMotion } from "../app/game/character.ts";

test("演出位相は指定された描画tickと種から決定し物理時間には影響しない", () => {
  const game = createGame({ goal: 1200 });
  const tick = game.elapsedTicks;
  assert.equal(decorativePhase(4, 300), decorativePhase(4, 300));
  assert.notEqual(decorativePhase(4, 300), decorativePhase(4, 301));
  assert.notEqual(resolveCharacterMotion(game, 0, true).breathe, resolveCharacterMotion(game, 10, true).breathe);
  assert.equal(game.elapsedTicks, tick);
});

test("背景・走行エフェクト・クリア演出は描画専用", () => {
  const game = createGame({ goal: 1200 });
  const before = JSON.stringify(game, (_k, v) => v instanceof Set ? [...v] : v);
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key === "createLinearGradient") return () => ({ addColorStop() {} });
      return target[key] ?? (() => {});
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  drawAmbientEffects(ctx, game, 200);
  drawSpeedTrail(ctx, game, 200, false);
  game.status = "cleared";
  drawResultEffects(ctx, game, 200);
  game.status = "running";
  assert.equal(JSON.stringify(game, (_k, v) => v instanceof Set ? [...v] : v), before);
});
