import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateStageCompetition } from "../app/scoring/competition-audit.ts";
import { validateStageCases } from "../app/stage/validator.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { getScoreReference, compareRuns, countSourceCharacters } from "../app/scoring/score.ts";
import { verifyRunResult } from "../worker/validation.mjs";

const read = (path) => JSON.parse(readFileSync(new URL("../"+path,import.meta.url),"utf8"));
const manifest = read("public/stages/manifest.json");
const expectedFrontier = new Map([["stage-21",3],["stage-22",3],["stage-27",3],["stage-28",3]]);

test("P2 promotion registers at least 3 objectively distinct choices in four advanced stages", () => {
  for (const [stageId, expected] of expectedFrontier) {
    const entry = manifest.stages.find((item) => item.id===stageId);
    const stage = read("public/stages/"+stageId+".json");
    const checks = read("stage-checks/"+stageId+".json");
    const report = validateStageCases(stageId,stage,checks);
    assert.equal(report.pass,true,stageId+": "+JSON.stringify(report.issues));
    const competition = evaluateStageCompetition(stageId,entry.version??manifest.version,stage,checks.cases);
    assert.ok(competition.frontierCount>=expected,stageId+": "+JSON.stringify(competition.frontier));
    assert.equal(competition.submittedOverallIsBest,true,stageId);
    assert.ok(competition.differentObjectives>=2,stageId);
    for (const name of competition.frontier) {
      const registered = checks.cases.find((item)=>item.name===name);
      assert.ok(registered,stageId+": "+name);
      const result = runToCompletion(createGame(stage,analyzeProgram(registered.source).program));
      assert.equal(result.status,"cleared",stageId+": "+name);
      assert.equal(verifyRunResult({
        stageId,source:registered.source,elapsedTicks:result.elapsedTicks,
        completionBp:objectiveProgress(result).completionBp
      }),result.elapsedTicks);
    }
    const original = getScoreReference(stageId,entry.version??manifest.version);
    assert.equal(original?.timeTicks,checks.cases.find((item)=>item.role==="beginner").expectedTicks);
  }
});

test("stage 21 makes saving code vs collecting chest rewards a meaningful scored choice",()=>{
  const stage=read("public/stages/stage-21.json");
  const checks=read("stage-checks/stage-21.json");
  const lookup=(role)=>checks.cases.find((item)=>item.role===role);
  const run=(source)=>runToCompletion(createGame(stage,analyzeProgram(source).program));
  const short=run(lookup("short").source);
  const overall=run(lookup("overall").source);
  assert.equal(short.elapsedTicks,670);
  assert.equal(overall.elapsedTicks,463);
  assert.equal(objectiveProgress(short).completionBp,3250);
  assert.equal(objectiveProgress(overall).completionBp,10000);
  const fullBonus=run(checks.cases.find((item)=>item.name==="p2-full-bonus-compact-sprint").source);
  assert.equal(fullBonus.elapsedTicks,383);
  assert.equal(objectiveProgress(fullBonus).completionBp,5000);
  const scored=(source,result)=>({source,runId:source,elapsedTicks:result.elapsedTicks,charCount:countSourceCharacters(source),completionBp:objectiveProgress(result).completionBp});
  const partial=scored(lookup("overall").source,overall);
  const full=scored(checks.cases.find((item)=>item.name==="p2-full-bonus-compact-sprint").source,fullBonus);
  assert.ok(compareRuns("time",partial,full)<0);
  assert.ok(compareRuns("overall",partial,full)<0);

});

test("stage 22, 27, 28 medium pace routes beat walk while preserving shortest code choice",()=>{
  for(const number of [22,27,28]){
    const stage=read(`public/stages/stage-${number}.json`);
    const checks=read(`stage-checks/stage-${number}.json`);
    const medium=checks.cases.find((c)=>c.name==="p2-medium-pace");
    const beginner=checks.cases.find((c)=>c.role==="beginner");
    const fast=checks.cases.find((c)=>c.role==="fast");
    const short=checks.cases.find((c)=>c.role==="short");
    assert.ok(fast.expectedTicks<medium.expectedTicks&&medium.expectedTicks<beginner.expectedTicks,number.toString());
    const measured=runToCompletion(createGame(stage,analyzeProgram(medium.source).program));
    assert.equal(measured.status,"cleared",number.toString());
    assert.equal(measured.elapsedTicks,medium.expectedTicks);
    assert.equal(objectiveProgress(measured).completionBp,10000);
    assert.ok([...short.source.replaceAll("\n","")].length<[...medium.source.replaceAll("\n","")].length);
  }
});
