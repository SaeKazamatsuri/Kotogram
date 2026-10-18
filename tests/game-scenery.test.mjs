import test from "node:test";
import assert from "node:assert/strict";
import { layerX, resolveScenePalette } from "../app/game/scenery.ts";

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
