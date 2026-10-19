import test from "node:test";
import assert from "node:assert/strict";
import { validateFrontendApiBase } from "../scripts/preflight-frontend.mjs";

test("本番APIのHTTPS originだけでフロントエンド配備を許可する", () => {
  for (const value of [
    "https://kotogram-api.sae-chan.net",
    " https://kotogram-api.sae-chan.net/ ",
  ]) {
    const result = validateFrontendApiBase(value);
    assert.equal(result.ok, true, value + ": " + result.errors.join(", "));
  }
});

test("ランキングが壊れるURLでは本番へのデプロイを拒否する", () => {
  for (const value of [
    undefined, "", "   ", "http://127.0.0.1:8787",
    "https://localhost:8787", "https://192.168.1.5",
    "https://api.sae-chan.net",
    "https://kotogram-api.matsuda-terumasa-514.workers.dev",
    "https://api.example", "https://configure.invalid",
    "https://kotogram.sae-chan.net",
    "https://api.sae-chan.net/api",
    "https://api.sae-chan.net/?token=abc",
    "https://api.sae-chan.net/#fragment",
    "https://user:password@api.sae-chan.net",
    "https://api.sae-chan.net/other",
  ]) {
    const report = validateFrontendApiBase(value);
    assert.equal(report.ok, false, String(value));
    assert.ok(report.errors.length);
  }
});
