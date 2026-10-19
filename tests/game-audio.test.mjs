import assert from "node:assert/strict";
import test from "node:test";
import { createGame } from "../app/game/core.ts";
import { gameAudioEvents, snapshotGameAudio } from "../app/game/audio-events.ts";

test("jump, landing and crouch emit only on transitions", () => {
  const game = createGame({});
  let before = snapshotGameAudio(game);
  game.vy = -11;
  assert.deepEqual(gameAudioEvents(before, game), ["jump"]);
  before = snapshotGameAudio(game);
  assert.deepEqual(gameAudioEvents(before, game), []);
  game.vy = 0;
  assert.deepEqual(gameAudioEvents(before, game), ["land"]);
  before = snapshotGameAudio(game);
  game.crouchUntilTick = game.elapsedTicks + 20;
  assert.deepEqual(gameAudioEvents(before, game), ["crouch"]);
});

test("coin, avoid, door and hit events follow successful game mutations", () => {
  const game = createGame({});
  game.coins.push({ id: "coin:0", x: 220, collected: false });
  game.walls.push({ id: "wall:0", x: 240, cleared: false });
  game.doors.push({ id: "door:0", x: 260, open: false });
  let before = snapshotGameAudio(game);
  game.coins[0].collected = true;
  game.walls[0].cleared = true;
  game.doors[0].open = true;
  assert.deepEqual(gameAudioEvents(before, game), ["score", "avoid", "confirm"]);
  before = snapshotGameAudio(game);
  assert.deepEqual(gameAudioEvents(before, game), []);
  game.status = "failed";
  assert.deepEqual(gameAudioEvents(before, game), ["hit"]);
});
