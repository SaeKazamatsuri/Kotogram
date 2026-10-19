import test from "node:test";
import assert from "node:assert/strict";
import { createScope, getOrCreatePlayerId, RankingClient } from "../app/ranking/client.ts";
import { ENGINE_VERSION, SCORING_VERSION, SEASON_ID } from "../app/scoring/score.ts";

test("ranking scope transmits the same rule versions as scoring", () => {
  const scope = createScope("stage-1", "2025-10-26");
  assert.equal(scope.stageId, "stage-1");
  assert.equal(scope.seasonId, SEASON_ID);
  assert.equal(scope.engineVersion, ENGINE_VERSION);
  assert.equal(scope.scoringVersion, SCORING_VERSION);
});

test("player ID stays stable across attempts and changes on reset", () => {
  const items = new Map();
  const storage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
  };
  let calls = 0;
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const a = getOrCreatePlayerId(storage, () => id(++calls));
  const b = getOrCreatePlayerId(storage, () => id(++calls));
  assert.equal(a, b);
  assert.equal(calls, 1);
  items.delete("kotogram.player");
  assert.notEqual(getOrCreatePlayerId(storage, () => id(++calls)), a);
});

test("malformed persisted IDs are rotated and generated IDs must be UUIDv4", () => {
  const items = new Map([["kotogram.player", "------------------------------------"]]);
  const storage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
  };
  const valid = "11111111-2222-4333-8aaa-000000000001";
  assert.equal(getOrCreatePlayerId(storage, () => valid), valid);
  assert.equal(items.get("kotogram.player"), valid);
  items.delete("kotogram.player");
  assert.throws(() => getOrCreatePlayerId(storage, () => "11111111-2222-2333-8aaa-000000000001"), /invalid/);
  assert.equal(items.get("kotogram.player"), undefined);
});

test("submit sends payload unchanged and includes content type", async () => {
  let captured;
  const mock = async (url, init) => {
    captured = { url, init };
    return { ok: true, json: async () => ({ ok: true, nickname: "ゲスト1", runId: "x", duplicate: false }) };
  };
  const client = new RankingClient("http://localhost:8787/", mock);
  const input = { ...createScope("stage-1", "2025-10-26"), runId: "x", playerId: "y", nickname: "", elapsedTicks: 712, charCount: 4, source: "かべとぶ" };
  const output = await client.submit(input);
  assert.equal(output.nickname, "ゲスト1");
  assert.equal(captured.url, "http://localhost:8787/api/results");
  assert.deepEqual(JSON.parse(captured.init.body), input);
  assert.equal(captured.init.headers["Content-Type"], "application/json");
});

test("leaderboard query sends a versioned scope and requested metric", async () => {
  let url;
  let headers;
  const client = new RankingClient("http://localhost:8787", async (input, init) => {
    url = new URL(input);
    headers = init.headers;
    return { ok: true, json: async () => ({ ok: true, rows: [], type: "overall" }) };
  });
  await client.list(createScope("stage-2", "2025-10-26"), "overall");
  assert.equal(url.pathname, "/api/stages/stage-2/rankings");
  assert.equal(url.searchParams.get("type"), "overall");
  assert.equal(url.searchParams.get("engineVersion"), ENGINE_VERSION);
  assert.equal(headers, undefined);
});

test("offline errors do not destroy client data or trigger automatic retries", async () => {
  const client = new RankingClient("http://localhost:8787", async () => ({ ok: false, status: 503 }));
  await assert.rejects(() => client.list(createScope("stage-1", "2025-10-26"), "time"), /ranking_api_unavailable/);
  await assert.rejects(() => new RankingClient("", async () => { throw new Error("not called"); }).list(createScope("stage-1", "v"), "time"), /not configured/);
});

test("default browser fetch keeps its global receiver", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = function(input, init) {
    assert.equal(this, globalThis);
    calls.push({ input, init });
    return Promise.resolve(new Response(JSON.stringify({ ok: true, nickname: "ゲスト1", runId: "x", duplicate: false }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }));
  };
  try {
    const client = new RankingClient("http://localhost:8787");
    const submission = { ...createScope("stage-1", "2025-10-26"), runId: "x", playerId: "y", nickname: "", elapsedTicks: 712, charCount: 4, source: "かべとぶ" };
    const result = await client.submit(submission);
    assert.equal(result.nickname, "ゲスト1");
    assert.equal(calls.length, 1);
    assert.match(calls[0].input, /\/api\/results$/);
  } finally {
    globalThis.fetch = original;
  }
});

test("network timeout ends the pending submission so it can be retried", async () => {
  let attempts = 0;
  const mock = (url, init) => {
    attempts++;
    if (attempts === 2) {
      return Promise.resolve(new Response(JSON.stringify({
        ok: true, nickname: "ゲスト1", runId: "test-run", duplicate: true,
      }), { status: 200 }));
    }
    return new Promise((_resolve, reject) => {
      assert.ok(init.signal instanceof AbortSignal);
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    });
  };
  const client = new RankingClient("https://kotogram-api.sae-chan.net", mock, 25);
  const input = { ...createScope("stage-1", "2025-10-26"), runId: "test-run", playerId: "player", nickname: "", source: "かべとぶ", elapsedTicks: 712, charCount: 4 };
  const keepEventLoopAlive = setTimeout(() => {}, 250);
  try {
    await assert.rejects(() => client.submit(input), (error) => error?.name === "TimeoutError");
    const retried = await client.submit(input);
    assert.equal(retried.duplicate, true);
    assert.equal(attempts, 2);
  } finally {
    clearTimeout(keepEventLoopAlive);
  }
});

test("ranking request timeout must be positive, finite and bounded", () => {
  for (const duration of [0, -1, 1.5, Infinity, NaN, 60001]) {
    assert.throws(() => new RankingClient("https://kotogram-api.sae-chan.net", async () => ({}), duration), /invalid ranking API timeout/);
  }
});
