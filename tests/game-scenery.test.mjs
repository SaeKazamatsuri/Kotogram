import test from "node:test";
import assert from "node:assert/strict";
import { layerX, resolveScenePalette, PARALLAX_DEPTH } from "../app/game/scenery.ts";
import { createGame } from "../app/game/core.ts";
import { renderGameFrame } from "../app/game/renderer.ts";

test("stage moods have legible differentiated palettes and safe defaults", () => {
  assert.notDeepEqual(resolveScenePalette("twilight"), resolveScenePalette("day"));
  assert.notDeepEqual(resolveScenePalette("sunset"), resolveScenePalette("day"));
  assert.deepEqual(resolveScenePalette("unexpected"), resolveScenePalette("day"));
});

test("decorative parallax is deterministic and independent from game physics", () => {
  for (const depth of [0.06, 0.11, 0.24, 1]) {
    const first = layerX(3, 738, 126, depth, 720);
    assert.equal(first, layerX(3, 738, 126, depth, 720));
    assert.ok(first >= 0);
    assert.ok(first < 1008);
  }
  assert.notEqual(layerX(3, 738, 126, 0.11, 720), layerX(3, 738, 126, 1, 720));
});

test("昼には星を描かず夕方から夜へ星を増やし木のハイライトを統一する", () => {
  assert.equal(resolveScenePalette("day").starCount, 0);
  assert.ok(resolveScenePalette("sunset").starCount < resolveScenePalette("twilight").starCount);
  for (const bg of ["day", "sunset", "twilight"]) {
    const palette = resolveScenePalette(bg);
    assert.notEqual(palette.treeLight, palette.trees);
    assert.notEqual(palette.groundRim, palette.ground);
  }
  assert.ok(PARALLAX_DEPTH.farHill < PARALLAX_DEPTH.nearHill);
  assert.ok(PARALLAX_DEPTH.nearHill < PARALLAX_DEPTH.ground);
});

test("動きを減らす場合は装飾粒子を省き公式のゲーム状態を維持する", () => {
  const game = createGame({ goal: 800 });
  const before = JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value);
  const run = (reduced) => {
    const events = [];
    const ctx = new Proxy({}, {
      get(target, key) {
        if (key === "createLinearGradient") return () => ({ addColorStop() {} });
        return target[key] ?? ((...args) => events.push([key, ...args]));
      },
      set(target, key, value) { target[key] = value; return true; },
    });
    renderGameFrame(ctx, game, resolveScenePalette("day"), 100, false, 1, reduced);
    return events;
  };
  assert.ok(run(false).filter(([method]) => method === "arc").length > run(true).filter(([method]) => method === "arc").length);
  assert.equal(JSON.stringify(game, (_key, value) => value instanceof Set ? [...value] : value), before);
});
