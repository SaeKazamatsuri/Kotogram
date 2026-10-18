import { GAME, type GameState } from "./core.ts";
import { getPlayerPose, type PlayerPose } from "./visuals.ts";

export type CharacterMotion = {
  pose: PlayerPose;
  stride: number;
  bounce: number;
  tilt: number;
  squash: number;
  blink: boolean;
};

export function resolveCharacterMotion(game: GameState): CharacterMotion {
  const pose = getPlayerPose(game);
  const running = pose === "running";
  const walking = pose === "walking";
  const moving = running || walking;
  const phase = game.elapsedTicks * (running ? 0.55 : 0.34);
  return {
    pose,
    stride: moving ? Math.sin(phase) * (running ? 9 : 6) : 0,
    bounce: moving ? Math.abs(Math.sin(phase)) * (running ? 2.6 : 1.4) : 0,
    tilt: running ? 0.09 : pose === "jumping" ? -0.09 : pose === "crouch-jumping" ? -0.04 : 0,
    squash: pose === "crouching" || pose === "crouch-jumping" ? GAME.crouchHeight / GAME.playerHeight : 1,
    blink: game.elapsedTicks % 167 < 3,
  };
}

export function drawAnimatedCharacter(ctx: CanvasRenderingContext2D, game: GameState): void {
  const motion = resolveCharacterMotion(game);
  const x = GAME.playerScreenX + GAME.playerWidth / 2;
  const airborne = motion.pose === "jumping" || motion.pose === "crouch-jumping";
  ctx.save();
  ctx.fillStyle = "rgba(43, 41, 64, 0.21)";
  ctx.beginPath();
  ctx.ellipse(x, GAME.groundY + 2, airborne ? 14 : 19, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, game.py - motion.bounce);
  ctx.rotate(motion.tilt);
  ctx.scale(1, motion.squash);

  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#4e4963";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 8, -14);
    const footX = airborne ? side * 13 : side * 8 + motion.stride * side;
    const footY = airborne ? -6 : -2 + Math.max(0, -motion.stride * side) * 0.3;
    ctx.lineTo(footX, footY);
    ctx.stroke();
    ctx.fillStyle = "#3b3f57";
    ctx.beginPath();
    ctx.ellipse(footX + 2, footY, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#648b9e";
  ctx.beginPath();
  ctx.roundRect(-21, -44, 10, 26, 5);
  ctx.fill();

  ctx.lineWidth = 6;
  ctx.strokeStyle = "#efaf6c";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 14, -37);
    ctx.lineTo(side * (18 + Math.abs(motion.stride) * 0.2), -22 + (side * motion.stride) * 0.38);
    ctx.stroke();
  }

  ctx.fillStyle = "#f0b351";
  ctx.strokeStyle = "#5d4b61";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-16, -45, 32, 32, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2b8294";
  ctx.beginPath();
  ctx.roundRect(-13, -33, 26, 8, 4);
  ctx.fill();

  ctx.fillStyle = "#ffe1b4";
  ctx.beginPath();
  ctx.ellipse(0, -45, 16.5, 15.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#665169";
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.fillStyle = "#59445b";
  ctx.beginPath();
  ctx.ellipse(-3, -58, 16, 7, -0.12, Math.PI, 2 * Math.PI);
  ctx.lineTo(14, -51);
  ctx.quadraticCurveTo(6, -54, 0, -53);
  ctx.quadraticCurveTo(-12, -54, -17, -51);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#4c4258";
  ctx.lineWidth = 2.5;
  for (const eyeX of [-6, 6]) {
    ctx.beginPath();
    if (motion.blink) {
      ctx.moveTo(eyeX - 2, -46);
      ctx.lineTo(eyeX + 2, -46);
    } else {
      ctx.moveTo(eyeX, -48);
      ctx.lineTo(eyeX, -44);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "#eaa6a0";
  for (const cheekX of [-12, 12]) {
    ctx.beginPath();
    ctx.ellipse(cheekX, -41, 3, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
