import { readFileSync } from "node:fs";
import { validateStageCases, usesSecretAction } from "../app/stage/validator.ts";
import { getScoreReference } from "../app/scoring/score.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";

const load = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const manifest = load("public/stages/manifest.json");
function withInitialPace(source, pace) {
  const lines = source.split("\n");
  while (["あるく", "はしる", "めっちゃはしる", "すごくはしる"].includes(lines[0])) lines.shift();
  return pace + "\n" + lines.join("\n");
}
function replay(stage, source) {
  const analysis = analyzeProgram(source);
  if (analysis.diagnostics.length) return { status: "invalid", ticks: null, reason: "parser" };
  const result = runToCompletion(createGame(stage, analysis.program), 20000);
  return { status: result.status, ticks: result.elapsedTicks, reason: result.failureReason ?? null };
}

const stages = manifest.stages.map((entry) => {
  const stage = load("public/stages/" + entry.id + ".json");
  const checks = load("stage-checks/" + entry.id + ".json");
  const validation = validateStageCases(entry.id, stage, checks);
  if (!validation.pass) {
    throw new Error(entry.id + " validation failed: " + JSON.stringify({
      issues: validation.issues,
      cases: validation.cases.filter((item) => !item.pass),
    }));
  }
  const entries = validation.cases.filter((item) => item.outcome === "cleared" && item.pass);
  const byRole = (role) => entries.find((item) => item.role === role);
  const beginner = byRole("beginner");
  const short = byRole("short");
  const fast = byRole("fast");
  const learning = byRole("learning") ?? beginner;
  const reference = getScoreReference(entry.id, entry.version ?? manifest.version);
  if (!reference || !beginner || !learning || !short || !fast) throw new Error(entry.id + " missing required baseline");
  if (usesSecretAction(learning.source)) throw new Error(entry.id + " learning path uses secret actions");
  const compare = (item) => item && ({
    name: item.name,
    ticks: item.elapsedTicks,
    characters: item.characters,
    product: item.product,
    seconds: item.seconds,
  });
  const pace = {
    walk: replay(stage, withInitialPace(learning.source, "あるく")),
    run: replay(stage, withInitialPace(learning.source, "はしる")),
    sprint: replay(stage, withInitialPace(learning.source, "めっちゃはしる")),
  };
  const broadConditions = ["まえとぶ", "おばけしゃがむ", "こいんとる"].join("\n");
  const broadPace = {
    walk: replay(stage, "あるく\n" + broadConditions),
    run: replay(stage, "はしる\n" + broadConditions),
    sprint: replay(stage, "めっちゃはしる\n" + broadConditions),
  };
  const secretClears = entries.filter((item) => usesSecretAction(item.source));
  const secretAdvantage = {
    faster: secretClears.some((item) => item.elapsedTicks < learning.elapsedTicks),
    fewerCharacters: secretClears.some((item) => item.characters < learning.characters),
    betterOverall: secretClears.some((item) => item.product < learning.product),
  };
  const paretoFrontier = entries.filter((candidate) =>
    !entries.some((other) => other !== candidate
      && other.elapsedTicks <= candidate.elapsedTicks
      && other.characters <= candidate.characters
      && (other.elapsedTicks < candidate.elapsedTicks || other.characters < candidate.characters)));
  const knownBest = {
    time: [...entries].sort((a, b) => a.elapsedTicks - b.elapsedTicks || a.characters - b.characters)[0],
    characters: [...entries].sort((a, b) => a.characters - b.characters || a.elapsedTicks - b.elapsedTicks)[0],
    overall: [...entries].sort((a, b) => a.product - b.product || a.elapsedTicks - b.elapsedTicks)[0],
  };
  return {
    id: entry.id,
    stageVersion: entry.version ?? manifest.version,
    world: Math.floor((Number(entry.id.split("-")[1]) - 1) / 10) + 1,
    objects: stage.objects?.length ?? 0,
    objectives: stage.learningObjectives ?? [],
    solutions: {
      beginner: compare(beginner),
      learning: compare(learning),
      short: compare(short),
      fast: compare(fast),
      bestKnown: validation.bestKnown,
      paretoFrontier: paretoFrontier.map((item) => ({ ...compare(item), role: item.role })),
      knownBestByCategory: Object.fromEntries(Object.entries(knownBest).map(([category, item]) => [category, { ...compare(item), source: item.source }])),
    },
    reference: { ticks: reference.timeTicks, characters: reference.characters },
    pace,
    broadPace,
    secretAdvantage,
    flags: {
      beginnerSameAsShort: beginner.source === short.source,
      beginnerUsesSecret: usesSecretAction(beginner.source),
      learningUsesSecret: usesSecretAction(learning.source),
      fastUsesSecretSprint: /めっちゃはしる|すごくはしる/u.test(fast.source),
      shorterAlternativeRegistered: short.characters < beginner.characters,
      fasterAlternativeRegistered: fast.elapsedTicks < beginner.elapsedTicks,
      hasRepeat: /くりかえす|くりかえし/u.test(beginner.source),
      naiveSprintFails: pace.sprint.status !== "cleared",
      naiveRunFails: pace.run.status !== "cleared",
      broadRunRisk: broadPace.walk.status === "cleared" && broadPace.run.status === "failed",
      broadSprintRisk: broadPace.walk.status === "cleared" && broadPace.sprint.status === "failed",
    },
  };
});

