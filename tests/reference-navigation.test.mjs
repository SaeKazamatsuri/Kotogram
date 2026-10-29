import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const appDir = fileURLToPath(new URL("../app/", import.meta.url));

function vueFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return vueFiles(path);
    return entry.isFile() && entry.name.endsWith(".vue") ? [path] : [];
  });
}

test("ゲーム画面にreferenceへのリンクを作らない", () => {
  for (const path of vueFiles(appDir)) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /(?:to|href)\s*=\s*["']\/reference(?:\/|[?"'#])/i, path);
  }
});

test("ステージの使える言葉と案内は残す", () => {
  const editor = readFileSync(join(appDir, "components/editor/CommandEditor.vue"), "utf8");
  const guide = readFileSync(join(appDir, "components/game/StageOneGuide.vue"), "utf8");
  assert.match(editor, /data-tour-target="dictionary"/);
  assert.match(editor, /aria-label="使える言葉の辞書"/);
  assert.match(guide, /stage-guide__actions/);
});
