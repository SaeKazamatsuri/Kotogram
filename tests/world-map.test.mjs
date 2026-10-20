import test from "node:test";
import assert from "node:assert/strict";
import { currentWorldStageId, worldMapPosition } from "../app/stage/world-map.ts";

const stages = Array.from({ length: 7 }, (_, index) => ({ id: `stage-${index + 1}` }));

test("map selects the first available uncleared stage", () => {
  assert.equal(currentWorldStageId(stages, () => false), "stage-1");
  const cleared = new Set(["stage-1", "stage-2", "stage-3"]);
  assert.equal(currentWorldStageId(stages, (id) => cleared.has(id)), "stage-4");
  assert.equal(currentWorldStageId(stages, () => true), "stage-7");
  assert.equal(currentWorldStageId([], () => false), null);
});

test("map stops have distinct desktop and mobile coordinates", () => {
  const stops = stages.map((_, index) => worldMapPosition(index));
  for (const stop of stops) {
    for (const value of [stop.x, stop.y, stop.mobileX, stop.mobileY]) {
      assert.ok(value > 0 && value < 100);
    }
  }
  assert.equal(new Set(stops.map((stop) => stop.x)).size, 7);
  assert.equal(new Set(stops.map((stop) => stop.mobileY)).size, 7);
  assert.ok(stops.every((stop, index) => index === 0 || stop.mobileY > stops[index - 1].mobileY));
});

test("eighth world-map stop stays inside the extended map", () => {
  const eighth = worldMapPosition(7);
  assert.ok(eighth.x > 0 && eighth.x < 100);
  assert.ok(eighth.y > 0 && eighth.y < 100);
  assert.ok(eighth.mobileY > worldMapPosition(6).mobileY && eighth.mobileY < 100);
  assert.notDeepEqual(eighth, worldMapPosition(6));
});