const summary = {
  stageCount: stages.length,
  worldCounts: [1, 2, 3].map((world) => stages.filter((stage) => stage.world === world).length),
  duplicatedBeginnerAndShort: stages.filter((stage) => stage.flags.beginnerSameAsShort).map((stage) => stage.id),
  beginnerWithSecret: stages.filter((stage) => stage.flags.beginnerUsesSecret).map((stage) => stage.id),
  learningWithSecret: stages.filter((stage) => stage.flags.learningUsesSecret).map((stage) => stage.id),
  noMeasuredSecretAdvantage: stages.filter((stage) => !Object.values(stage.secretAdvantage).some(Boolean)).map((stage) => stage.id),
  secretImprovesOverall: stages.filter((stage) => stage.secretAdvantage.betterOverall).map((stage) => stage.id),
  fastWithSecretSprint: stages.filter((stage) => stage.flags.fastUsesSecretSprint).map((stage) => stage.id),
  stagesWithoutShorterRegisteredAlternative: stages.filter((stage) => !stage.flags.shorterAlternativeRegistered).map((stage) => stage.id),
  stagesWithoutFasterRegisteredAlternative: stages.filter((stage) => !stage.flags.fasterAlternativeRegistered).map((stage) => stage.id),
  naiveSprintFailures: stages.filter((stage) => stage.flags.naiveSprintFails).map((stage) => stage.id),
  naiveRunFailures: stages.filter((stage) => stage.flags.naiveRunFails).map((stage) => stage.id),
  naiveRunSuccesses: stages.filter((stage) => !stage.flags.naiveRunFails).map((stage) => stage.id),
  broadRunRiskStages: stages.filter((stage) => stage.flags.broadRunRisk).map((stage) => stage.id),
  broadSprintRiskStages: stages.filter((stage) => stage.flags.broadSprintRisk).map((stage) => stage.id),
  stagesWithDistinctParetoChoices: stages.filter((stage) => stage.solutions.paretoFrontier.length > 1).map((stage) => stage.id),
  worldStats: [1, 2, 3].map((world) => {
    const subset = stages.filter((stage) => stage.world === world);
    return { world, stageCount: subset.length, averageBeginnerTicks: Math.round(subset.reduce((sum, stage) => sum + stage.solutions.beginner.ticks, 0) / subset.length), averageBeginnerCharacters: Math.round(subset.reduce((sum, stage) => sum + stage.solutions.learning.characters, 0) / subset.length), naiveSprintFailureCount: subset.filter((stage) => stage.flags.naiveSprintFails).length, naiveRunFailureCount: subset.filter((stage) => stage.flags.naiveRunFails).length, secretImprovesOverallCount: subset.filter((stage) => stage.secretAdvantage.betterOverall).length, broadRunRiskCount: subset.filter((stage) => stage.flags.broadRunRisk).length };
  }),
};

console.log(JSON.stringify({
  scope: "All published stages; known registered solutions only, not mathematical optima",
  summary,
  stages,
}, null, 2));
