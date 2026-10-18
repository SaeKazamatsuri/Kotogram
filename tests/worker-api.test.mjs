import test from "node:test";
import assert from "node:assert/strict";
import { handleApi } from "../worker/router.mjs";
import { validateRunPayload, scopeObjectId } from "../worker/validation.mjs";
import { ENGINE_VERSION, LANGUAGE_VERSION, SCORING_VERSION, SEASON_ID } from "../app/scoring/score.ts";

const scope = {
  seasonId: SEASON_ID, stageId: "stage-1", stageVersion: "2025-10-26",
  engineVersion: ENGINE_VERSION, languageVersion: LANGUAGE_VERSION, scoringVersion: SCORING_VERSION,
};
const payload = () => ({
  ...scope, runId: "00000000-0000-4000-8000-000000000001",
  playerId: "00000000-0000-4000-8000-000000000002",
  nickname: "", source: "かべとぶ", elapsedTicks: 712, charCount: 4,
});

test("validates stage and version, source metric, bounds and nickname", () => {
  assert.equal(validateRunPayload(payload()).charCount, 4);
  assert.throws(() => validateRunPayload({ ...payload(), charCount: 3 }), /charCount/);
  assert.throws(() => validateRunPayload({ ...payload(), stageVersion: "old" }), /scope/);
  assert.throws(() => validateRunPayload({ ...payload(), nickname: "a".repeat(17) }), /nickname/);
  assert.throws(() => validateRunPayload({ ...payload(), nickname: "<script>" }), /nickname/);
  assert.throws(() => validateRunPayload({ ...payload(), elapsedTicks: 0 }), /elapsedTicks/);
  assert.notEqual(scopeObjectId(scope), scopeObjectId({ ...scope, stageId: "stage-2" }));
});

function mockEnv() {
  const saved = new Map();
  let next = 0;
  const ranking = {
    findRun: async (runId) => saved.get(runId) ?? null,
    nameForPlayer: async () => null,
    save: async (run) => { saved.set(run.runId, run); return { runId: run.runId, nickname: run.nickname, best: {} }; },
    rankings: async () => [...saved.values()].map((run) => ({ rank: 1, nickname: run.nickname })),
  };
  return {
    ALLOWED_ORIGIN: "http://localhost:3000",
    COUNTER: { idFromName: (key) => key, get: () => ({ nextGuest: async () => ++next }) },
    RANKING: { idFromName: (key) => key, get: () => ranking },
  };
}
const request = (path, body, origin = "http://localhost:3000") => new Request("https://api.example" + path, {
  method: body ? "POST" : "GET",
  headers: { Origin: origin, ...(body ? { "Content-Type": "application/json" } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

test("API creates a guest and retrying the same run is idempotent", async () => {
  const env = mockEnv();
  const first = await handleApi(request("/api/results", payload()), env);
  assert.equal(first.status, 201);
  const data = await first.json();
  assert.equal(data.nickname, "ゲスト1");
  const replay = await handleApi(request("/api/results", payload()), env);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).nickname, "ゲスト1");
  assert.equal((await replay.json().catch(() => ({}))).nickname, undefined);
});

test("conflicting reused runId is rejected", async () => {
  const env = mockEnv();
  await handleApi(request("/api/results", payload()), env);
  const result = await handleApi(request("/api/results", { ...payload(), elapsedTicks: 711 }), env);
  assert.equal(result.status, 409);
});

test("health, ranking query, unsupported origin and invalid payload", async () => {
  const env = mockEnv();
  const health = await handleApi(request("/api/health"), env);
  assert.equal((await health.json()).ok, true);
  const params = new URLSearchParams({ ...scope, type: "overall" });
  const ranking = await handleApi(request("/api/stages/stage-1/rankings?" + params), env);
  assert.equal((await ranking.json()).type, "overall");
  assert.equal((await handleApi(request("/api/health", null, "https://other.example"), env)).status, 403);
  assert.equal((await handleApi(request("/api/results", { ...payload(), source: "not valid" }), env)).status, 400);
});
