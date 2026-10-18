import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("描画ライブラリ比較は独立した検証ページにあり、本体から読み込まない", () => {
  const lab = readFileSync(new URL("../public/experiments/renderer-lab.html", import.meta.url), "utf8");
  const game = readFileSync(new URL("../app/components/game/GameCanvas.vue", import.meta.url), "utf8");
  assert.match(lab, /createCanvasDriver/);
  assert.match(lab, /createP5Driver/);
  assert.match(lab, /createPixiDriver/);
  assert.match(lab, /240/);
  assert.doesNotMatch(game, /cdn\.jsdelivr|pixi\.js|p5@/);
});
