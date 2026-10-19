import test from "node:test";
import assert from "node:assert/strict";
import { runProductionSmoke } from "../scripts/smoke-production.mjs";

const apiBase = "https://kotogram-api.sae-chan.net";
const origin = "https://kotogram.sae-chan.net";

function fixtureFetcher({ denyCors = false } = {}) {
  const requests = [];
  const respond = (body, status = 200, headers = {}) => new Response(
    body === null ? null : typeof body === "string" ? body : JSON.stringify(body),
    { status, headers },
  );
  const fetcher = async (input, init = {}) => {
    const url = new URL(input);
    requests.push({ path: url.pathname, method: init.method ?? "GET", query: url.searchParams });
    if (url.pathname === "/api/results" && init.method === "OPTIONS") {
      return respond(null, 204, {
        "Access-Control-Allow-Origin": denyCors ? "" : origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      });
    }
    if (url.pathname === "/api/health") {
      return respond({
        ok: true,
        service: "kotogram-api",
        versions: { seasonId: "2026-festival", engineVersion: "engine", languageVersion: "language", scoringVersion: "score" },
      }, 200, { "Access-Control-Allow-Origin": denyCors ? "" : origin });
    }
    if (url.pathname.endsWith("/rankings")) {
      return respond({ ok: true, type: url.searchParams.get("type"), rows: [] }, 200, {
        "Access-Control-Allow-Origin": denyCors ? "" : origin,
      });
    }
    if (url.pathname === "/stages/manifest.json") {
      return respond({ version: "2025-10-26", stages: [{ id: "stage-1", file: "/stages/stage-1.json" }] });
    }
    if (url.pathname === "/stages/stage-1.json") return respond({ goal: 800, objects: [] });
    return respond("<html><body>ことグラム</body></html>", 200, { "Content-Type": "text/html; charset=utf-8" });
  };
  return { fetcher, requests };
}

test("公開後の画面・ステージ・ランキング3種をGET/OPTIONSだけで検査できる", async () => {
  const { fetcher, requests } = fixtureFetcher();
  const result = await runProductionSmoke(apiBase, fetcher);
  assert.equal(result.publicOrigin, origin);
  assert.equal(result.stageVersion, "2025-10-26");
  assert.deepEqual(requests.map((item) => item.method).filter((method) => method !== "GET"), ["OPTIONS"]);
  const rankings = requests.filter((item) => item.path.endsWith("/rankings"));
  assert.deepEqual(rankings.map((item) => item.query.get("type")), ["time", "chars", "overall"]);
  assert.ok(rankings.every((item) => item.query.get("stageVersion") === "2025-10-26"));
});

test("CORS欠落はランキング利用不可として失敗させる", async () => {
  const { fetcher } = fixtureFetcher({ denyCors: true });
  await assert.rejects(() => runProductionSmoke(apiBase, fetcher), /expected|Expected/i);
});
