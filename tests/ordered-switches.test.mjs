import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { validateStage } from "../app/stage/validator.ts";
import { countSourceCharacters } from "../app/scoring/score.ts";
const read=p=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
const stage={goal:800,scrollSpeed:3,objects:[
  {type:"switch",id:"blue",position:250,targetDoorId:"gate",sequenceStep:1,color:"blue",shape:"square"},
  {type:"switch",id:"green",position:340,targetDoorId:"gate",sequenceStep:2,color:"green",shape:"circle"},
  {type:"door",id:"gate",position:450},
]};
const run=source=>{
  const result=analyzeProgram(source);
  assert.deepEqual(result.diagnostics,[],source);
  return runToCompletion(createGame(stage,result.program));
};
test("2 ordered switches must both activate in the correct order to open a gate",()=>{
  assert.deepEqual(validateStage("ordered-test",stage),[]);
  const clear=run("ぼたんおす");
  assert.equal(clear.status,"cleared");
  assert.equal(clear.doors[0].sequenceLength,2);
  assert.equal(clear.doors[0].nextSequenceStep,3);
  assert.deepEqual(clear.switches.map(s=>s.activated),[true,true]);
  const wrong=run("みどりのまるのぼたんおす");
  assert.equal(wrong.status,"failed");
  assert.equal(wrong.failureReason,"trap");
  const incomplete=run("あおいしかくのぼたんおす");
  assert.equal(incomplete.status,"failed");
  assert.equal(incomplete.failureReason,"door");
});
test("invalid ordered switch definitions are refused before publishing",()=>{
  const change=(map)=>({...stage,objects:stage.objects.map((o,i)=>o.type==="switch"?{...o,...map[i]}:o)});
  for(const candidate of [
    change([{sequenceStep:2},{sequenceStep:2}]),
    change([{sequenceStep:0},{}]),
    change([{sequenceStep:1},{sequenceStep:3}]),
    change([{sequenceStep:1},{sequenceStep:undefined}]),
  ])assert.ok(validateStage("ordered-test",candidate).length>0);
});
for(const n of [20,26]){
  test("stage "+n+" ordered gate has deterministic beginner, fast and wrong-order routes",()=>{
    const stage=read("public/stages/stage-"+n+".json");
    const cases=read("stage-checks/stage-"+n+".json").cases;
    const results=cases.map(c=>{
      const result=analyzeProgram(c.source);
      assert.deepEqual(result.diagnostics,[],c.name);
      const first=runToCompletion(createGame(stage,result.program));
      const again=runToCompletion(createGame(stage,result.program));
      assert.deepEqual([first.status,first.elapsedTicks,first.failureReason,first.doors.map(d=>d.nextSequenceStep)],
        [again.status,again.elapsedTicks,again.failureReason,again.doors.map(d=>d.nextSequenceStep)],c.name);
      return {name:c.name,role:c.role,status:first.status,reason:first.failureReason,ticks:first.elapsedTicks,chars:countSourceCharacters(c.source)};
    });
    for (const [index, actual] of results.entries()) {
      const expected = cases[index];
      assert.equal(actual.status, expected.expect, expected.name);
      if (expected.failureReason) assert.equal(actual.reason, expected.failureReason, expected.name);
      if (expected.expectedTicks !== undefined) assert.equal(actual.ticks, expected.expectedTicks, expected.name);
    }
    assert.equal(results.find(x=>x.role==="beginner")?.status,"cleared");
    assert.equal(results.find(x=>x.name===(n===20?"wrong-order-blocks-gate":"wrong-order-gate"))?.reason,"trap");
  });
}
