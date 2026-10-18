import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("../app/components/game/RankingPanel.vue", import.meta.url), "utf8");

test("ランキング切り替えで前のスコープの記録を残さない", () => {
  assert.match(panel, /const id = \+\+generation;[\s\S]*?rows\.value = \[\];/);
  assert.match(panel, /if \(!props\.apiBase\) \{[\s\S]*?loading\.value = false;[\s\S]*?return;/);
  assert.match(panel, /\(\) => props\.stageVersion/);
  assert.match(panel, /\(\) => props\.apiBase/);
  assert.match(panel, /if \(id === generation\) rows\.value = result\.rows/);
});
