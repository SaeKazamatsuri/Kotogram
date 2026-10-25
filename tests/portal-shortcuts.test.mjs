import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { validateStage } from "../app/stage/validator.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { getScoreReference, countSourceCharacters } from "../app/scoring/score.ts";
import { suggestedStageWords } from "../app/stage/vocabulary.ts";
const read=p=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
const simple={goal:1100,scrollSpeed:3,objects:[
  {id:"one-way",type:"portal",position:300,targetPosition:800}
]};
const play=(s,source)=>{
  const parsed=analyzeProgram(source);
  assert.deepEqual(parsed.diagnostics,[],source);
  return runToCompletion(createGame(s,parsed.program));
};
test("one-use portal skips forward without altering clock and repeats deterministically",()=>{
  assert.deepEqual(validateStage("portal-test",simple),[]);
  const normal=play(simple,"あるく");
  const shortcut=play(simple,"わーぷにはいる");
  assert.equal(normal.status,"cleared");
  assert.equal(shortcut.status,"cleared");
  assert.ok(shortcut.elapsedTicks<normal.elapsedTicks-100);
  assert.deepEqual(shortcut.portals.map(x=>x.used),[true]);
  assert.deepEqual(play(simple,"わーぷにはいる"),shortcut);
  assert.equal(analyzeProgram("わーぷにはいる").rules[0]?.action,"enterPortal");
  assert.ok(suggestedStageWords(simple).conditions.includes("portal"));
  assert.ok(suggestedStageWords(simple).actions.includes("enterPortal"));
});
test("broken portal destinations are rejected",()=>{
  for(const dest of [200,430,1100,3000]){
    const invalid={...simple,objects:[{...simple.objects[0],targetPosition:dest}]};
    assert.ok(validateStage("portal-test",invalid).length>0,String(dest));
  }
});
test("stage28 portal route earns time savings but fewer optional coins and skips",()=>{
  const stage=read("public/stages/stage-28.json");
  const cases=read("stage-checks/stage-28.json").cases;
  const results=cases.map(c=>{
    const a=play(stage,c.source),b=play(stage,c.source);
    assert.deepEqual([a.status,a.failureReason,a.elapsedTicks,objectiveProgress(a)],
      [b.status,b.failureReason,b.elapsedTicks,objectiveProgress(b)],c.name);
    return {name:c.name,role:c.role,status:a.status,reason:a.failureReason,
      ticks:a.elapsedTicks,chars:countSourceCharacters(c.source),
      bp:objectiveProgress(a).completionBp,used:a.portals.filter(p=>p.used).length};
  });
  for(const [index,actual] of results.entries()){
    const expected=cases[index];
    assert.equal(actual.status,expected.expect,expected.name);
    if(expected.expectedTicks!==undefined) assert.equal(actual.ticks,expected.expectedTicks,expected.name);
    if(expected.failureReason) assert.equal(actual.reason,expected.failureReason,expected.name);
  }
  const portal=results.find(x=>x.name==="portal-tradeoff-skips-one-coin-and-gate");
  assert.equal(portal?.status,"cleared");
  assert.equal(portal?.ticks,906);
  assert.equal(portal?.bp,7013);
  assert.equal(portal?.used,1);
  assert.equal(results.find(x=>x.role==="beginner")?.bp,10000);
  assert.ok(portal.ticks<results.find(x=>x.role==="beginner").ticks);
  assert.ok(getScoreReference("stage-28","2026-10-25-r2"));
  assert.ok(getScoreReference("stage-28","2026-10-25-r3"));
});
