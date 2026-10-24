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

test("title WAV has headroom and no hard discontinuity at the loop boundary", () => {
  const wav = Buffer.from(renderTitleAdventure());
  const samples = (wav.length - 44) / 2;
  let peak = 0;
  let sumSquares = 0;
  for (let index = 0; index < samples; index++) {
    const sample = wav.readInt16LE(44 + index * 2);
    peak = Math.max(peak, Math.abs(sample));
    sumSquares += sample * sample;
  }
  const rms = Math.sqrt(sumSquares / samples);
  assert.ok(peak < 32_000);
  assert.ok(rms > 500);
  assert.ok(Math.abs(wav.readInt16LE(44) - wav.readInt16LE(wav.length - 2)) < 100);
});
