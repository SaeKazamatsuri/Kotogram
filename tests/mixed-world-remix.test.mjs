import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { countSourceCharacters } from "../app/scoring/score.ts";
const read=p=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
for(const n of [13,17,21,24]){
 test("Rebalanced stage "+n+" reproducible pace and optional routes",()=>{
  const stage=read("public/stages/stage-"+n+".json"),cases=read("stage-checks/stage-"+n+".json").cases;
  const results=cases.map(c=>{
   const parsed=analyzeProgram(c.source);
   assert.deepEqual(parsed.diagnostics,[],c.name);
   const first=runToCompletion(createGame(stage,parsed.program));
   const repeat=runToCompletion(createGame(stage,parsed.program));
   assert.deepEqual([first.status,first.failureReason,first.elapsedTicks,objectiveProgress(first)],
      [repeat.status,repeat.failureReason,repeat.elapsedTicks,objectiveProgress(repeat)],c.name);
   return {name:c.name,role:c.role,status:first.status,reason:first.failureReason,ticks:first.elapsedTicks,
      chars:countSourceCharacters(c.source),bp:objectiveProgress(first).completionBp};
  });
  console.log("MIXED_WORLD_REPORT "+JSON.stringify({n,results}));
 });
}
