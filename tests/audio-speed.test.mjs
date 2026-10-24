import test from "node:test";
import assert from "node:assert/strict";
import { setBgm, setGameBgmRate, unlockAudio } from "../app/game/audio.ts";

test("game music follows running speed and resets outside the game", () => {
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
    setBgm("game_loop");
    unlockAudio();
    assert.equal(created.at(-1).playbackRate, 1);
    setGameBgmRate(1.3);
    assert.equal(created.at(-1).playbackRate, 1.3);
    setGameBgmRate(1.75);
    assert.equal(created.at(-1).playbackRate, 1.75);
    setGameBgmRate(Number.NaN);
    assert.equal(created.at(-1).playbackRate, 1.75);
    setBgm("title_loop");
    assert.equal(created.at(-1).playbackRate, 1);
    setBgm("game_loop");
    assert.equal(created.at(-1).playbackRate, 1);
    setGameBgmRate(1);
  } finally {
    setBgm("title_loop");
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.Audio;
  }
});
