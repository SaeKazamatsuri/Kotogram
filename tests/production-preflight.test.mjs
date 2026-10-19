import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateProductionConfig } from "../scripts/preflight-production.mjs";

const current = JSON.parse(readFileSync(new URL("../wrangler.api.jsonc", import.meta.url), "utf8"));

test("production deploy must use the official HTTPS origin", () => {
  const valid = validateProductionConfig(current);
  assert.equal(valid.ok, true);
  for (const unsafe of ["http://kotogram.sae-chan.net", "https://configure-your-site.example", "https://localhost", "https://kotogram.sae-chan.net/path", "https://unrelated.example.org"]) {
    const broken = structuredClone(current);
    broken.env.production.vars.ALLOWED_ORIGIN = unsafe;
    assert.equal(validateProductionConfig(broken).ok, false, unsafe);
  }
});

test("preflight checks production isolation and SQLite DO bindings", () => {
  const config = structuredClone(current);
  config.env.production.vars.ALLOWED_ORIGIN = "https://kotogram.sae-chan.net";
  assert.equal(validateProductionConfig(config).ok, true);
  config.env.production.name = config.name;
  assert.ok(validateProductionConfig(config).problems.some((msg) => msg.includes("distinct")));
  config.env.production.name = "kotogram-api";
  config.env.production.durable_objects.bindings = [];
  assert.ok(validateProductionConfig(config).problems.some((msg) => msg.includes("DO binding")));
  config.env.production.durable_objects.bindings = current.env.production.durable_objects.bindings;
  config.env.production.migrations = [];
  assert.ok(validateProductionConfig(config).problems.some((msg) => msg.includes("SQLite")));
});

test("production API domain must remain mapped to the existing ranking Worker", () => {
  const copy = structuredClone(current);
  assert.equal(copy.env.production.name, "kotogram-api");
  assert.deepEqual(copy.env.production.routes, [{ pattern: "kotogram-api.sae-chan.net", custom_domain: true }]);
  copy.env.production.routes = [];
  assert.ok(validateProductionConfig(copy).problems.some((msg) => msg.includes("custom domain")));
  copy.env.production.routes = [{ pattern: "kotogram.sae-chan.net", custom_domain: true }];
  assert.equal(validateProductionConfig(copy).ok, false);
});

test("production API never re-enables workers.dev or preview URLs", () => {
  assert.equal(current.env.production.workers_dev, false);
  assert.equal(current.env.production.preview_urls, false);
  for (const field of ["workers_dev", "preview_urls"]) {
    for (const unsafe of [true, undefined]) {
      const changed = structuredClone(current);
      changed.env.production[field] = unsafe;
      assert.equal(validateProductionConfig(changed).ok, false, field + ": " + unsafe);
    }
  }
});
