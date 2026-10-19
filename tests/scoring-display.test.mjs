import test from "node:test";
import assert from "node:assert/strict";
import { formatBestScore } from "../app/scoring/display.ts";

const at = (runId, elapsedTicks, charCount) => ({ runId, elapsedTicks, charCount, source: "かべとぶ" });

test("local best records use three independent 1000-point references", () => {
  const bests = {
    time: at("fast", 356, 8),
    chars: at("short", 1200, 2),
    overall: at("balanced", 356, 4),
  };
  assert.equal(formatBestScore("stage-1", "2025-10-26", bests, "time"), "2,000点");
  assert.equal(formatBestScore("stage-1", "2025-10-26", bests, "chars"), "2,000点");
  assert.equal(formatBestScore("stage-1", "2025-10-26", bests, "overall"), "2,000点");
  assert.equal(formatBestScore("stage-1", "2025-10-26", { overall: at("reference", 712, 4) }, "overall"), "1,000点");
});

test("missing bests and unsupported versions show a dash instead of misleading raw products", () => {
  const bests = { overall: at("best", 356, 4) };
  assert.equal(formatBestScore("stage-1", "2025-10-26", bests, "time"), "－");
  assert.equal(formatBestScore("stage-1", "unknown", bests, "overall"), "－");
  assert.equal(formatBestScore("missing", "2025-10-26", bests, "overall"), "－");
});
