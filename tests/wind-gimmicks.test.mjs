import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGame, stepGame, runToCompletion } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { validateStage } from "../app/stage/validator.ts";
import { suggestedStageWords } from "../app/stage/vocabulary.ts";
import { countSourceCharacters } from "../app/scoring/score.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
const read = p => JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));

test("風は空中の横速度だけを変え、地上の移動・既存ステージには影響しない", () => {
  const plain={goal:800,scrollSpeed:3,objects:[]};
  const wind={goal:800,scrollSpeed:3,objects:[{id:"gust",type:"wind",position:70,width:260,multiplier:1.5}]};
  assert.deepEqual(validateStage("wind-example",wind),[]);
  const airbornePlain=createGame(plain,analyzeProgram("とぶ").program);
  const airborneWind=createGame(wind,analyzeProgram("とぶ").program);
  const groundPlain=createGame(plain,[]);
  const groundWind=createGame(wind,[]);
  for(let i=0;i<12;i++){stepGame(airbornePlain);stepGame(airborneWind);stepGame(groundPlain);stepGame(groundWind);}
  assert.ok(airborneWind.px>airbornePlain.px+10);
  assert.equal(groundPlain.px,groundWind.px);
  assert.deepEqual(analyzeProgram("かぜがあったらとぶ").rules[0].conds,["wind"]);
  assert.ok(suggestedStageWords(wind).conditions.includes("wind"));
  assert.ok(!suggestedStageWords(plain).conditions.includes("wind"));
});
test("風の異常値や狭すぎる領域をステージValidatorで拒否する",()=>{
  for(const obj of [
    {id:"wind",type:"wind",position:100,width:0,multiplier:1.3},
    {id:"wind",type:"wind",position:100,width:180,multiplier:0},
    {id:"wind",type:"wind",position:100,width:180,multiplier:3},
  ])assert.ok(validateStage("wind-example",{goal:800,scrollSpeed:3,objects:[obj]}).some(x=>/width|multiplier/.test(x.path)));
});
for(const n of [23,25,29]) {
  test("stage "+n+" wind routes replay deterministically", () => {
    const stage=read("public/stages/stage-"+n+".json");
    const checks=read("stage-checks/stage-"+n+".json");
    const result=[];
    for(const item of checks.cases){
      const parsed=analyzeProgram(item.source);
      assert.deepEqual(parsed.diagnostics,[],item.name);
      const first=runToCompletion(createGame(stage,parsed.program));
      const again=runToCompletion(createGame(stage,parsed.program));
      assert.deepEqual([first.status,first.failureReason,first.elapsedTicks,objectiveProgress(first)],
        [again.status,again.failureReason,again.elapsedTicks,objectiveProgress(again)],item.name);
      result.push({name:item.name,role:item.role,status:first.status,failure:first.failureReason,ticks:first.elapsedTicks,chars:countSourceCharacters(item.source),bp:objectiveProgress(first).completionBp});
    }
    for (const [index, route] of result.entries()) {
      const expected = checks.cases[index];
      assert.equal(route.status, expected.expect, expected.name);
      if (expected.failureReason) assert.equal(route.failure, expected.failureReason, expected.name);
      if (expected.expectedTicks !== undefined) assert.equal(route.ticks, expected.expectedTicks, expected.name);
    }
    assert.equal(result.find(x => x.role === "beginner")?.bp, n === 25 ? 5800 : 10000);
    if (n === 25) assert.equal(result.find(x => x.name === "coin-bonus-is-optional")?.bp, 3000);
    if (n === 29) assert.equal(result.find(x => x.name === "last-bonus-can-be-missed")?.bp, 3000);
    assert.ok(suggestedStageWords(stage).conditions.includes("wind"));
  });
}
