import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, isBridgeOpen, runToCompletion } from "../app/game/core.ts";
import { validateStage } from "../app/stage/validator.ts";
import { suggestedStageWords } from "../app/stage/vocabulary.ts";
import { countSourceCharacters } from "../app/scoring/score.ts";
const read=p=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
const local={goal:1100,scrollSpeed:3,objects:[
  {id:"button",type:"switch",position:280,targetDoorId:"gate",color:"blue",shape:"star"},
  {id:"gate",type:"door",position:430},
  {id:"hole",type:"hole",position:590,width:100},
  {id:"bridge",type:"bridge",position:560,width:160,targetDoorId:"gate"},
]};
const run=(stage,source)=>{
  const parsed=analyzeProgram(source);
  assert.deepEqual(parsed.diagnostics,[],source);
  return runToCompletion(createGame(stage,parsed.program),20000);
};
test("a safe switch opens the door and fills the linked bridge over a gap",()=>{
  assert.deepEqual(validateStage("bridge-test",local),[]);
  const solved=run(local,"あおいほしのぼたんおす");
  assert.equal(solved.status,"cleared");
  assert.equal(isBridgeOpen(solved.bridges[0],solved.doors),true);
  const noBridge={...local,objects:local.objects.filter(o=>o.type!=="bridge")};
  const fallen=run(noBridge,"あおいほしのぼたんおす");
  assert.equal(fallen.failureReason,"hole");
  const shut=run(local,"あるく");
  assert.equal(shut.status,"failed");
  assert.equal(shut.failureReason,"door");
  assert.deepEqual(run(local,"あおいほしのぼたんおす"),solved);
  assert.ok(suggestedStageWords(local).conditions.includes("bridge"));
});
test("bridge schema rejects gaps, missing doors and spans that cannot cover a hole",()=>{
  for(const changes of [{width:50},{width:100},{targetDoorId:"missing"},{position:400}]){
    const stage={...local,objects:local.objects.map(o=>o.type==="bridge"?{...o,...changes}:o)};
    assert.ok(validateStage("bridge-test",stage).length>0,JSON.stringify(changes));
  }
});
test("stage22 switch/bridge paths have deterministic clearance and ranking ticks",()=>{
  const stage=read("public/stages/stage-22.json");
  const cases=read("stage-checks/stage-22.json").cases;
  const report=[];
  for(const c of cases){
    const first=run(stage,c.source),second=run(stage,c.source);
    assert.deepEqual([first.status,first.failureReason,first.elapsedTicks],[second.status,second.failureReason,second.elapsedTicks],c.name);
    report.push({name:c.name,role:c.role,status:first.status,reason:first.failureReason,ticks:first.elapsedTicks,
      chars:countSourceCharacters(c.source),opened:isBridgeOpen(first.bridges[0],first.doors)});
  }
  console.log("LINKED_BRIDGE_STAGE_REPORT "+JSON.stringify(report));
});
