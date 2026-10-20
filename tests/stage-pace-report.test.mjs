import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("速度と学習バランスの分析CLIは公開1〜7と非公開実験をJSON出力する", () => {
  const output = execFileSync(process.execPath, ["--experimental-strip-types", "scripts/analyze-pace.mjs"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    encoding: "utf8",
    timeout: 15000,
  });
  const report = JSON.parse(output);
  assert.equal(report.stages.length, 7);
  assert.deepEqual(report.stages.map(({ stageId }) => stageId), Array.from({ length: 7 }, (_, i) => "stage-" + (i + 1)));
  for (const stage of report.stages) {
    assert.equal(stage.bestKnown.provenOptimal, false);
    assert.ok(stage.bestKnown.fewestTicks > 0);
    assert.ok(stage.entries.some(({ name, outcome }) => name === "explicit-run" && outcome === "cleared"));
  }
  assert.equal(report.paceRoute.published, false);
  assert.equal(report.stage5Candidate.published, false);
  const byName = Object.fromEntries(report.stage5Candidate.entries.map((item) => [item.name, item]));
  assert.equal(byName.beginner.outcome, "cleared");
  assert.equal(byName.fast.outcome, "cleared");
  assert.equal(byName.genericWalk.outcome, "cleared");
  assert.equal(byName.unsafeGenericRun.outcome, "failed");
  assert.equal(byName.unsafeGenericRun.failureReason, "hole");
  assert.equal(byName.slowedGenericRun.outcome, "cleared");
});
