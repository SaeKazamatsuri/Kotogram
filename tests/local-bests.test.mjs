import test from "node:test";
import assert from "node:assert/strict";
import { useStats } from "../app/composables/useStats.ts";

function mockStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  };
}

test("stores each of the three local bests separately under a versioned key", () => {
  const storage = mockStorage();
  globalThis.window = { localStorage: storage };
  const stats = useStats();
  stats.stageClear("stage-1", 20, 20, 700, "かべとぶ", "2025-10-26");
  stats.stageClear("stage-1", 4, 20, 1200, "かべとぶ", "2025-10-26");
  stats.stageClear("stage-1", 5, 20, 750, "かべとぶ", "2025-10-26");
  const best = stats.getBestRecords("stage-1", "2025-10-26");
  assert.equal(best.time.elapsedTicks, 700);
  assert.equal(best.chars.charCount, 4);
  assert.equal(best.overall.elapsedTicks, 750);
  assert.deepEqual(stats.getBestRecords("stage-1", "other"), {});
  assert.equal(stats.isCleared("stage-1"), true);
  assert.equal(stats.getAll()["stage-1"].elapsedTicks, 750);
  delete globalThis.window;
});

test("reset only clears kotogram owned keys; unrelated browser data survives", () => {
  const storage = mockStorage();
  storage.setItem("unrelated.setting", "keep");
  storage.setItem("kotogram.stats", "{}");
  storage.setItem("kotogram.bests", "{}");
  globalThis.window = { localStorage: storage };
  useStats().reset();
  assert.equal(storage.getItem("unrelated.setting"), "keep");
  assert.equal(storage.getItem("kotogram.stats"), null);
  assert.equal(storage.getItem("kotogram.bests"), null);
  delete globalThis.window;
});
