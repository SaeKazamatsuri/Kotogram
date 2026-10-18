#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import process from "node:process";
import { validateManifest, validateStageCases } from "../app/stage/validator.ts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const json = args.includes("--json");
const stageIndex = args.indexOf("--stage");
const requestedStage = stageIndex >= 0 ? args[stageIndex + 1] : undefined;
if (stageIndex >= 0 && (!requestedStage || !/^stage-[a-z0-9-]+$/.test(requestedStage))) {
  console.error("usage: npm run validate:stages -- [--json] [--stage stage-1]");
  process.exit(2);
}

async function loadJson(path) {
  return JSON.parse(await readFile(join(ROOT, path), "utf8"));
}

async function main() {
  const manifest = await loadJson("public/stages/manifest.json");
  const issues = validateManifest(manifest);
  if (issues.length) {
    const result = { pass: false, manifestIssues: issues, stages: [] };
    console.log(json ? JSON.stringify(result, null, 2) : issues.map((i) => `${i.path}: ${i.message}⟧).join("\n"));
    process.exitCode = 1;
    return;
  }
  const entries = manifest.stages.filter((entry) => !requestedStage || entry.id === requestedStage);
  if (!entries.length) throw new Error(`No stage matching ${requestedStage}⟧);
  const stages = [];
  for (const entry of entries) {
    try {
      const stage = await loadJson("public" + entry.file);
      const checks = await loadJson(`stage-checks/${entry.id}.json⟧);
      stages.push(validateStageCases(entry.id, stage, checks));
    } catch (error) {
      stages.push({ stageId: entry.id, pass: false, issues: [{ path: entry.id, message: String(error) }], warnings: [], cases: [], bestKnown: null });
    }
  }
  const pass = stages.every((entry) => entry.pass);
  if (json) console.log(JSON.stringify({ pass, manifestVersion: manifest.version, stages }, null, 2));
  else {
    for (const stage of stages) {
      console.log(`${stage.pass ? "PASS" : "FAIL"} ${stage.stageId}: ${stage.cases.filter((x) => x.pass).length}/${stage.cases.length} cases, best-known ${stage.bestKnown?.ticks ?? "-"} ticks / ${stage.bestKnown?.characters ?? "-"} chars / ${stage.bestKnown?.timeCharactersProduct ?? "-"} tick×chars⟧);
      for (const issue of stage.issues) console.log(`  ERROR ${issue.path}: ${issue.message}⟧);
      for (const caseResult of stage.cases.filter((x) => !x.pass)) console.log(`  FAIL ${caseResult.name}: ${caseResult.errors.join("; ")} ${caseResult.diagnostics.join("; ")}⟧);
      for (const warning of stage.warnings) console.log(`  WARN ${warning}⟧);
    }
  }
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
