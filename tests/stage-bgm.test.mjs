import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import { stageBgmName, setBgm, setGameBgmRate, unlockAudio } from "../app/game/audio.ts";

test("thirty stages map to sixty unique editor and run soundtracks", () => {
  const names = new Set();
  const signatures = new Set();
  for (let number = 1; number <= 30; number++) {
    for (const mode of ["edit", "run"]) {
      const name = stageBgmName(`stage-${number}`, mode);
      assert.equal(name, `stage-${number}-${mode}`);
      names.add(name);
      const stem = new URL(`../public/audio/bgm/stages/${name}`, import.meta.url);
      for (const extension of ["ogg", "mp3"]) {
        const path = new URL(stem.href + "." + extension);
        assert.ok(existsSync(path), `${name}.${extension} is missing`);
        assert.ok(statSync(path).size > 20_000, `${name}.${extension} is too small`);
        const content = readFileSync(path);
        if (extension === "ogg") {
          assert.equal(content.toString("ascii", 0, 4), "OggS");
          signatures.add(createHash("sha256").update(content).digest("hex"));
        }
      }
    }
  }
  assert.equal(names.size, 60);
  assert.equal(signatures.size, 60);
  assert.equal(stageBgmName("stage-0", "edit"), "title_loop");
  assert.equal(stageBgmName("stage-31", "run"), "game_loop");
  assert.equal(stageBgmName("../stage-1", "edit"), "title_loop");
});

test("stage run soundtracks follow speed changes while editor soundtracks reset speed", () => {
  const created = [];
  class FakeAudio {
    paused = true;
    playbackRate = 1;
    loop = false;
    volume = 1;
    constructor(src) {
      this.src = src;
      created.push(this);
    }
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }
  globalThis.window = { localStorage: { getItem: () => null } };
  globalThis.document = { createElement: () => ({ canPlayType: () => "probably" }) };
  globalThis.Audio = FakeAudio;
  try {
    setBgm(stageBgmName("stage-17", "edit"));
    unlockAudio();
    assert.match(created.at(-1).src, /\/audio\/bgm\/stages\/stage-17-edit\.ogg$/);
    assert.equal(created.at(-1).playbackRate, 1);
    setBgm(stageBgmName("stage-17", "run"));
    assert.match(created.at(-1).src, /\/audio\/bgm\/stages\/stage-17-run\.ogg$/);
    setGameBgmRate(1.3);
    assert.equal(created.at(-1).playbackRate, 1.3);
    setGameBgmRate(1.75);
    assert.equal(created.at(-1).playbackRate, 1.75);
    setBgm(stageBgmName("stage-17", "edit"));
    assert.equal(created.at(-1).playbackRate, 1);
    setBgm(stageBgmName("stage-18", "run"));
    assert.equal(created.at(-1).playbackRate, 1);
  } finally {
    setBgm("title_loop");
    setGameBgmRate(1);
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.Audio;
  }
});
