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
  for (const [index, result] of report.entries()) {
    const expected = checks.cases[index];
    assert.equal(result.status, expected.expect, expected.name);
    if (expected.expectedTicks !== undefined) assert.equal(result.ticks, expected.expectedTicks, expected.name);
    if (expected.failureReason) assert.equal(result.reason, expected.failureReason, expected.name);
  }
  assert.equal(report.find(x=>x.role==="beginner")?.bp,10000);
  if (n === 12) {
    assert.equal(report.find(x=>x.name==="hidden-breakable-gate")?.broken,1);
    assert.equal(report.find(x=>x.name==="optional-coin-missed")?.bp,3000);
    assert.equal(report.find(x=>x.name==="closed-gate-still-fatal")?.reason,"door");
  }
  if (n === 18) {
    assert.equal(report.find(x=>x.name==="fragile-floor-ignored")?.reason,"hole");
    assert.equal(report.find(x=>x.name==="repeat-once-does-not-cross-second-hole")?.reason,"hole");
  }
 });
}
