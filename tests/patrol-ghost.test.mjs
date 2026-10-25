import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { patrolGhostX, createGame, runToCompletion } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { validateStage } from "../app/stage/validator.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { countSourceCharacters } from "../app/scoring/score.ts";
const read=p=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
test("moving ghost follows a deterministic triangular path and static ghosts do not move",()=>{
  const moving={id:"g",x:900,cleared:false,originX:900,patrolRange:80,patrolPeriod:120};
  assert.deepEqual([0,30,60,90,120].map(t=>patrolGhostX(moving,t)),[900,860,820,860,900]);
  assert.equal(patrolGhostX({id:"static",x:900,cleared:false},60),900);
});
test("patrol stage schema rejects incomplete, unsafe or non-even periods",()=>{
  for(const param of [{patrolRange:80},{patrolPeriod:120},{patrolRange:181,patrolPeriod:120},{patrolRange:80,patrolPeriod:41}]){
    const stage={goal:800,scrollSpeed:3,objects:[{type:"ghost",id:"patrol",position:400,...param}]};
    assert.ok(validateStage("test-patrol",stage).length>0,JSON.stringify(param));
  }
});
test("stage16 ordinary and secret routes stay deterministic with ghost patrol",()=>{
  const stage=read("public/stages/stage-16.json");
  const cases=read("stage-checks/stage-16.json").cases;
  const report=[];
  for(const c of cases){
    const parsed=analyzeProgram(c.source);
    assert.deepEqual(parsed.diagnostics,[],c.name);
    const first=runToCompletion(createGame(stage,parsed.program));
    const second=runToCompletion(createGame(stage,parsed.program));
    assert.deepEqual([first.status,first.failureReason,first.elapsedTicks,objectiveProgress(first)],
      [second.status,second.failureReason,second.elapsedTicks,objectiveProgress(second)],c.name);
    report.push({name:c.name,role:c.role,state:first.status,ticks:first.elapsedTicks,chars:countSourceCharacters(c.source),bp:objectiveProgress(first).completionBp,reason:first.failureReason});
  }
    for (const [index, result] of report.entries()) {
      const expected = cases[index];
      assert.equal(result.state, expected.expect, expected.name);
      if (expected.expectedTicks !== undefined) assert.equal(result.ticks, expected.expectedTicks, expected.name);
      if (expected.failureReason) assert.equal(result.reason, expected.failureReason, expected.name);
    }
    assert.equal(report.find(x=>x.role==="beginner")?.bp,10000);
    assert.equal(report.find(x=>x.name==="optional-coin-low-score")?.bp,3000);
});
