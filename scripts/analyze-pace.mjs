import { readFileSync } from "node:fs";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { countSourceCharacters } from "../app/scoring/score.ts";

const load = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));

function evaluate(stage, source, name) {
  const parsed = analyzeProgram(source);
  if (parsed.diagnostics.length) {
    throw new Error(name + ": " + parsed.diagnostics.map(({ message }) => message).join(", "));
  }
  const result = runToCompletion(createGame(stage, parsed.program), 20000);
  const characters = countSourceCharacters(source);
  return {
    name,
    source,
    outcome: result.status,
    failureReason: result.failureReason ?? null,
    ticks: result.elapsedTicks,
    characters,
    product: result.status === "cleared" ? result.elapsedTicks * characters : null,
  };
}

const manifest = load("public/stages/manifest.json");
const published = manifest.stages.filter(({ id }) => /^stage-[1-7]$/.test(id));
const stages = published.map(({ id, version }) => {
  const stage = load("public/stages/" + id + ".json");
  const checks = load("stage-checks/" + id + ".json");
  const solutions = checks.cases.filter(({ role }) => ["beginner", "short", "fast"].includes(role));
  const entries = solutions.map(({ name, source }) => evaluate(stage, source, name));
  const base = solutions.find(({ role }) => role === "short") ?? solutions.find(({ role }) => role === "beginner");
  entries.push(evaluate(stage, "あるく\n" + base.source, "explicit-walk"));
  entries.push(evaluate(stage, "はしる\n" + base.source, "explicit-run"));
  return {
    stageId: id,
    stageVersion: version ?? manifest.version,
    entries,
    bestKnown: {
      fewestTicks: Math.min(...entries.filter(({ outcome }) => outcome === "cleared").map(({ ticks }) => ticks)),
      fewestCharacters: Math.min(...entries.filter(({ outcome }) => outcome === "cleared").map(({ characters }) => characters)),
      smallestProduct: Math.min(...entries.filter(({ product }) => product !== null).map(({ product }) => product)),
      provenOptimal: false,
    },
  };
});

const experiment = load("experiments/stages/pace-route.json");
const sources = {
  walk: "まえとぶ\nおばけしゃがむ",
  unsafeRun: "はしる\nまえとぶ\nおばけしゃがむ",
  switchAtHole: "はしる\nあなあるく\nまえとぶ\nおばけしゃがむ",
  switchBackAtWall: "はしる\nあなあるく\nかべはしる\nまえとぶ\nおばけしゃがむ",
  preciseRun: "はしる\nおばけしゃがむ\nあなとぶ\nかべとぶ",
};

const paceRoute = {
  stageId: experiment.id,
  published: false,
  entries: Object.entries(sources).map(([name, source]) => evaluate(experiment, source, name)),
};

const stage5 = load("experiments/stages/stage-5-pace-candidate.json");
const stage5Sources = {
  beginner: "かべならじゃんぷ\nあなならじゃんぷ\nおばけならしゃがむ",
  fast: "はしる\nかべとあなとぶ\nおばけしゃがむ",
  genericWalk: "まえとぶ\nおばけしゃがむ",
  unsafeGenericRun: "はしる\nまえとぶ\nおばけしゃがむ",
  slowedGenericRun: "はしる\nあなあるく\nまえとぶ\nおばけしゃがむ",
};
const stage5Candidate = {
  stageId: stage5.id,
  published: false,
  entries: Object.entries(stage5Sources).map(([name, source]) => evaluate(stage5, source, name)),
};

console.log(JSON.stringify({
  baseline: "2026-10-20",
  scope: "published stages 1-7 only; stage 8 deliberately excluded",
  note: "bestKnown values are measured examples, not mathematically proven optima",
  stages,
  paceRoute,
  stage5Candidate,
}, null, 2));
