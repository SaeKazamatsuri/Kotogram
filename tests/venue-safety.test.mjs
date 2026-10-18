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
