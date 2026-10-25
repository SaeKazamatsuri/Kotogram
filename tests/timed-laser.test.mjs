import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, isLaserActive, runToCompletion } from "../app/game/core.ts";
import { validateStage } from "../app/stage/validator.ts";
import { suggestedStageWords } from "../app/stage/vocabulary.ts";
import { countSourceCharacters } from "../app/scoring/score.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
const read=p=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
const laser={type:"laser",id:"beam",position:400,period:120,activeTicks:80,phaseOffset:40};
const stage={goal:800,scrollSpeed:3,objects:[laser]};
const run=(world,source)=>{
 const parsed=analyzeProgram(source);
 assert.deepEqual(parsed.diagnostics,[],source);
 return runToCompletion(createGame(world,parsed.program));
};
test("timed laser is deterministic: walking hits, crouching survives and off-window sprint passes",()=>{
 assert.deepEqual(validateStage("stage-laser-test",stage),[]);
 assert.deepEqual([0,40,79,80,120].map(t=>isLaserActive({period:120,activeTicks:80,phaseOffset:0},t)),
 [true,true,true,false,true]);
 const walk=run(stage,"あるく");
 assert.equal(walk.failureReason,"laser");
 const safe=run(stage,"ひかりしゃがむ");
 assert.equal(safe.status,"cleared");
 const dash=run(stage,"めっちゃはしる");
 assert.equal(dash.status,"cleared");
 assert.deepEqual(run(stage,"ひかりしゃがむ"),safe);
 assert.ok(suggestedStageWords(stage).conditions.includes("laser"));
 assert.ok(suggestedStageWords(stage).actions.includes("crouch"));
});
test("invalid laser periods and duty cycles do not get published",()=>{
 for(const patch of [{period:0},{activeTicks:120},{activeTicks:0},{phaseOffset:120},{period:39}]){
  const world={...stage,objects:[{...laser,...patch}]};
  assert.ok(validateStage("stage-laser-test",world).length>0,JSON.stringify(patch));
 }
});
test("stage29 registered programs provide deterministic full bonus and beam failure paths",()=>{
 const world=read("public/stages/stage-29.json"),checks=read("stage-checks/stage-29.json").cases;
 const report=[];
 for(const c of checks){
  const first=run(world,c.source),second=run(world,c.source);
  assert.deepEqual([first.status,first.failureReason,first.elapsedTicks,objectiveProgress(first)],
    [second.status,second.failureReason,second.elapsedTicks,objectiveProgress(second)],c.name);
  report.push({name:c.name,role:c.role,status:first.status,reason:first.failureReason,ticks:first.elapsedTicks,
    chars:countSourceCharacters(c.source),bp:objectiveProgress(first).completionBp});
 }
 console.log("LASER_STAGE_REPORT "+JSON.stringify(report));
});
