import test from "node:test";
import assert from "node:assert/strict";
import { clearKeyboardPreferences, getKeyboardExpanded, setKeyboardExpanded } from "../app/editor/keyboard-preferences.ts";

function createStorage() {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
    items,
  };
}

test("初回は閉じ、コード用とランキング用の開閉を別々に保存する", () => {
  const storage = createStorage();
  assert.equal(getKeyboardExpanded("code", storage), false);
  assert.equal(getKeyboardExpanded("nickname", storage), false);
  setKeyboardExpanded("code", true, storage);
  assert.equal(getKeyboardExpanded("code", storage), true);
  assert.equal(getKeyboardExpanded("nickname", storage), false);
  setKeyboardExpanded("nickname", true, storage);
  setKeyboardExpanded("code", false, storage);
  assert.equal(getKeyboardExpanded("code", storage), false);
  assert.equal(getKeyboardExpanded("nickname", storage), true);
});

test("次の人へでは開閉状態のみを削除する", () => {
  const storage = createStorage();
  storage.setItem("other-site", "keep");
  setKeyboardExpanded("code", true, storage);
  setKeyboardExpanded("nickname", true, storage);
  clearKeyboardPreferences(storage);
  assert.equal(getKeyboardExpanded("code", storage), false);
  assert.equal(getKeyboardExpanded("nickname", storage), false);
  assert.equal(storage.getItem("other-site"), "keep");
});

test("セッションストレージが使えない場合も閉じた状態で安全に動作する", () => {
  const unavailable = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  assert.equal(getKeyboardExpanded("code", unavailable), false);
  assert.doesNotThrow(() => setKeyboardExpanded("nickname", true, unavailable));
  assert.doesNotThrow(() => clearKeyboardPreferences(unavailable));
});
