import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateProductionConfig } from "../scripts/preflight-production.mjs";

const current = JSON.parse(readFileSync(new URL("../wrangler.api.jsonc", import.meta.url), "utf8"));

test("production deploy cannot use a placeholder or development origin", () => {
  const placeholder = validateProductionConfig(current);
  assert.equal(placeholder.ok, false);
  assert.ok(placeholder.problems.some((line) => line.includes("ALLOWED_ORIGIN")));
  for (const unsafe of ["http://kotogram.school.jp", "https://configure-your-site.example", "https://localhost", "https://kotogram.school.jp/path"]) {
    const broken = structuredClone(current);
    broken.env.production.vars.ALLOWED_ORIGIN = unsafe;
    assert.equal(validateProductionConfig(broken).ok, false, unsafe);
  }
});

test("preflight checks production isolation and SQLite DO bindings", () => {
  const config = structuredClone(current);
  config.env.production.vars.ALLOWED_ORIGIN = "https://kotogram.school.jp";
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
