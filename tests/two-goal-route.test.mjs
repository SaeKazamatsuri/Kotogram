import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion, stepGame } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { compareRuns, calculateScores, countSourceCharacters } from "../app/scoring/score.ts";
import { validateStage } from "../app/stage/validator.ts";
import { suggestedStageWords } from "../app/stage/vocabulary.ts";
import { drawFinish } from "../app/game/obstacles.ts";
import { verifyRunResult, verifyStageRunResult } from "../worker/validation.mjs";

const read = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const stage = read("experiments/stages/two-goal-route.json");
const run = (source, world = stage) => {
  const parsed = analyzeProgram(source);
  assert.deepEqual(parsed.diagnostics, [], source);
  return runToCompletion(createGame(world, parsed.program), 20000);
};
const sourceNear = "こいんとる";
const sourceFar = "ごーるをみおくる\nこいんとる\nかべとぶ";
const full = (game, source) => ({ runId: source, elapsedTicks: game.elapsedTicks, charCount: countSourceCharacters(source), completionBp: objectiveProgress(game).completionBp });

test("two goals opt in by schema while existing 30 public stage definitions remain valid", () => {
  assert.deepEqual(validateStage(stage.id, stage, true), []);
  const manifest = read("public/stages/manifest.json");
  assert.equal(manifest.stages.length, 30);
  assert.equal(manifest.stages.some((entry) => entry.id === stage.id), false);
  for (const { id, file } of manifest.stages) {
    assert.deepEqual(validateStage(id, read("public"+file)), [], id);
  }
  assert.equal(suggestedStageWords(stage).conditions.includes("goal"), true);
  assert.equal(suggestedStageWords(stage).actions.includes("skip"), true);
  assert.equal(suggestedStageWords(read("public/stages/stage-1.json")).conditions.includes("goal"), false);
});

test("Japanese goal condition skips only the nearby goal and does not override switch skip", () => {
  const parsed = analyzeProgram("ごーるをみおくる");
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(parsed.program.watchers.map((item) => [item.conds, item.action]), [[["goal"], "skip"]]);
  assert.deepEqual(analyzeProgram("もしごーるがきたら\nみおくる\nおわり").diagnostics, []);
  assert.deepEqual(analyzeProgram("すいっちみおくる").diagnostics, []);
  assert.ok(analyzeProgram("みおくる").diagnostics.length > 0);
  assert.ok(analyzeProgram("こいんみおくる").diagnostics.length > 0);
  const game = run(sourceFar);
  assert.equal(game.status, "cleared");
  assert.equal(game.goals[0].skipped, true);
  assert.equal(game.goals[1].skipped, false);
  assert.equal(game.goals[1].reached, true);
  assert.equal(game.selectedGoalId, "treasure-goal");
});

test("quick goal rewards speed while treasure goal rewards completion", () => {
  const near = run(sourceNear);
  const far = run(sourceFar);
  assert.equal(near.status, "cleared");
  assert.equal(far.status, "cleared");
  assert.equal(near.selectedGoalId, "quick-goal");
  assert.equal(near.goalBonusBp, 5000);
  assert.deepEqual(near.goals.map((item) => item.reached), [true, false]);
  assert.equal(far.goalBonusBp, 10000);
  assert.equal(near.coins.filter((coin) => coin.collected).length, 1);
  assert.equal(far.coins.filter((coin) => coin.collected).length, 2);
  assert.equal(objectiveProgress(near).completionBp, 3250);
  assert.equal(objectiveProgress(far).completionBp, 10000);
  assert.ok(near.elapsedTicks < far.elapsedTicks);
  assert.equal(run(sourceFar).elapsedTicks, far.elapsedTicks);
  assert.equal(verifyStageRunResult(stage,{source:sourceNear,elapsedTicks:near.elapsedTicks,completionBp:3250}),near.elapsedTicks);
  assert.equal(verifyStageRunResult(stage,{source:sourceFar,elapsedTicks:far.elapsedTicks,completionBp:10000}),far.elapsedTicks);
  assert.throws(()=>verifyStageRunResult(stage,{source:sourceNear,elapsedTicks:near.elapsedTicks,completionBp:10000}),/objective progress/);
  assert.throws(()=>verifyStageRunResult(stage,{source:sourceFar,elapsedTicks:near.elapsedTicks,completionBp:10000}),/verified clear time/);
  const reference = { stageId:"fixture",stageVersion:"new",scoringVersion:"2026-v2",timeTicks:near.elapsedTicks,characters:countSourceCharacters(sourceNear),product:near.elapsedTicks*countSourceCharacters(sourceNear) };
  const nearRun=full(near,sourceNear),farRun=full(far,sourceFar);
  assert.ok(calculateScores(reference,nearRun).overall>0);
  assert.ok(calculateScores(reference,farRun).overall>0);
  assert.ok(compareRuns("time",farRun,nearRun)<0);
  assert.ok(compareRuns("chars",nearRun,farRun)<0);
  assert.ok(compareRuns("overall",nearRun,farRun)<0);
});

