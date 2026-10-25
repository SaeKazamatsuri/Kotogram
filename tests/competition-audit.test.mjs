import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateStageCompetition, summarizeCompetition } from "../app/scoring/competition-audit.ts";
import { getScoreReference, compareRuns } from "../app/scoring/score.ts";
const read=p=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
test("Competition audit replays all 30 ranked stages and respects actual score sorting",()=>{
 const manifest=read("public/stages/manifest.json");
 const stages=manifest.stages.map(item=>evaluateStageCompetition(item.id,item.version??manifest.version,
   read("public/stages/"+item.id+".json"),read("stage-checks/"+item.id+".json").cases));
 assert.equal(stages.length,30);
 const summary=summarizeCompetition(stages);
 assert.equal(summary.stageCount,30);
 assert.equal(summary.registeredRoutes,stages.reduce((sum,x)=>sum+x.registered,0));
 assert.ok(summary.successfulRoutes>=30*4);
 assert.ok(stages.every(x=>x.frontierCount>=1));
 assert.deepEqual(summary.registeredOverallMismatch,[],"official overall must be consistent with measured runs");
 console.log("COMPETITION_AUDIT_REPORT "+JSON.stringify({summary,rows:stages.map(r=>({
   id:r.stageId,time:r.best.time.ticks,chars:r.best.chars.characters,overall:r.best.overall.score,
   pace:r.timeGainPct,compact:r.charsGainPct,pareto:r.frontierCount,choices:r.differentObjectives,
   penalty:r.optionalBypass.map(x=>x.pct)
 }))}));
 for(const stage of stages){
   const entry=manifest.stages.find(x=>x.id===stage.stageId);
   const ref=getScoreReference(stage.stageId,entry.version??manifest.version);
   assert.equal(stage.best.time.score>0,true);
   assert.equal(stage.reference.ticks,ref.timeTicks);
   assert.equal(stage.reference.characters,ref.characters);
 }
});
test("Pareto dominance uses objective-rate-adjusted speed and characters",()=>{
 const weak={runId:"weak",elapsedTicks:90,charCount:9,completionBp:3000};
 const strong={runId:"strong",elapsedTicks:100,charCount:10,completionBp:10000};
 assert.ok(compareRuns("time",strong,weak)<0,"full bonus outranks superficially faster shortcut");
 assert.ok(compareRuns("chars",strong,weak)<0);
 assert.ok(compareRuns("overall",strong,weak)<0);
});
