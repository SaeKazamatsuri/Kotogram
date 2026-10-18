import assert from "node:assert/strict";

const publicOrigin = "https://kotogram.sae-chan.net";
const workerBase = process.env.PRODUCTION_RANKING_API_BASE?.replace(/\/$/, "");
if (!workerBase) {
  console.error("PRODUCTION_RANKING_API_BASE にデプロイ済みAPIのURLを設定してください。");
  process.exit(2);
}
if (!workerBase.startsWith("https://")) {
  console.error("APIにはHTTPSのURLを指定してください。");
  process.exit(2);
}

async function check(label, url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
  assert.equal(response.ok, true, label + ": HTTP " + response.status);
  return response;
}
const site = await check("トップページ", publicOrigin);
assert.match(site.headers.get("content-type") ?? "", /text\/html/);
const health = await check("ランキングAPI", workerBase + "/api/health", {
  headers: { Origin: publicOrigin },
});
assert.equal(health.headers.get("access-control-allow-origin"), publicOrigin);
const body = await health.json();
assert.ok(body && typeof body === "object");
console.log("本番の読み取りスモーク検査に成功:", publicOrigin, workerBase);
