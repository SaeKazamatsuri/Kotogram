import test from "node:test";
import assert from "node:assert/strict";
import { GAME, createGame } from "../app/game/core.ts";
import { drawAnimatedCharacter } from "../app/game/character.ts";
import { drawHoles, drawWorldObjects } from "../app/game/obstacles.ts";

function recordedContext() {
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key === "createLinearGradient") return () => ({ addColorStop() {} });
      return target[key] ?? ((...args) => calls.push([key, ...args]));
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { ctx, calls };
}

test("character origin tracks physical jumping Y while keeping grounded feet at ground level", () => {
  const game = createGame({ goal: 1000, scrollSpeed: 3 });
  const origin = game.py;
  const grounded = recordedContext();
  drawAnimatedCharacter(grounded.ctx, game, 0);
  const groundedAnchor = grounded.calls.find(([name]) => name === "translate");
  assert.equal(groundedAnchor[2], GAME.groundY);
  game.py -= 156;
  game.vy = -0.1;
  const inAir = recordedContext();
  drawAnimatedCharacter(inAir.ctx, game, 26);
  const airAnchor = inAir.calls.find(([name]) => name === "translate");
  assert.equal(airAnchor[2], game.py + GAME.epsilon);
  assert.equal(airAnchor[2] - groundedAnchor[2], game.py - origin);
});

test("crouch jump preserves the same physical feet origin and never changes engine state", () => {
  const game = createGame({ goal: 1000 });
  game.py -= 120;
  game.vy = -2;
  game.crouchUntilTick = 100;
  const state = JSON.stringify(game);
  const { ctx, calls } = recordedContext();
  drawAnimatedCharacter(ctx, game, 0);
  assert.equal(calls.find(([name]) => name === "translate")[2], game.py + GAME.epsilon);
  assert.equal(calls.find(([name]) => name === "scale")[2], GAME.crouchHeight / GAME.playerHeight);
  assert.equal(JSON.stringify(game), state);
});

test("wall top and pit edge are anchored to the same collision-space heights", () => {
  const game = createGame({ goal: 1500, scrollSpeed: 3, objects: [
    { type: "wall", position: 450 },
    { type: "hole", position: 800, width: 100 },
  ] });
  const { ctx, calls } = recordedContext();
  drawWorldObjects(ctx, game, 0);
  assert.ok(calls.some(([name, , top, width, height]) =>
    name === "roundRect" && top === GAME.groundY - GAME.wallHeight && width === GAME.wallWidth + 4 && height === GAME.wallHeight));
  game.px = 700;
  const pit = recordedContext();
  drawHoles(pit.ctx, game);
  const strokes = pit.calls.filter(([name]) => name === "moveTo" || name === "lineTo");
  assert.ok(strokes.length > 0);
  assert.ok(strokes.every(([, , y]) => y === GAME.groundY));
});
