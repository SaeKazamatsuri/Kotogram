#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { analyzeProgram } from "../app/language/parser.ts";
import { analyzeJumpTrajectories } from "../app/game/trajectory.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const selected = args.find((arg) => arg.startsWith("--stage="))?.slice("--stage=".length);
const role = args.includes("--fast") ? "fast" : "beginner";
const json = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));

async function main() {
  const manifest = await json("public/stages/manifest.json");
  const stages = manifest.stages.filter((stage) => !selected || stage.id === selected);
  if (!stages.length) throw new Error("Unknown stage: " + selected);
  const reports = [];
  for (const entry of stages) {
    const stage = await json("public" + entry.file);
    const checks = await json("stage-checks/" + entry.id + ".json");
    const source = checks.cases.find((item) => item.role === role)?.source;
    if (!source) throw new Error(entry.id + ": missing " + role + " program");
    const parsed = analyzeProgram(source);
    if (parsed.diagnostics.length) throw new Error(entry.id + ": invalid program");
    reports.push({ stageId: entry.id, role, ...analyzeJumpTrajectories(stage, parsed.program) });
  }
  console.log(JSON.stringify({ reports }, null, 2));
  if (reports.some((item) => item.status !== "cleared")) process.exitCode = 1;
}
main().catch((error) => { console.error(String(error)); process.exitCode = 1; });
