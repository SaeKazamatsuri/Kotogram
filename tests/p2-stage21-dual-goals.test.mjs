import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { validateStage, validateStageCases } from "../app/stage/validator.ts";
import { countSourceCharacters, getScoreReference, compareRuns, ENGINE_VERSION, LANGUAGE_VERSION, SCORING_VERSION, SEASON_ID } from "../app/scoring/score.ts";
import { validateScope, validateRunPayload, verifyRunResult } from "../worker/validation.mjs";

const read=path=>JSON.parse(readFileSync(new URL("../"+path,import.meta.url),"utf8"));
const stage=read("public/stages/stage-21.json");
const manifest=read("public/stages/manifest.json");
const checks=read("stage-checks/stage-21.json");
const play=source=>runToCompletion(createGame(stage,analyzeProgram(source).program),20000);

test("published stage21 offers quick and treasure finish while keeping all legacy actions",()=>{
 assert.deepEqual(validateStage("stage-21",stage,true),[]);
 assert.equal(validateStageCases("stage-21",stage,checks).pass,true);
 assert.equal(stage.goal,2440);
 const near=play(checks.cases.find(x=>x.role==="beginner").source);
 const far=play(checks.cases.find(x=>x.role==="overall").source);
 assert.equal(near.status,"cleared");
 assert.equal(far.status,"cleared");
 assert.equal(near.selectedGoalId,"short-goal");
 assert.equal(far.selectedGoalId,"treasure-goal");
 assert.equal(near.elapsedTicks,670);
 assert.equal(far.elapsedTicks,463);
 assert.equal(objectiveProgress(near).completionBp,5000);
 assert.equal(objectiveProgress(far).completionBp,10000);
 for(const target of [near,far]){
   const source=target===near?checks.cases.find(x=>x.role==="beginner").source:checks.cases.find(x=>x.role==="overall").source;
   assert.equal(verifyRunResult({stageId:"stage-21",source,elapsedTicks:target.elapsedTicks,completionBp:objectiveProgress(target).completionBp}),target.elapsedTicks);
 }
});

test("old r3 ranking stage21 is readable while publishing only r4 records",()=>{
 const entry=manifest.stages.find(x=>x.id==="stage-21");
 assert.equal(entry.version,"2026-10-25-r4");
 assert.equal(getScoreReference("stage-21","2026-10-25-r3")?.product,24120);
 assert.equal(getScoreReference("stage-21","2026-10-25-r4")?.product,24120);
 const base={seasonId:SEASON_ID,stageId:"stage-21",stageVersion:entry.version,engineVersion:ENGINE_VERSION,languageVersion:LANGUAGE_VERSION,scoringVersion:SCORING_VERSION};
 const source=checks.cases.find(x=>x.role==="overall").source;
 const game=play(source);
 const input={...base,runId:"00000000-0000-4000-8000-000000000001",playerId:"00000000-0000-4000-8000-000000000002",source,elapsedTicks:game.elapsedTicks,charCount:countSourceCharacters(source),completionBp:objectiveProgress(game).completionBp};
 assert.deepEqual(validateScope({...base,stageVersion:"2026-10-25-r3"}).stageVersion,"2026-10-25-r3");
 assert.equal(validateRunPayload(input).stageVersion,entry.version);
 assert.throws(()=>validateRunPayload({...input,stageVersion:"2026-10-25-r3"}),/read-only/);
 assert.throws(()=>verifyRunResult({...input,completionBp:5000}),/objective progress/);
 assert.throws(()=>verifyRunResult({...input,elapsedTicks:383}),/clear time/);
});

test("a short finish and full finish preserve different rankings",()=>{
 const nearSource=checks.cases.find(x=>x.role==="short").source;
 const farSource=checks.cases.find(x=>x.role==="overall").source;
 const near=play(nearSource),far=play(farSource);
 const score=(g,source)=>({runId:source,source,elapsedTicks:g.elapsedTicks,charCount:countSourceCharacters(source),completionBp:objectiveProgress(g).completionBp});
 const a=score(near,nearSource),b=score(far,farSource);
 assert.ok(compareRuns("chars",a,b)<0);
 assert.ok(compareRuns("time",b,a)<0);
 assert.ok(compareRuns("overall",b,a)<0);
});
