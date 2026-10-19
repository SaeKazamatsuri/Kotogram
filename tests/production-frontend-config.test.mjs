import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("公開サイトのWorker名とSPAルーティングが固定されている", () => {
  const frontend = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  const api = JSON.parse(readFileSync(new URL("../wrangler.api.jsonc", import.meta.url), "utf8"));
  assert.equal(frontend.name, "kotogram");
  assert.equal(frontend.workers_dev, false);
  assert.equal(frontend.preview_urls, false);
  assert.equal(frontend.assets.directory, "./.output/public");
  assert.equal(frontend.assets.not_found_handling, "single-page-application");
  assert.notEqual(frontend.name, api.env.production.name);
  assert.equal(api.env.production.vars.ALLOWED_ORIGIN, "https://kotogram.sae-chan.net");
  assert.deepEqual(api.env.production.routes, [{ pattern: "kotogram-api.sae-chan.net", custom_domain: true }]);
  assert.equal(api.env.production.name, "kotogram-api");
  const nuxt = readFileSync(new URL("../nuxt.config.ts", import.meta.url), "utf8");
  assert.match(nuxt, /https:\/\/kotogram-api\.sae-chan\.net/);
});
