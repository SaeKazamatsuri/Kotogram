import test from "node:test";
import assert from "node:assert/strict";
import { useAssetJson } from "../app/composables/useAssetJson.ts";

function withStorage(seed) {
  const data = new Map(seed);
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  return { data, storage };
}

test("failed fetch must not use a cached stage from another version", async () => {
  const path = "/stages/stage-1.json";
  const cacheKey = "kotogram.asset:" + path;
  const { storage } = withStorage([[cacheKey, JSON.stringify({
    data: { id: "old-stage" }, version: "v1", savedAt: 0,
  })]]);
  const oldWindow = globalThis.window;
  const oldStorage = globalThis.localStorage;
  const oldFetch = globalThis.fetch;
  globalThis.window = { localStorage: storage };
  globalThis.localStorage = storage;
  globalThis.fetch = async () => { throw new Error("offline"); };
  try {
    await assert.rejects(
      useAssetJson().get(path, { version: "v2", ttlMs: 10 }),
      /Failed to load/,
    );
    assert.deepEqual(await useAssetJson().get(path, { version: "v1", ttlMs: 10 }), { id: "old-stage" });
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
    if (oldStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = oldStorage;
    globalThis.fetch = oldFetch;
  }
});

test("fresh version-matched cached stage is available without a network request", async () => {
  const path = "/stages/stage-2.json";
  const cacheKey = "kotogram.asset:" + path;
  const { storage } = withStorage([[cacheKey, JSON.stringify({
    data: { id: "stage-2" }, version: "v2", savedAt: Date.now(),
  })]]);
  const oldWindow = globalThis.window;
  const oldStorage = globalThis.localStorage;
  const oldFetch = globalThis.fetch;
  globalThis.window = { localStorage: storage };
  globalThis.localStorage = storage;
  globalThis.fetch = async () => { throw new Error("unexpected fetch"); };
  try {
    assert.deepEqual(await useAssetJson().get(path, { version: "v2", ttlMs: 300000 }), { id: "stage-2" });
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
    if (oldStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = oldStorage;
    globalThis.fetch = oldFetch;
  }
});
