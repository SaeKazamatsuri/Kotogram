import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { movingPlatformX, createGame, runToCompletion } from "../app/game/core.ts";
import { validateStage } from "../app/stage/validator.ts";
import { suggestedStageWords } from "../app/stage/vocabulary.ts";
const read=p=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
const hole={id:"h",type:"hole",position:320,width:100};
const bridge={id:"bridge",type:"movingPlatform",position:250,width:130,travel:60,period:180};
const basic={goal:800,scrollSpeed:3,objects:[hole,bridge]};
const run=(stage,source)=>{
 const parsed=analyzeProgram(source);
 assert.deepEqual(parsed.diagnostics,[],source);
 return runToCompletion(createGame(stage,parsed.program));
};
test("moving bridge follows a tick-derived triangular path without FPS dependence",()=>{
 assert.deepEqual([0,45,90,135,180].map(t=>movingPlatformX({originX:250,travel:60,period:180},t)),
 [250,280,310,280,250]);
 assert.deepEqual(validateStage("bridge-test",basic),[]);
 assert.equal(run({goal:800,scrollSpeed:3,objects:[hole]},"あるく").failureReason,"hole");
 const crossed=run(basic,"あるく"),again=run(basic,"あるく");
 assert.deepEqual([crossed.status,crossed.elapsedTicks,crossed.px],[again.status,again.elapsedTicks,again.px]);
 assert.equal(crossed.status,"cleared");
 assert.equal(crossed.elapsedTicks,249);
 assert.ok(suggestedStageWords(basic).conditions.includes("movingPlatform"));
});
test("moving platforms reject invalid period, travel and width",()=>{
 for(const patch of [{width:0},{travel:0},{period:47},{period:800}]){
  const stage={...basic,objects:[hole,{...bridge,...patch}]};
  assert.ok(validateStage("bridge-test",stage).length>0,JSON.stringify(patch));
 }
});
test("stage23 paths including moving bridge are deterministic and stage versions are valid",()=>{
 const stage=read("public/stages/stage-23.json");
 const cases=read("stage-checks/stage-23.json").cases;
 const report=cases.map(c=>{
  const first=run(stage,c.source),second=run(stage,c.source);
  assert.deepEqual([first.status,first.elapsedTicks,first.failureReason],[second.status,second.elapsedTicks,second.failureReason],c.name);
  return {name:c.name,role:c.role,status:first.status,ticks:first.elapsedTicks,reason:first.failureReason,chars:[...c.source.replace(/\s/g,"")].length};
 });
 for(const [i,result] of report.entries()){
  const expected=cases[i];
  assert.equal(result.status,expected.expect,expected.name);
  if(expected.expectedTicks!==undefined)assert.equal(result.ticks,expected.expectedTicks,expected.name);
  if(expected.failureReason)assert.equal(result.reason,expected.failureReason,expected.name);
 }
 assert.equal(report.find(x=>x.name==="bridge-replaces-third-jump")?.status,"cleared");
 assert.equal(report.find(x=>x.name==="bridge-replaces-third-jump")?.ticks,1442);
});
