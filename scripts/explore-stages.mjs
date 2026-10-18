#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { exploreStage } from "../app/stage/explorer.ts";
import { validateManifest, validateStage } from "../app/stage/validator.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const json = args.includes("--json");
function option(name) {
  const index = args.indexOf(name);
  const assignment = args.find((arg) => arg.startsWith(name + "="));
  return assignment === undefined ? (index < 0 ? undefined : args[index + 1]) : assignment.slice(name.length + 1);
}
const stageId = option("--stage");
const limitNames = { maxCandidates: "--max-candidates", maxTicks: "--max-ticks", maxCharacters: "--max-characters", maxMs: "--max-ms" };
const limits = Object.fromEntries(Object.entries(limitNames).filter(([, flag]) => option(flag) !== undefined).map(([name, flag]) => [name, Number(option(flag))]));
const readJson = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));

async function main() {
  const manifest = await readJson("public/stages/manifest.json");
  const errors = validateManifest(manifest);
  if (errors.length) throw new Error(JSON.stringify(errors));
  const stages = manifest.stages.filter((entry) => !stageId || stageId === entry.id);
  if (stages.length === 0) throw new Error("Unknown stage: " + stageId);
  const reports = [];
  for (const entry of stages) {
    const stage = await readJson("public" + entry.file);
    const issues = validateStage(entry.id, stage);
    if (issues.length) throw new Error(entry.id + ": " + JSON.stringify(issues));
    const report = exploreStage(stage, limits);
    reports.push({ stageId: entry.id, ...report });
  }
  if (json) console.log(JSON.stringify({ reports }, null, 2));
  else for (const report of reports) {
    const format = (result) => result ? result.elapsedTicks + "tick / " + result.charCount + "chars / " + result.product + "product (" + result.source.replaceAll("\n", " | ") + ")" : "not found";
    console.log(report.stageId + ": " + report.cleared + "/" + report.checked + " cleared" + (report.truncated ? " [limit reached]" : ""));
    console.log("  time: " + format(report.best.time));
    console.log("  chars: " + format(report.best.chars));
    console.log("  overall: " + format(report.best.overall));
  }
  if (reports.some((report) => report.cleared === 0)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
