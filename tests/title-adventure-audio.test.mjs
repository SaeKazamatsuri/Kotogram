import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderTitleAdventure } from "../scripts/generate_title_adventure.mjs";

test("original title composition is deterministic, playable and committed", () => {
  const rendered = Buffer.from(renderTitleAdventure());
  const committed = readFileSync(new URL("../public/audio/bgm/title_adventure.wav", import.meta.url));
  assert.deepEqual(committed, rendered);
  assert.equal(committed.toString("ascii", 0, 4), "RIFF");
  assert.equal(committed.toString("ascii", 8, 12), "WAVE");
  assert.equal(committed.readUInt32LE(24), 32000);
  assert.equal(committed.readUInt16LE(22), 1);
  assert.equal(committed.readUInt16LE(34), 16);
  assert.ok(committed.length > 500_000);
});

test("title music has its own selection without changing map, game or result loops", () => {
  const audio = readFileSync(new URL("../app/game/audio.ts", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/layouts/default.vue", import.meta.url), "utf8");
  assert.match(audio, /title_adventure\.wav/);
  assert.match(layout, /route\.path === "\/" \? "title_adventure" : "title_loop"/);
  for (const name of ["title_loop", "game_loop", "result_loop"]) assert.match(audio, new RegExp(name));
});
