import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bindings = new Map([["RANKING", "StageRanking"], ["COUNTER", "GuestCounter"]]);

export function validateProductionConfig(config) {
  const problems = [];
  const production = config?.env?.production;
  const origin = production?.vars?.ALLOWED_ORIGIN;
  if (typeof origin !== "string" || !origin.trim()) {
    problems.push("Set env.production.vars.ALLOWED_ORIGIN to the public HTTPS frontend origin.");
  } else {
    let url;
    try { url = new URL(origin); } catch { problems.push("ALLOWED_ORIGIN must be an HTTPS origin."); }
    if (url && (url.protocol !== "https:" || url.origin !== origin || url.username || url.password ||
      /\.(example|invalid|test|localhost)$/.test(url.hostname) || url.hostname === "localhost")) {
      problems.push("ALLOWED_ORIGIN must be a concrete public HTTPS origin, not a placeholder.");
    }
  }
  if (!production?.name || production.name === config.name) {
    problems.push("Production and development Workers need distinct names.");
  }
  const actual = new Map((production?.durable_objects?.bindings ?? []).map((item) => [item.name, item.class_name]));
  for (const [binding, klass] of bindings) {
    if (actual.get(binding) !== klass) problems.push("Missing production DO binding: " + binding + " => " + klass);
  }
  const migrations = production?.migrations ?? [];
  const sqlite = new Set(migrations.flatMap((item) => item.new_sqlite_classes ?? []));
  for (const klass of bindings.values()) {
    if (!sqlite.has(klass)) problems.push("Missing production SQLite DO migration: " + klass);
  }
  return { ok: problems.length === 0, origin: typeof origin === "string" ? origin : null, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(readFileSync(new URL("../wrangler.api.jsonc", import.meta.url), "utf8"));
  const report = validateProductionConfig(config);
  if (!report.ok) {
    for (const issue of report.problems) console.error("Production preflight: " + issue);
    process.exitCode = 1;
  } else {
    console.log("Production preflight passed for " + report.origin);
  }
}
