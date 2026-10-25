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
const simple={goal:800,scrollSpeed:3,requiredCoins:1,optionalObjectives:true,objects:[
  {id:"silver",type:"key",position:240},
  {id:"gift",type:"chest",position:380,keyId:"silver"}
]};
const play=(stage,source)=>{
  const parsed=analyzeProgram(source);
  assert.deepEqual(parsed.diagnostics,[],source);
  return runToCompletion(createGame(stage,parsed.program));
};
test("鍵をとって宝箱をあけるとコイン1枚を獲得、未取得は減点でクリア",()=>{
  assert.deepEqual(validateStage("simple",simple),[]);
  const full=play(simple,"かぎとる\nたからばこあける");
  assert.equal(full.status,"cleared");
  assert.deepEqual(full.keys.map(x=>x.collected),[true]);
  assert.deepEqual(full.chests.map(x=>x.opened),[true]);
  assert.deepEqual(full.coins.map(x=>x.collected),[true]);
  assert.equal(objectiveProgress(full).completionBp,10000);
  const noKey=play(simple,"たからばこあける");
  assert.equal(noKey.status,"cleared");
  assert.equal(noKey.chests[0].opened,false);
  assert.equal(objectiveProgress(noKey).completionBp,3000);
  const onlyKey=play(simple,"かぎとる");
  assert.equal(onlyKey.status,"cleared");
  assert.equal(onlyKey.coins[0].collected,false);
  assert.equal(objectiveProgress(onlyKey).completionBp,3000);
  const forgedCoin=play(simple,"こいんとる");
  assert.equal(forgedCoin.coins[0].collected,false);
  assert.deepEqual(play(simple,"かぎとる\nたからばこあける"),full);
});
test("鍵・宝箱のルールは必要な面だけに表示、壊れた鍵参照を拒否",()=>{
  assert.ok(suggestedStageWords(simple).conditions.includes("key"));
  assert.ok(suggestedStageWords(simple).conditions.includes("chest"));
  assert.ok(suggestedStageWords(simple).actions.includes("openChest"));
  for(const changes of [{keyId:"missing"},{position:150},{keyId:""}]){
    const stage={...simple,objects:[simple.objects[0],{...simple.objects[1],...changes}]};
    assert.ok(validateStage("simple",stage).length>0,JSON.stringify(changes));
  }
  const without={...simple,objects:[simple.objects[1]]};
  assert.ok(validateStage("simple",without).length>0);
});
test("stage21's full bonus and skipped chest routes are deterministic and versioned",()=>{
  const stage=read("public/stages/stage-21.json");
  const checks=read("stage-checks/stage-21.json").cases;
  const report=[];
  for(const c of checks){
    const parsed=analyzeProgram(c.source);
    assert.deepEqual(parsed.diagnostics,[],c.name);
    const a=runToCompletion(createGame(stage,parsed.program));
    const b=runToCompletion(createGame(stage,parsed.program));
    assert.deepEqual([a.status,a.elapsedTicks,a.failureReason,objectiveProgress(a)],
      [b.status,b.elapsedTicks,b.failureReason,objectiveProgress(b)],c.name);
    report.push({name:c.name,role:c.role,status:a.status,reason:a.failureReason,ticks:a.elapsedTicks,
      chars:countSourceCharacters(c.source),bp:objectiveProgress(a).completionBp,
      opened:a.chests.filter(x=>x.opened).length});
  }
  for(const [index,actual] of report.entries()){
    const expected=checks[index];
    assert.equal(actual.status,expected.expect,expected.name);
    if(expected.expectedTicks!==undefined) assert.equal(actual.ticks,expected.expectedTicks,expected.name);
    if(expected.failureReason) assert.equal(actual.reason,expected.failureReason,expected.name);
  }
  assert.equal(report.find(x=>x.role==="beginner")?.bp,10000);
  assert.equal(report.find(x=>x.name==="key-without-opening-chest")?.bp,6500);
  assert.equal(report.find(x=>x.name==="chest-without-picking-up-key")?.bp,6500);
  assert.equal(report.find(x=>x.name==="optional-coin-low-score")?.bp,3000);
  assert.equal(report.find(x=>x.role==="fast")?.ticks,383);
  assert.equal(report.find(x=>x.role==="overall")?.ticks,383);
  assert.equal(report.find(x=>x.role==="short")?.chars,14);
  assert.equal(report.find(x=>x.role==="short")?.bp,6500);
  assert.equal(report.find(x=>x.role==="overall")?.bp,6500);
  assert.equal(report.find(x=>x.name==="p2-full-bonus-compact-sprint")?.bp,10000);
  assert.equal(getScoreReference("stage-21","2026-10-25-r2")?.timeTicks,670);
  assert.ok(getScoreReference("stage-21","2026-10-25-r3"));
});
