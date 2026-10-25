import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateManifest, validateStageCases } from "../app/stage/validator.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { analyzeJumpTrajectories } from "../app/game/trajectory.ts";
import { getScoreReference } from "../app/scoring/score.ts";

const read = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));

test("ステージ5のr2公開後も他のステージ版を維持する", () => {
  const manifest = read("public/stages/manifest.json");
  assert.deepEqual(validateManifest(manifest), []);
  assert.equal(manifest.version, "2025-10-26");
  for (const entry of manifest.stages) {
    assert.equal(entry.version, ["stage-8", "stage-9", "stage-10", "stage-13", "stage-18", "stage-19", "stage-23", "stage-24", "stage-25"].includes(entry.id) ? "2026-10-25-r3" : ["stage-11", "stage-12", "stage-14", "stage-15", "stage-16", "stage-17", "stage-20", "stage-21", "stage-22", "stage-26", "stage-27", "stage-28", "stage-29", "stage-30"].includes(entry.id) ? "2026-10-25-r2" : ["stage-5"].includes(entry.id) ? "2026-10-20-r2" : ["stage-2", "stage-3"].includes(entry.id) || Number(entry.id.slice(6)) >= 9 ? "2026-10-20-r1" : undefined);
    assert.ok(getScoreReference(entry.id, entry.version ?? manifest.version));
  }
  assert.ok(validateManifest({ ...manifest, stages: [{ ...manifest.stages[0], version: " " }, ...manifest.stages.slice(1)] }).length > 0);
});

test("変更前後の採点基準を異なる版で保持する", () => {
  assert.equal(getScoreReference("stage-3", "2025-10-26")?.timeTicks, 1434);
  assert.equal(getScoreReference("stage-3", "2026-10-20-r1")?.timeTicks, 834);
  assert.equal(getScoreReference("stage-3", "2026-10-20-r1")?.product, 11676);
  assert.equal(getScoreReference("stage-5", "2025-10-26")?.timeTicks, 746);
  assert.equal(getScoreReference("stage-5", "2026-10-20-r1")?.timeTicks, 746);
  assert.equal(getScoreReference("stage-5", "2026-10-20-r2")?.timeTicks, 746);
  assert.equal(getScoreReference("stage-5", "2026-10-20-r2")?.characters, 14);
  assert.equal(getScoreReference("stage-5", "2026-10-20-r2")?.product, 10444);
  assert.equal(getScoreReference("stage-5", "2026-10-20-r3"), null);
  assert.equal(getScoreReference("stage-1", "2026-10-20-r1"), null);
  assert.equal(getScoreReference("stage-8", "2026-10-20-r1")?.timeTicks, 846);
  assert.equal(getScoreReference("stage-8", "2026-10-20-r1")?.product, 18612);
  assert.equal(getScoreReference("stage-8", "2026-10-20-r2")?.characters, 30);
  assert.equal(getScoreReference("stage-8", "2026-10-20-r2")?.product, 25380);
});

test("公開ステージ3の短縮版は通常と高速でクリアする", () => {
  const stage = read("public/stages/stage-3.json");
  const checks = read("stage-checks/stage-3.json");
  assert.equal(stage.objects.length, 7);
  const report = validateStageCases("stage-3", stage, checks);
  assert.equal(report.pass, true, JSON.stringify(report));
  assert.equal(report.cases.find((x) => x.role === "beginner")?.elapsedTicks, 834);
  assert.equal(report.cases.find((x) => x.role === "fast")?.elapsedTicks, 642);
});

test("公開の穴付きステージでジャンプの最高点が穴の中心に近い", () => {
  for (const id of ["stage-2", "stage-3", "stage-5"]) {
    const stage = read("public/stages/" + id + ".json");
    const cases = read("stage-checks/" + id + ".json");
    for (const item of cases.cases.filter((entry) => entry.role === "beginner" || entry.role === "fast")) {
      const trace = analyzeJumpTrajectories(stage, analyzeProgram(item.source).program);
      assert.equal(trace.status, "cleared", id + " " + item.role);
      const holes = trace.jumps.filter((jump) => jump.target?.type === "hole");
      assert.ok(holes.length > 0, id);
      for (const hole of holes) {
        assert.ok(Math.abs(hole.peakOffsetX) <= 24, id + " " + item.role + ": " + hole.peakOffsetX);
      }
    }
  }
});
