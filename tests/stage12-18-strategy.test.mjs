import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { countSourceCharacters } from "../app/scoring/score.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
const read=p=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
for(const n of [12,18]){
 test("stage "+n+" replay variants, strategy branches and score penalties are deterministic",()=>{
  const stage=read("public/stages/stage-"+n+".json"),checks=read("stage-checks/stage-"+n+".json");
  const report=checks.cases.map(c=>{
   const code=analyzeProgram(c.source);
   assert.deepEqual(code.diagnostics,[],c.name);
   const g=runToCompletion(createGame(stage,code.program));
   const repeat=runToCompletion(createGame(stage,code.program));
   assert.deepEqual([g.status,g.failureReason,g.elapsedTicks,objectiveProgress(g)],
      [repeat.status,repeat.failureReason,repeat.elapsedTicks,objectiveProgress(repeat)],c.name);
   return {name:c.name,role:c.role,status:g.status,reason:g.failureReason,ticks:g.elapsedTicks,
     chars:countSourceCharacters(c.source),bp:objectiveProgress(g).completionBp,broken:g.doors.filter(x=>x.broken).length};
  });
  console.log("STRATEGY_STAGE_REPORT "+JSON.stringify({n,report}));
 });
}
