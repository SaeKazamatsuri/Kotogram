import test from "node:test";
import assert from "node:assert/strict";
import { clearClearedStageCodes, getClearedStageCode, saveClearedStageCode } from "../app/stage/cleared-code.ts";

function createStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("クリアしたステージごとのコードを上書きし、別のステージは維持する", () => {
  const storage = createStorage();
  saveClearedStageCode("stage-1", "かべとぶ", storage);
  saveClearedStageCode("stage-2", "はしる\nあなとぶ", storage);
  saveClearedStageCode("stage-1", "かべじゃんぷ", storage);
  assert.equal(getClearedStageCode("stage-1", storage), "かべじゃんぷ");
  assert.equal(getClearedStageCode("stage-2", storage), "はしる\nあなとぶ");
  assert.equal(getClearedStageCode("stage-3", storage), "");
});

test("次の人への切り替えは保存したコードだけを消す", () => {
  const storage = createStorage();
  storage.setItem("another.site.data", "keep");
  saveClearedStageCode("stage-1", "かべとぶ", storage);
  clearClearedStageCodes(storage);
  assert.equal(getClearedStageCode("stage-1", storage), "");
  assert.equal(storage.getItem("kotogram.clearedStageCodes"), null);
  assert.equal(storage.getItem("another.site.data"), "keep");
});

test("保存先が使えず、破損したJSONがあってもゲームが落ちない", () => {
  const storage = createStorage();
  storage.setItem("kotogram.clearedStageCodes", "{broken");
  assert.equal(getClearedStageCode("stage-1", storage), "");
  saveClearedStageCode("stage-1", "かべとぶ", storage);
  assert.equal(getClearedStageCode("stage-1", storage), "かべとぶ");
  const unavailable = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  assert.equal(getClearedStageCode("stage-1", unavailable), "");
  assert.doesNotThrow(() => saveClearedStageCode("stage-1", "かべとぶ", unavailable));
  assert.doesNotThrow(() => clearClearedStageCodes(unavailable));
  assert.equal(getClearedStageCode("bad", storage), "");
  saveClearedStageCode("__proto__", "no", storage);
  assert.equal(getClearedStageCode("__proto__", storage), "");
});
