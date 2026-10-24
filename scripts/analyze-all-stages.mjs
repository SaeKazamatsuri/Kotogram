import { readFileSync } from "node:fs";
import { validateStageCases } from "../app/stage/validator.ts";
import { getScoreReference } from "../app/scoring/score.ts";

const load = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const manifest = load("public/stages/manifest.json");

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
  const reference = getScoreReference(entry.id, entry.version ?? manifest.version);
  if (!reference || !beginner || !short || !fast) throw new Error(entry.id + " missing required baseline");
  const compare = (item) => item && ({
    name: item.name,
    ticks: item.elapsedTicks,
    characters: item.characters,
    product: item.product,
    seconds: item.seconds,
  });
  return {
    id: entry.id,
    stageVersion: entry.version ?? manifest.version,
    world: Math.floor((Number(entry.id.split("-")[1]) - 1) / 10) + 1,
    objects: stage.objects?.length ?? 0,
    objectives: stage.learningObjectives ?? [],
    solutions: {
      beginner: compare(beginner),
      short: compare(short),
      fast: compare(fast),
      bestKnown: validation.bestKnown,
    },
    reference: { ticks: reference.timeTicks, characters: reference.characters },
    flags: {
      beginnerSameAsShort: beginner.source === short.source,
      beginnerUsesSecret: /すごいじゃんぷ|めっちゃはしる|すごくはしる|すごいとぶ/u.test(beginner.source),
      fastUsesSecretSprint: /めっちゃはしる|すごくはしる/u.test(fast.source),
      shorterAlternativeRegistered: short.characters < beginner.characters,
      fasterAlternativeRegistered: fast.elapsedTicks < beginner.elapsedTicks,
      hasRepeat: /くりかえす|くりかえし/u.test(beginner.source),
    },
  };
});

const summary = {
  stageCount: stages.length,
  worldCounts: [1, 2, 3].map((world) => stages.filter((stage) => stage.world === world).length),
  duplicatedBeginnerAndShort: stages.filter((stage) => stage.flags.beginnerSameAsShort).map((stage) => stage.id),
  beginnerWithSecret: stages.filter((stage) => stage.flags.beginnerUsesSecret).map((stage) => stage.id),
  fastWithSecretSprint: stages.filter((stage) => stage.flags.fastUsesSecretSprint).map((stage) => stage.id),
  stagesWithoutShorterRegisteredAlternative: stages.filter((stage) => !stage.flags.shorterAlternativeRegistered).map((stage) => stage.id),
  stagesWithoutFasterRegisteredAlternative: stages.filter((stage) => !stage.flags.fasterAlternativeRegistered).map((stage) => stage.id),
};

console.log(JSON.stringify({
  scope: "All published stages; known registered solutions only, not mathematical optima",
  summary,
  stages,
}, null, 2));
