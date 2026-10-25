import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion, stepGame, isCoinRevealed } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { compareRuns, countSourceCharacters } from "../app/scoring/score.ts";
import { validateStage } from "../app/stage/validator.ts";
import { suggestedStageWords } from "../app/stage/vocabulary.ts";
import { verifyStageRunResult } from "../worker/validation.mjs";
import { drawAnimatedCharacter } from "../app/game/character.ts";

const read = path => JSON.parse(readFileSync(new URL("../"+path,import.meta.url),"utf8"));
const stage = read("experiments/stages/mirror-return-route.json");
const regularSource="はしる";
const mirrorSource="かがみにうつる\nこいんとる";
const play=(source,world=stage)=>{
  const parsed=analyzeProgram(source);
  assert.deepEqual(parsed.diagnostics,[],source);
  return runToCompletion(createGame(world,parsed.program),20000);
};
const asRun=(game,source)=>({
  runId:source,source,elapsedTicks:game.elapsedTicks,
  charCount:countSourceCharacters(source),completionBp:objectiveProgress(game).completionBp
});

test("paired mirror fixture validates and only reveals words in mirror stages",()=>{
  assert.deepEqual(validateStage(stage.id,stage,true),[]);
  assert.equal(suggestedStageWords(stage).conditions.includes("mirror"),true);
  assert.equal(suggestedStageWords(stage).actions.includes("reflect"),true);
  const legacy=read("public/stages/stage-1.json");
  assert.equal(suggestedStageWords(legacy).conditions.includes("mirror"),false);
  assert.equal(suggestedStageWords(legacy).actions.includes("reflect"),false);
  assert.equal(read("public/stages/manifest.json").stages.some(x=>x.id===stage.id),false);
  const mirror=analyzeProgram(mirrorSource);
  assert.deepEqual(mirror.diagnostics,[]);
  assert.equal(mirror.program.watchers[0].action,"reflect");
  assert.deepEqual(mirror.program.watchers[0].conds,["mirror"]);
  assert.deepEqual(analyzeProgram("まほうのかがみの むきをかえる").diagnostics,[]);
});

test("the left mirror is inert when passing it forward; reflection uncovers a return-path coin",()=>{
  const game=createGame(stage,analyzeProgram(mirrorSource).program);
  const coin=game.coins[0];
  assert.equal(isCoinRevealed(game,coin),false);
  while(game.status==="running" && game.px<525) stepGame(game);
  assert.equal(game.direction,1);
  assert.equal(game.mirrors[0].used,false);
  assert.equal(game.mirrors[1].used,false);
  assert.equal(coin.collected,false);
  let observedBackward=false, observedReturn=false, pickupDuringReturn=false;
  let lastPx=game.px;
  while(game.status==="running" && game.elapsedTicks<20000){
    stepGame(game);
    if(game.direction===-1){
      observedBackward=true;
      assert.ok(game.px<=lastPx+0.001);
      assert.equal(isCoinRevealed(game,coin),true);
      if(coin.collected)pickupDuringReturn=true;
    }
    if(observedBackward && game.direction===1) observedReturn=true;
    lastPx=game.px;
  }
  assert.equal(game.status,"cleared");
  assert.equal(observedBackward,true);
  assert.equal(observedReturn,true);
  assert.equal(pickupDuringReturn,true);
  assert.equal(coin.collected,true);
  assert.equal(game.mirrors.every(x=>x.used),true);
  assert.equal(game.direction,1);
  assert.equal(objectiveProgress(game).completionBp,10000);
});

