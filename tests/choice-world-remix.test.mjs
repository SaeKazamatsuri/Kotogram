import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { countSourceCharacters } from "../app/scoring/score.ts";
const read = p => JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
for(const number of [14,19,27]){
  test("Remixed stage " + number + " tracks choice routes deterministically", () => {
    const stage=read("public/stages/stage-"+number+".json");
    const checks=read("stage-checks/stage-"+number+".json");
    const results=[];
    for(const c of checks.cases) {
      const parsed=analyzeProgram(c.source);
      assert.deepEqual(parsed.diagnostics,[],c.name);
      const first=runToCompletion(createGame(stage,parsed.program));
      const second=runToCompletion(createGame(stage,parsed.program));
      assert.deepEqual([first.status,first.elapsedTicks,first.failureReason,objectiveProgress(first)],[second.status,second.elapsedTicks,second.failureReason,objectiveProgress(second)],c.name);
      results.push({name:c.name,role:c.role,status:first.status,reason:first.failureReason,ticks:first.elapsedTicks,chars:countSourceCharacters(c.source),bp:objectiveProgress(first).completionBp});
    }
    console.log("CHOICE_WORLD_REPORT "+JSON.stringify({number,results}));
  });
}
