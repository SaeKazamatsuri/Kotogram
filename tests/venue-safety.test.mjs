import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("admin route cannot silently mark every stage as cleared", () => {
  const admin = readFileSync(new URL("../app/pages/admin.vue", import.meta.url), "utf8");
  assert.doesNotMatch(admin, /stageClear\s*\(/);
  assert.doesNotMatch(admin, /onMounted\s*\(/);
});

test("shared-device reset asks for explicit confirmation", () => {
  const home = readFileSync(new URL("../app/pages/index.vue", import.meta.url), "utf8");
  assert.match(home, /window\.confirm\(/);
  assert.match(home, /つぎのひと/);
});

test("font scaling controls no longer appear in the shared layout", () => {
  const layout = readFileSync(new URL("../app/layouts/default.vue", import.meta.url), "utf8");
  assert.doesNotMatch(layout, /useUiPrefs|fontScale|文字サイズ/);
});

test("changing stages remounts the editor and ignores stale ranking submissions", () => {
  const play = readFileSync(new URL("../app/pages/play/[stageId].vue", import.meta.url), "utf8");
  assert.match(play, /<CommandEditor\s+:key="stageId"/);
  assert.match(play, /const session = sessionGeneration/);
  assert.match(play, /if \(session !== sessionGeneration\) return/);
  assert.match(play, /if \(session !== sessionGeneration\) return;\s*savedName\.value/);
});

test("stage loader never substitutes a playable placeholder for unavailable assets", () => {
  const loader = readFileSync(new URL("../app/composables/useStageLoader.ts", import.meta.url), "utf8");
  assert.doesNotMatch(loader, /goal:\s*800/);
  assert.match(loader, /throw new Error\("ステージを よみこめなかったよ/);
});
