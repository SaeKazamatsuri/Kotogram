import { analyzeProgram } from "../language/parser.ts";
import { createGame, runToCompletion } from "../game/core.ts";
import { objectiveProgress } from "./objectives.ts";
import { calculateScores, compareRuns, countSourceCharacters, getScoreReference, selectBestRuns } from "./score.ts";

export function evaluateStageCompetition(stageId, stageVersion, stage, cases) {
  const reference = getScoreReference(stageId, stageVersion);
  if (!reference) throw new Error(stageId + " missing scoring reference for " + stageVersion);
  const attempts = cases.map((item, index) => {
    const parsed = analyzeProgram(item.source);
    if (parsed.diagnostics.length) throw new Error(stageId + "/" + item.name + " parser: " + JSON.stringify(parsed.diagnostics));
    const result = runToCompletion(createGame(stage, parsed.program), 20000);
    if (result.status !== item.expect || (item.expectedTicks !== undefined && item.expectedTicks !== result.elapsedTicks) ||
        (item.failureReason && item.failureReason !== result.failureReason))
      throw new Error(stageId + "/" + item.name + " replay diverged: " + result.status + "/" + result.elapsedTicks);
    const progress = objectiveProgress(result);
    const run = {
      runId: stageId + "/" + String(index).padStart(3,"0"), name: item.name, role: item.role,
      source: item.source, status: result.status, elapsedTicks: result.elapsedTicks,
      charCount: countSourceCharacters(item.source), completionBp: progress.completionBp,
      coinProgress: progress.collected + "/" + progress.coinTarget,
      skipProgress: progress.skipped + "/" + progress.skipTarget,
      useSecret: /めっちゃ|すごい|とびらをやぶる/u.test(item.source),
    };
    return { ...run, ...(result.status === "cleared" ? { scores: calculateScores(reference, run) } : {}) };
  });
  const cleared = attempts.filter(a => a.status === "cleared");
  if (!cleared.length) throw new Error(stageId + " has no passing examples");
  const best = selectBestRuns(cleared);
  // Pareto values account for bonus objectives, exactly like the server ranking:
  // elapsedTicks/completionBp and charCount/completionBp.
  const dominates = (a,b) => {
    const faster = a.elapsedTicks * b.completionBp <= b.elapsedTicks * a.completionBp;
    const smaller = a.charCount * b.completionBp <= b.charCount * a.completionBp;
    const strict = a.elapsedTicks * b.completionBp < b.elapsedTicks * a.completionBp ||
      a.charCount * b.completionBp < b.charCount * a.completionBp;
    return faster && smaller && strict;
  };
  const frontier = cleared.filter(a => !cleared.some(b => b!==a && dominates(b,a))).map(a => a.name);
  const byRole = Object.fromEntries(["beginner","short","fast","overall"].map(role => [role,cleared.find(a => a.role===role) ?? null]));
  const winner = key => ({name:best[key].name,role:best[key].role,
    ticks:best[key].elapsedTicks,characters:best[key].charCount,
    bonusPct:best[key].completionBp/100,score:Math.round(best[key].scores[key==="speed"?"time":key==="compact"?"chars":"overall"]*100)/100});
  const bestStats = {
    time: { ...winner("time"),score:Math.round(best.time.scores.time*100)/100 },
    chars: { ...winner("chars"),score:Math.round(best.chars.scores.chars*100)/100 },
    overall: { ...winner("overall"),score:Math.round(best.overall.scores.overall*100)/100 },
  };
  const overallSubmitted = byRole.overall;
  return {
    stageId,stageVersion,objectCount:stage.objects?.length??0, optionalObjectives:stage.optionalObjectives===true,
    registered:cases.length,clearCount:cleared.length,
    frontier,frontierCount:frontier.length,best:bestStats,
    submittedOverallIsBest:overallSubmitted?.runId===best.overall.runId,
    differentObjectives: new Set([best.time.runId,best.chars.runId,best.overall.runId]).size,
    timeGainPct: Math.round((1-best.time.elapsedTicks/byRole.beginner.elapsedTicks)*1000)/10,
    charsGainPct: Math.round((1-best.chars.charCount/byRole.beginner.charCount)*1000)/10,
    secret:cleared.filter(x=>x.useSecret).map(x=>x.name),
    optionalBypass:cleared.filter(x=>x.completionBp<10000).map(x=>({name:x.name,pct:x.completionBp/100})),
    reference:{ticks:reference.timeTicks,characters:reference.characters},
  };
}

export function summarizeCompetition(rows) {
  const mean = f => Math.round(rows.reduce((sum,row)=>sum+f(row),0)/rows.length*10)/10;
  return {
    stageCount:rows.length,
    registeredRoutes:rows.reduce((a,r)=>a+r.registered,0),
    successfulRoutes:rows.reduce((a,r)=>a+r.clearCount,0),
    multiObjectiveStages:rows.filter(r=>r.differentObjectives>1).map(r=>r.stageId),
    multiParetoStages:rows.filter(r=>r.frontierCount>1).map(r=>r.stageId),
    registeredOverallMismatch:rows.filter(r=>!r.submittedOverallIsBest).map(r=>r.stageId),
    scorePenaltyRoutes:rows.filter(r=>r.optionalBypass.length).map(r=>r.stageId),
    singleFrontierStages:rows.filter(r=>r.frontierCount===1).map(r=>r.stageId),
    averageTimeGainPct:mean(r=>r.timeGainPct),
    averageCharsGainPct:mean(r=>r.charsGainPct),
    worlds:[1,2,3].map(n=>{
      const group=rows.slice((n-1)*10,n*10);
      return {world:n,meanClearTicks:Math.round(group.reduce((s,r)=>s+r.best.time.ticks,0)/group.length),
        meanMinCharacters:Math.round(group.reduce((s,r)=>s+r.best.chars.characters,0)/group.length*10)/10,
        multiPareto:group.filter(r=>r.frontierCount>1).length,
        optionalPenalty:group.filter(r=>r.optionalBypass.length).length};
    }),
  };
}
