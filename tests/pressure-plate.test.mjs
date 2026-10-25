import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { validateStage } from "../app/stage/validator.ts";
import { getScoreReference } from "../app/scoring/score.ts";
import { suggestedStageWords } from "../app/stage/vocabulary.ts";
const read=p=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
const basic={goal:800,scrollSpeed:3,objects:[
 {id:"plate",type:"pressurePlate",position:300,width:95,holdTicks:24,targetDoorId:"gate"},
 {id:"gate",type:"door",position:540},
]};
const replay=(stage,source)=>{
 const parsed=analyzeProgram(source);
 assert.deepEqual(parsed.diagnostics,[],source);
 return runToCompletion(createGame(stage,parsed.program));
};
test("hold-to-open pressure plates distinguish ordinary pace from sprint and support natural Japanese",()=>{
 assert.deepEqual(validateStage("stage-plate-test",basic),[]);
 const walked=replay(basic,"あるく");
 assert.equal(walked.status,"cleared");
 assert.equal(walked.pressurePlates[0].activated,true);
 assert.equal(walked.doors[0].open,true);
 const rushed=replay(basic,"めっちゃはしる");
 assert.equal(rushed.failureReason,"door");
 assert.equal(rushed.pressurePlates[0].activated,false);
 const slowed=replay(basic,"めっちゃはしる\nふむゆかあるく");
 assert.equal(slowed.status,"cleared");
 assert.deepEqual(replay(basic,"めっちゃはしる\nふむゆかあるく"),slowed);
 assert.ok(suggestedStageWords(basic).conditions.includes("pressurePlate"));
 assert.ok(!suggestedStageWords({goal:800,objects:[]}).conditions.includes("pressurePlate"));
});
test("malformed plates and target doors are rejected before ranking replay",()=>{
 for(const patch of [
  {width:40},{holdTicks:0},{holdTicks:200},{targetDoorId:"missing"},{position:400},
 ]){
  const stage={...basic,objects:[{...basic.objects[0],...patch},basic.objects[1]]};
  assert.ok(validateStage("stage-plate-test",stage).length>0,JSON.stringify(patch));
 }
});
test("stage24 official and alternate routes replay deterministically",()=>{
 const stage=read("public/stages/stage-24.json");
 const manifest=read("public/stages/manifest.json");
 const scope=manifest.stages.find(x=>x.id===stage.id).version;
 const checks=read("stage-checks/stage-24.json").cases;
 const results=[];
 for(const c of checks){
  const first=replay(stage,c.source),second=replay(stage,c.source);
  assert.deepEqual([first.status,first.failureReason,first.elapsedTicks],[second.status,second.failureReason,second.elapsedTicks],c.name);
  results.push({name:c.name,role:c.role,status:first.status,reason:first.failureReason,ticks:first.elapsedTicks,
     chars:[...c.source.replace(/\s/g,"")].length,activated:first.pressurePlates[0]?.activated});
 }
 console.log("PRESSURE_PLATE_REPORT "+JSON.stringify({scope,ref:getScoreReference(stage.id,scope),results}));
});