test("direct route is faster and shorter but gives up the mirror bonus",()=>{
  const direct=play(regularSource);
  const returnRoute=play(mirrorSource);
  const noPickup=play("かがみうつる");
  assert.equal(direct.status,"cleared");
  assert.equal(returnRoute.status,"cleared");
  assert.equal(noPickup.status,"cleared");
  assert.equal(direct.coins[0].collected,false);
  assert.equal(direct.mirrors.some(x=>x.used),false);
  assert.equal(objectiveProgress(direct).completionBp,3000);
  assert.equal(objectiveProgress(noPickup).completionBp,3000);
  assert.equal(objectiveProgress(returnRoute).completionBp,10000);
  assert.ok(direct.elapsedTicks<returnRoute.elapsedTicks);
  assert.ok(compareRuns("chars",asRun(direct,regularSource),asRun(returnRoute,mirrorSource))<0);
  assert.ok(compareRuns("time",asRun(returnRoute,mirrorSource),asRun(direct,regularSource))<0);
  for(const [source,result] of [[regularSource,direct],[mirrorSource,returnRoute]]){
    assert.equal(verifyStageRunResult(stage,{source,elapsedTicks:result.elapsedTicks,completionBp:objectiveProgress(result).completionBp}),result.elapsedTicks);
    assert.throws(()=>verifyStageRunResult(stage,{source,elapsedTicks:result.elapsedTicks,completionBp:result===direct?10000:3000}),/objective progress/);
  }
  assert.throws(()=>verifyStageRunResult(stage,{source:mirrorSource,elapsedTicks:returnRoute.elapsedTicks-1,completionBp:10000}),/clear time/);
});

test("mirror placement forbids single, duplicated, wrong-facing, blocked or unrevealed mirror corridors",()=>{
  const altered=callback=>{
    const obj=structuredClone(stage);callback(obj);
    return validateStage(obj.id,obj,true);
  };
  assert.ok(altered(obj=>obj.objects.splice(1,1)).some(issue=>issue.message.includes("exactly two")));
  assert.ok(altered(obj=>obj.objects[0].fromDirection="right").some(issue=>issue.message.includes("face left")));
  assert.ok(altered(obj=>obj.objects[1].fromDirection="left").some(issue=>issue.message.includes("face right")));
  assert.ok(altered(obj=>obj.objects[0].position=720).some(issue=>issue.message.includes("320..1200")));
  assert.ok(altered(obj=>obj.objects[1].id=obj.objects[0].id).some(issue=>issue.message.includes("duplicate")));
  assert.ok(altered(obj=>obj.objects.push({id:"blocked",type:"wall",position:750})).some(issue=>issue.message.includes("corridor")));
  assert.ok(altered(obj=>obj.objects[2].revealAfterMirrorId="mirror-left").some(issue=>issue.message.includes("right mirror")));
  assert.ok(altered(obj=>delete obj.objects[2].revealAfterMirrorId).some(issue=>issue.message.includes("corridor")));
  assert.ok(altered(obj=>obj.optionalObjectives=false).some(issue=>issue.path==="optionalObjectives"));
});

test("turning around flips the animated character in a way independent from screen position",()=>{
  const game=createGame(stage);
  const scales=[];
  const context=new Proxy({scale:(x,y)=>scales.push([x,y]),createLinearGradient:()=>({addColorStop:()=>{}})},
    {get:(obj,key)=> key in obj ? obj[key] : ()=>{},set:(obj,key,value)=>{obj[key]=value;return true;}});
  drawAnimatedCharacter(context,game);
  game.direction=-1;
  drawAnimatedCharacter(context,game);
  assert.ok(scales.some(x=>x[0]===1));
  assert.ok(scales.some(x=>x[0]===-1));
});

test("mirror return routes replay 100 times while stage1 legacy ticks remain unchanged",()=>{
  for(const source of [regularSource,mirrorSource,"かがみうつる"]){
    const reference=play(source);
    const result=[reference.status,reference.elapsedTicks,reference.direction,reference.px,reference.coins[0].collected,reference.mirrors.map(m=>m.used)];
    for(let i=0;i<100;i++){
      const run=play(source);
      assert.deepEqual([run.status,run.elapsedTicks,run.direction,run.px,run.coins[0].collected,run.mirrors.map(m=>m.used)],result);
    }
  }
  const old=read("public/stages/stage-1.json");
  const original=play("かべとぶ",old);
  assert.equal(original.status,"cleared");
  assert.equal(original.elapsedTicks,712);
  assert.equal(original.direction,1);
});
