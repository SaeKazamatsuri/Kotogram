import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion, stepGame } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { countSourceCharacters, ENGINE_VERSION, LANGUAGE_VERSION, SCORING_VERSION, SEASON_ID, getScoreReference } from "../app/scoring/score.ts";
import { validateRunPayload, validateScope, verifyRunResult } from "../worker/validation.mjs";
import { validateStageCases, validateStage } from "../app/stage/validator.ts";
const read=p=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
const stage=read("public/stages/stage-23.json");
const checks=read("stage-checks/stage-23.json");
const manifest=read("public/stages/manifest.json");
const cases=Object.fromEntries(checks.cases.map(x=>[x.name,x]));
const play=(source)=>runToCompletion(createGame(stage,analyzeProgram(source).program),20000);
test("stage23 publishes lift alternative in r4 without changing old jump routes",()=>{
 assert.deepEqual(validateStage(stage.id,stage,true),[]);
 assert.equal(validateStageCases(stage.id,stage,checks).pass,true);
 assert.equal(manifest.stages.find(x=>x.id===stage.id).version,"2026-10-25-r4");
 assert.equal(stage.objects.filter(x=>x.type==="verticalPlatform").length,1);
 assert.equal(cases.beginner.expectedTicks,1446);
 const lift=play(cases["vertical-lift-replaces-third-jump"].source);
 const without=play(cases["vertical-lift-missing-board"].source);
 assert.equal(lift.status,"cleared");
 assert.equal(without.status,"failed");
 assert.equal(without.failureReason,"hole");
 assert.equal(verifyRunResult({stageId:stage.id,source:cases["vertical-lift-replaces-third-jump"].source,elapsedTicks:lift.elapsedTicks,completionBp:10000}),lift.elapsedTicks);
 assert.equal(getScoreReference(stage.id,"2026-10-25-r3")?.product,21690);
 assert.equal(getScoreReference(stage.id,"2026-10-25-r4")?.product,21690);
});
test("riding the published moving lift changes the physical route over the last gap",()=>{
 const game=createGame(stage,analyzeProgram(cases["vertical-lift-replaces-third-jump"].source).program);
 let rode=false,peak=0;
 while(game.status==="running" && game.elapsedTicks<20000){
   stepGame(game);
   if(game.standingPlatformId==="final-vertical-lift"){
     rode=true;
     peak=Math.max(peak,272-game.py);
     assert.ok(Math.abs(game.py-game.verticalPlatforms[0].y)<0.1);
   }
 }
 assert.equal(game.status,"cleared");
 assert.equal(rode,true);
 assert.ok(peak>=10);
});
test("stage23 new submissions are r4-only and falsified bonus/clock is rejected",()=>{
 const scope={seasonId:SEASON_ID,stageId:"stage-23",stageVersion:"2026-10-25-r4",engineVersion:ENGINE_VERSION,languageVersion:LANGUAGE_VERSION,scoringVersion:SCORING_VERSION};
 const game=play(cases["vertical-lift-replaces-third-jump"].source);
 const source=cases["vertical-lift-replaces-third-jump"].source;
 const payload={...scope,runId:"00000000-0000-4000-8000-000000000001",playerId:"00000000-0000-4000-8000-000000000002",source,elapsedTicks:game.elapsedTicks,charCount:countSourceCharacters(source),completionBp:objectiveProgress(game).completionBp};
 assert.equal(validateRunPayload(payload).stageVersion,scope.stageVersion);
 assert.equal(validateScope({...scope,stageVersion:"2026-10-25-r3"}).stageVersion,"2026-10-25-r3");
 assert.throws(()=>validateRunPayload({...payload,stageVersion:"2026-10-25-r3"}),/read-only/);
 assert.throws(()=>verifyRunResult({...payload,elapsedTicks:game.elapsedTicks-1}),/clear time/);
 assert.throws(()=>verifyRunResult({...payload,completionBp:5000}),/objective progress/);
});
