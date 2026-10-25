import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion, stepGame, verticalPlatformY, GAME } from "../app/game/core.ts";
import { validateStage } from "../app/stage/validator.ts";
import { suggestedStageWords } from "../app/stage/vocabulary.ts";
import { verifyStageRunResult } from "../worker/validation.mjs";

const read=p=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
const stage=read("experiments/stages/vertical-platform-route.json");
const play=(source,world=stage)=>{
 const parsed=analyzeProgram(source);
 assert.deepEqual(parsed.diagnostics,[],source);
 return runToCompletion(createGame(world,parsed.program),20000);
};
test("vertical lift follows deterministic triangular height including phase offset",()=>{
 const lift={originY:272,travelY:50,period:180,phaseOffset:0};
 assert.deepEqual([0,45,90,135,180].map(t=>verticalPlatformY(lift,t)),[272,247,222,247,272]);
 assert.equal(verticalPlatformY({...lift,phaseOffset:45},0),247);
 assert.deepEqual(validateStage(stage.id,stage,true),[]);
 assert.ok(suggestedStageWords(stage).conditions.includes("verticalPlatform"));
 assert.ok(suggestedStageWords(stage).actions.includes("ridePlatform"));
 assert.ok(!suggestedStageWords(read("public/stages/stage-1.json")).actions.includes("ridePlatform"));
});

test("natural Japanese lifts a rider across the hole and permits later jumping",()=>{
 const command="のぼりだいにのる\nかべとぶ";
 const parsed=analyzeProgram(command);
 assert.deepEqual(parsed.diagnostics,[]);
 assert.deepEqual(parsed.program.watchers.map(x=>x.action),["ridePlatform","jump"]);
 const run=play(command);
 assert.equal(run.status,"cleared",JSON.stringify([run.failureReason,run.py,run.px]));
 assert.equal(run.goals.length,1);
 assert.equal(verifyStageRunResult(stage,{source:command,elapsedTicks:run.elapsedTicks,completionBp:10000}),run.elapsedTicks);
 assert.equal(play(command).elapsedTicks,run.elapsedTicks);
});

test("riding the platform is an actual choice, not an automatic hole bypass",()=>{
 const noRide=play("かべとぶ");
 assert.equal(noRide.status,"failed");
 assert.equal(noRide.failureReason,"hole");
 const blind=play("のぼりだいにのる");
 assert.equal(blind.status,"failed");
 assert.equal(blind.failureReason,"wall");
});

test("platform carries the player vertically in physics coordinates and dismounts on land",()=>{
 const game=createGame(stage,analyzeProgram("のぼりだいのる\nかべとぶ").program);
 let observedLift=false;
 let maxLift=0;
 for(let i=0;i<1000 && game.status==="running";i++){
  stepGame(game);
  if(game.standingPlatformId==="lifting-bridge"){
   observedLift=true;
   const platform=game.verticalPlatforms[0];
   assert.ok(Math.abs(game.py-platform.y)<0.11);
   maxLift=Math.max(maxLift,GAME.groundY-GAME.epsilon-game.py);
  }
 }
 assert.equal(game.status,"cleared");
 assert.equal(observedLift,true);
 assert.ok(maxLift>=10);
 assert.equal(game.standingPlatformId,null);
});

test("vertical lift schema rejects unsafe geometry, invalid periods and offsets",()=>{
 const changed=fn=>{const x=structuredClone(stage);fn(x);return validateStage(x.id,x,true)};
 for(const patch of [{travelY:0},{travelY:121},{period:61},{period:601},{phaseOffset:180},{phaseOffset:-1},{topY:260},{width:30}])
  assert.ok(changed(x=>Object.assign(x.objects[1],patch)).length>0,JSON.stringify(patch));
 assert.ok(changed(x=>{x.objects[1].position=520}).some(x=>x.path.endsWith(".position")));
});

test("the fixture and all 30 published levels replay identically with 100 clock runs",()=>{
 for(const source of ["のぼりだいのる\nかべとぶ","のぼりだいのる","かべとぶ"]){
  const first=play(source);
  const key=[first.status,first.failureReason,first.elapsedTicks,first.px,first.py];
  for(let i=0;i<100;i++){
   const run=play(source);
   assert.deepEqual([run.status,run.failureReason,run.elapsedTicks,run.px,run.py],key);
  }
 }
 const existing=read("public/stages/stage-23.json");
 const check=read("stage-checks/stage-23.json");
 for(const item of check.cases){
  const observed=play(item.source,existing);
  assert.equal(observed.status,item.expect,item.name);
  if(item.expectedTicks)assert.equal(observed.elapsedTicks,item.expectedTicks,item.name);
 }
});