test("skipping the near goal without a safe continuation loses to a wall", () => {
  const blocked = run("ごーるみおくる");
  assert.equal(blocked.status, "failed");
  assert.equal(blocked.failureReason, "wall");
  assert.equal(blocked.goals[0].skipped, true);
  const noSkip = run("こいんとる\nかべとぶ");
  assert.equal(noSkip.status, "cleared");
  assert.equal(noSkip.selectedGoalId, "quick-goal");
});

test("goal skip can only be accepted near the target; older games remain unchanged", () => {
  const game=createGame(stage,analyzeProgram("ごーるみおくる").program);
  stepGame(game);
  assert.equal(game.goals[0].skipped,false);
  assert.equal(game.selectedGoalId,null);
  const legacy = read("public/stages/stage-1.json");
  const oldRun=run("かべとぶ",legacy);
  assert.equal(oldRun.status,"cleared");
  assert.equal(oldRun.elapsedTicks,712);
  assert.equal(oldRun.goalBonusBp,10000);
  assert.equal(objectiveProgress(oldRun).completionBp,10000);
  assert.equal(verifyRunResult({stageId:"stage-1",source:"かべとぶ",elapsedTicks:712,completionBp:10000}),712);
});

test("dual-goal schema rejects missing identifiers, conflicting order, poor spacing and reward inflation", () => {
  const changed = (fn) => { const value = structuredClone(stage); fn(value); return validateStage(value.id,value,true); };
  assert.ok(changed((s)=>{s.objects[1].bonusBp=10001}).some((e)=>e.path.endsWith("bonusBp")));
  assert.ok(changed((s)=>{s.objects[4].bonusBp=9000}).some((e)=>e.path.endsWith("bonusBp")));
  assert.ok(changed((s)=>{s.objects[1].position=990}).some((e)=>e.path.endsWith("position")));
  assert.ok(changed((s)=>{s.objects[4].position=1200}).some((e)=>e.message.includes("stage.goal")));
  assert.ok(changed((s)=>{s.objects[1].id=s.objects[4].id}).some((e)=>e.message.includes("duplicate")));
  assert.ok(changed((s)=>{s.objects.push({type:"goal",id:"extra-goal",position:1000,bonusBp:8000})}).some((e)=>e.message.includes("at most two")));
  assert.ok(changed((s)=>{s.objects=[...s.objects.filter((x)=>x.id!=="quick-goal")];s.objects[3].bonusBp=10000}).some((e)=>e.message.includes("single-goal")));
});

test("near and far goals are labelled with symbols not only different colors",()=>{
  const game=createGame(stage);
  game.px=600;
  const labels=[];
  const ctx=new Proxy({fillText:(text)=>labels.push(text)},{get:(obj,key)=>key in obj ? obj[key] : ()=>{} ,set:(obj,key,value)=>{obj[key]=value;return true;}});
  drawFinish(ctx,game);
  assert.ok(labels.includes("ちかみち"));
  assert.ok(labels.includes("ごほうび"));
  assert.ok(labels.includes("①"));
  assert.ok(labels.includes("☆"));
  game.goals[0].skipped=true;
  labels.length=0;
  drawFinish(ctx,game);
  assert.ok(labels.includes("みおくった"));
});

test("near and far goal outcomes replay exactly 100 times without affecting frame clock",()=>{
  for(const source of [sourceNear,sourceFar]){
    const game=run(source);
    const expected=[game.status,game.elapsedTicks,game.selectedGoalId,objectiveProgress(game).completionBp];
    for(let repeat=0;repeat<100;repeat++){
      const r=run(source);
      assert.deepEqual([r.status,r.elapsedTicks,r.selectedGoalId,objectiveProgress(r).completionBp],expected);
    }
  }
});
