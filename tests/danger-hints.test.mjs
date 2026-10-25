import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultFailHint } from "../app/types/game.ts";

const stage = (number) => JSON.parse(readFileSync(new URL(`../public/stages/stage-${number}.json`, import.meta.url), "utf8"));

test("fallback trap and skip hints do not assume every dangerous button is red or that there are three", () => {
  for (const reason of ["trap", "skip"]) {
    const hint = defaultFailHint(reason);
    assert.match(hint, /みおくる/u);
    assert.doesNotMatch(hint, /あかい|赤い|3つ/u);
  }
});

test("all 30 public stage trap hints match the actual danger color and shape", () => {
  for (let number = 1; number <= 30; number++) {
    const data = stage(number);
    const traps = data.objects.filter((item) => item.type === "switch" && item.trap);
    if (!traps.length) continue;
    const hint = data.meta?.failHints?.trap ?? defaultFailHint("trap");
    if (/あかい|赤い/u.test(hint)) {
      assert.ok(traps.every((item) => (item.color ?? "red") === "red"), `stage-${number} mentions only red while other dangerous colors exist`);
    }
  }
});

test("stage 10 warns about both purple triangle and red cross traps", () => {
  const data = stage(10);
  const traps = data.objects.filter((item) => item.type === "switch" && item.trap);
  assert.deepEqual(traps.map(({ color, shape }) => [color, shape]), [["purple", "triangle"], ["red", "cross"]]);
  assert.match(data.meta.failHints.trap, /△/u);
  assert.match(data.meta.failHints.trap, /×/u);
});
