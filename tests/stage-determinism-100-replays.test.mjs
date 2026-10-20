import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";

function readJson(path) {
  return JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
}

function snapshot(game) {
  return {
    status: game.status,
    elapsedTicks: game.elapsedTicks,
    failureReason: game.failureReason ?? null,
    px: game.px,
    py: game.py,
    walls: game.walls.map(({ id, cleared }) => [id, cleared]),
    ghosts: game.ghosts.map(({ id, cleared }) => [id, cleared]),
    coins: game.coins.map(({ id, collected }) => [id, collected]),
    doors: game.doors.map(({ id, open }) => [id, open]),
    switches: game.switches.map(({ id, activated }) => [id, activated]),
    fired: game.fired.map((ids) => [...ids].sort()),
    cursor: game.cursor,
    sequenceProgress: game.sequenceProgress,
    sequenceConsumed: [...game.sequenceConsumed].sort(),
    loops: game.loops,
  };
}

test("all published stage solutions are deterministic across 100 fresh replays", () => {
  const manifest = readJson("public/stages/manifest.json");
  assert.equal(manifest.stages.length, 30);
  for (const item of manifest.stages) {
    const stage = readJson("public" + item.file);
    const checks = readJson("stage-checks/" + item.id + ".json");
    const reference = checks.cases.find((entry) => entry.role === "beginner" && entry.expect === "cleared");
    assert.ok(reference, item.id);
    const analysis = analyzeProgram(reference.source);
    assert.deepEqual(analysis.diagnostics, [], item.id);
    const make = () => runToCompletion(createGame(stage, analysis.program), checks.maxTicks ?? 20000);
    const expected = snapshot(make());
    assert.equal(expected.status, "cleared", item.id);
    if (Number.isInteger(reference.expectedTicks)) assert.equal(expected.elapsedTicks, reference.expectedTicks, item.id);
    for (let repeat = 0; repeat < 100; repeat++) {
      assert.deepEqual(snapshot(make()), expected, item.id + " replay " + (repeat + 1));
    }
  }
});
