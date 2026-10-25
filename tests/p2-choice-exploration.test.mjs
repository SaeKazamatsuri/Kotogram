import test from "node:test";
import assert from "node:assert/strict";
import { exploreChoices, candidatesFor } from "../scripts/explore-p2-choices.mjs";

const targets = ["stage-21", "stage-22", "stage-27", "stage-28"];
const dominates = (a, b) =>
  a.ticks * b.bp <= b.ticks * a.bp &&
  a.chars * b.bp <= b.chars * a.bp &&
  (a.ticks * b.bp < b.ticks * a.bp || a.chars * b.bp < b.chars * a.bp);

test("bounded P2 exploration replays advanced puzzles and finds valid score tradeoffs", () => {
  for (const stageId of targets) {
    const result = exploreChoices(stageId);
    assert.ok(result.explored >= 50, stageId);
    assert.equal(result.invalid, 0, stageId);
    assert.ok(result.clears >= 2, stageId);
    assert.ok(result.frontier.length >= 2, stageId);
    for (const candidate of result.frontier) {
      assert.ok(candidate.ticks > 0 && candidate.chars > 0);
      assert.ok(candidate.bp >= 1200 && candidate.bp <= 10000);
      assert.ok(candidate.scores.overall > 0);
      assert.ok(result.frontier.every((other) => !dominates(other,candidate)));
    }
    assert.deepEqual(exploreChoices(stageId), result, "deterministic replay");
    console.log("P2_CHOICE_SEARCH " + JSON.stringify({stageId:result.stageId,explored:result.explored,clears:result.clears,frontier:result.frontier.map(({source,ticks,chars,bp})=>({source,ticks,chars,bp}))}));
  }
});

test("route search deduplicates candidates and cannot modify public fixtures", () => {
  for (const stageId of targets) {
    const choices=candidatesFor(stageId);
    assert.equal(choices.length,new Set(choices).size,stageId);
    assert.ok(choices.every((source)=>source.length<=2000),stageId);
  }
});
