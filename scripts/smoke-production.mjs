import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { FRONTEND_ORIGIN, PRODUCTION_API_ORIGIN, validateFrontendApiBase } from "./preflight-frontend.mjs";

export async function runProductionSmoke(apiBase, fetcher = fetch, publicOrigin = FRONTEND_ORIGIN) {
  const validated = validateFrontendApiBase(apiBase);
  assert.equal(validated.ok, true, validated.errors.join(" "));
  const workerBase = validated.origin;

  async function check(label, url, options = {}) {
    const response = await fetcher(url, {
      ...options,
      signal: AbortSignal.timeout(12000),
    });
    assert.equal(response.ok, true, label + ": HTTP " + response.status);
    return response;
  }

  for (const path of ["/", "/stages", "/play/stage-1"]) {
    const page = await check("ゲーム画面 " + path, publicOrigin + path);
    assert.match(page.headers.get("content-type") ?? "", /text\/html/, path);
  }

  const manifestResponse = await check("ステージ一覧", publicOrigin + "/stages/manifest.json");
  const manifest = await manifestResponse.json();
  assert.ok(typeof manifest.version === "string" && manifest.version.length > 0);
  assert.ok(manifest.stages?.some((stage) => stage.id === "stage-1"));

  const stageResponse = await check("最初のステージ", publicOrigin + "/stages/stage-1.json");
  const stage = await stageResponse.json();
  assert.ok(Array.isArray(stage.objects) || typeof stage.goal === "number");

  const headers = { Origin: publicOrigin };
  const healthResponse = await check("ランキングAPI", workerBase + "/api/health", { headers });
  assert.equal(healthResponse.headers.get("access-control-allow-origin"), publicOrigin);
  const health = await healthResponse.json();
  assert.equal(health.ok, true);
  assert.equal(health.service, "kotogram-api");
  const versions = health.versions ?? {};
  for (const key of ["seasonId", "engineVersion", "languageVersion", "scoringVersion"]) {
    assert.ok(typeof versions[key] === "string" && versions[key].length > 0, "missing " + key);
  }

  const preflight = await check("ランキング登録の事前確認", workerBase + "/api/results", {
    method: "OPTIONS",
    headers: {
      Origin: publicOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  assert.equal(preflight.headers.get("access-control-allow-origin"), publicOrigin);
  assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /POST/i);

  for (const type of ["time", "chars", "overall"]) {
    const query = new URLSearchParams({
      ...versions,
      stageId: "stage-1",
      stageVersion: manifest.version,
      type,
      limit: "5",
    });
    const response = await check("ランキング " + type, workerBase + "/api/stages/stage-1/rankings?" + query, { headers });
    assert.equal(response.headers.get("access-control-allow-origin"), publicOrigin);
    const result = await response.json();
    assert.equal(result.ok, true);
    assert.equal(result.type, type);
    assert.ok(Array.isArray(result.rows));
  }

  return { publicOrigin, workerBase, stageVersion: manifest.version };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = process.env.PRODUCTION_RANKING_API_BASE || process.env.NUXT_PUBLIC_RANKING_API_BASE || PRODUCTION_API_ORIGIN;
  if (!base) {
    console.error("本番ランキングAPIのURLをPRODUCTION_RANKING_API_BASEまたはNUXT_PUBLIC_RANKING_API_BASEに設定してください。");
    process.exitCode = 2;
  } else {
    try {
      const result = await runProductionSmoke(base);
      console.log("本番読み取り検査に成功:", result);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
