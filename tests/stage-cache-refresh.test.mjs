import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("stage loader uses finite TTL for both manifest and level assets", () => {
  const source = readFileSync(new URL("../app/composables/useStageLoader.ts", import.meta.url), "utf8");
  assert.match(source, /stageCacheTtlMs = 300000/);
  assert.match(source, /get<StageManifest>\(manifestPath, \{ ttlMs: stageCacheTtlMs \}\)/);
  assert.match(source, /get<StageData>\(item.file, \{ version: manifest.version, ttlMs: stageCacheTtlMs \}\)/);
  assert.doesNotMatch(source, /if \(manifestCache\) return manifestCache/);
});
