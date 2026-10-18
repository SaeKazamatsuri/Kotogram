import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { countSourceCharacters, ENGINE_VERSION, LANGUAGE_VERSION, SCORING_VERSION, SEASON_ID } from "../app/scoring/score.ts";

const base = process.env.WORKER_API_BASE ?? "http://127.0.0.1:8787";
const scope = {
  seasonId: SEASON_ID,
  stageId: "stage-1",
  stageVersion: "2025-10-26",
  engineVersion: ENGINE_VERSION,
  languageVersion: LANGUAGE_VERSION,
  scoringVersion: SCORING_VERSION,
};

async function ready() {
  for (let i = 0; i < 90; i++) {
    try {
      const result = await fetch(base + "/api/health");
      if (result.ok && (await result.json()).ok === true) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Wrangler dev was not ready within 45 seconds");
}

async function post(input) {
  const response = await fetch(base + "/api/results", {
    method: "POST",
    headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return { status: response.status, body: await response.json() };
}

function run(playerId, source, ticks) {
  return {
    ...scope,
    runId: randomUUID(),
    playerId,
    nickname: "",
    source,
    elapsedTicks: ticks,
    charCount: countSourceCharacters(source),
  };
}

async function ranking(type) {
  const query = new URLSearchParams({ ...scope, type, limit: "20" });
  const response = await fetch(base + "/api/stages/stage-1/rankings?" + query, {
    headers: { Origin: "http://localhost:3000" },
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.type, type);
  return data.rows;
}

await ready();

const playerA = randomUUID();
const playerB = randomUUID();
const playerC = randomUUID();

const aFirst = run(playerA, "かべとぶ", 712);
const first = await post(aFirst);
assert.equal(first.status, 201);
assert.match(first.body.nickname, /^ゲスト\d+$/);

const duplicate = await post(aFirst);
assert.equal(duplicate.status, 200);
assert.equal(duplicate.body.duplicate, true);
assert.equal(duplicate.body.nickname, first.body.nickname);

const conflict = await post({ ...aFirst, elapsedTicks: 711 });
assert.equal(conflict.status, 409);

const [second, third] = await Promise.all([
  post(run(playerB, "かべとぶ", 712)),
  post(run(playerC, "まえにかべがあったらじゃんぷ", 712)),
]);
assert.equal(second.status, 201);
assert.equal(third.status, 201);
assert.match(second.body.nickname, /^ゲスト\d+$/);
assert.match(third.body.nickname, /^ゲスト\d+$/);
assert.equal(new Set([first.body.nickname, second.body.nickname, third.body.nickname]).size, 3);

const aFaster = run(playerA, "はしる\nかべとぶ", 548);
const faster = await post(aFaster);
assert.equal(faster.status, 201);
assert.equal(faster.body.nickname, first.body.nickname);

const fakeTicks = await post(run(randomUUID(), "かべとぶ", 1));
assert.equal(fakeTicks.status, 400);
const cannotClear = await post(run(randomUUID(), "はしる", 548));
assert.equal(cannotClear.status, 400);

const time = await ranking("time");
const chars = await ranking("chars");
const overall = await ranking("overall");
assert.equal(time.length, 3);
assert.equal(chars.length, 3);
assert.equal(overall.length, 3);
assert.equal(time[0].runId, aFaster.runId);
assert.equal(chars.some((entry) => entry.runId === aFirst.runId), true);
assert.equal(chars.some((entry) => entry.runId === aFaster.runId), false);
assert.equal(overall.some((entry) => entry.runId === aFirst.runId), true);
assert.equal(overall.some((entry) => entry.runId === aFaster.runId), false);
assert.equal(time.some((entry) => "source" in entry || "playerId" in entry), false);

const coinRun = { ...run(randomUUID(), "こいんとる\nかべとぶ", 512), stageId: "stage-6" };
assert.equal((await post(coinRun)).status, 201);
assert.equal((await post({ ...coinRun, runId: randomUUID(), elapsedTicks: 511 })).status, 400);

const blocked = await fetch(base + "/api/health", { headers: { Origin: "https://not-allowed.example" } });
assert.equal(blocked.status, 403);

console.log("Worker SQLite DO smoke passed: idempotency, unique guests, independent bests, CORS");
