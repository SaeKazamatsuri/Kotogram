import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { countSourceCharacters, compareRuns, getScoreReference, calculateScores, selectBestRuns } from "../app/scoring/score.ts";
import { validateStage } from "../app/stage/validator.ts";
import { verifyRunResult } from "../worker/validation.mjs";

const read=path=>JSON.parse(readFileSync(new URL("../"+path,import.meta.url),"utf8"));
const manifest=read("public/stages/manifest.json");
function replay(stage,source){
 const parsed=analyzeProgram(source);
 assert.deepEqual(parsed.diagnostics,[],source);
 return runToCompletion(createGame(stage,parsed.program),20000);
}
for(const number of [8,10]){
 test(`stage ${number} preserves precision vs secret speed/length tradeoffs under bypass risk`,()=>{
  const id=`stage-${number}`;
  const stage=read(`public/stages/${id}.json`);
  const checks=read(`stage-checks/${id}.json`).cases;
  const version=manifest.stages.find(x=>x.id===id).version;
  const ref=getScoreReference(id,version);
  assert.equal(version,"2026-10-25-r5");
  assert.deepEqual(validateStage(id,stage,true),[]);
  assert.equal(stage.secretDoorRiskBp,8300);
  assert.equal(getScoreReference(id,"2026-10-25-r4")?.product,ref.product);
  const found=role=>checks.find(x=>x.role===role);
  const make=(source,runId)=>{
    const game=replay(stage,source);
    assert.equal(game.status,"cleared",source);
    const completionBp=objectiveProgress(game).completionBp;
    return {runId,source,elapsedTicks:game.elapsedTicks,charCount:countSourceCharacters(source),completionBp,game};
  };
  const beginner=make(found("beginner").source,"beginner");
  const normal=make(found("fast").source,"normal");
  const secret=make(found("overall").source,"secret");
  const pure=make("とびらをやぶる","unrewarded");
  assert.equal(beginner.completionBp,10000);
  assert.equal(normal.completionBp,10000);
  assert.equal(secret.completionBp,6889);
  assert.equal(objectiveProgress(secret.game).secretDoorRiskBp,6889);
  assert.equal(pure.completionBp,1200);
  assert.equal(secret.game.doors.filter(x=>x.broken).length,2);
  assert.ok(compareRuns("time",normal,secret)<0,"ordinary precision must win adjusted time");
  assert.ok(compareRuns("overall",secret,normal)<0,"secret route can win overall despite risk");
  const bonusPower=make("すいっちみおくる\nこいんとる\nとびらめっちゃとぶ","vault");
  assert.equal(bonusPower.completionBp,6889);
  const all=checks.filter(c=>c.expect==="cleared").map(c=>make(c.source,c.name));
  const best=selectBestRuns(all);
  assert.equal(best.overall.runId,found("overall").name);
  assert.ok(new Set([best.time.runId,best.chars.runId,best.overall.runId]).size>=2);
  assert.equal(verifyRunResult({stageId:id,source:secret.source,elapsedTicks:secret.elapsedTicks,completionBp:6889}),secret.elapsedTicks);
  assert.throws(()=>verifyRunResult({stageId:id,source:secret.source,elapsedTicks:secret.elapsedTicks,completionBp:10000}),/objective progress/);
  console.log("P2_SECRET_BALANCE "+JSON.stringify({stage:id,version,
    ordinary:{ticks:normal.elapsedTicks,chars:normal.charCount,bp:normal.completionBp,scores:calculateScores(ref,normal)},
    secret:{ticks:secret.elapsedTicks,chars:secret.charCount,bp:secret.completionBp,scores:calculateScores(ref,secret)},
    best:{time:best.time.runId,chars:best.chars.runId,overall:best.overall.runId}}));
 });
}
test("risk parameter is opt-in and its bounds are rejected outside a safe range",()=>{
 const stage=read("public/stages/stage-8.json");
 for(const risk of [0,5999,10001,1.5,NaN]){
  assert.ok(validateStage("stage-8",{...stage,secretDoorRiskBp:risk}).some(x=>x.path==="secretDoorRiskBp"));
 }
 const without=read("public/stages/stage-9.json");
 const source="すいっちみおくる\nこいんとる\nとびらをやぶる";
 const run=replay(without,source);
 assert.equal(run.status,"cleared");
 assert.equal(run.secretDoorRiskBp,10000);
});
