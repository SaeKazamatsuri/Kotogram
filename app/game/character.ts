import { GAME, type GameFailReason, type GameState } from "./core.ts";
import { getPlayerPose, type PlayerPose } from "./visuals.ts";

export type CharacterMotion = {
  pose: PlayerPose;
  stride: number;
  bounce: number;
  tilt: number;
  squash: number;
  blink: boolean;
  breathe: number;
  offsetX: number;
  offsetY: number;
  fade: number;
  stunned: boolean;
};

export function failureAnimationDuration(reason: GameFailReason | undefined): number {
  if (reason === "hole") return 1250;
  if (reason === "coin") return 750;
  return 1050;
}

export function resolveCharacterMotion(game: GameState, visualTick = game.elapsedTicks, idle = false, failureProgress = 1): CharacterMotion {
  const pose = getPlayerPose(game);
  const failed = game.status === "failed";
  const progress = failed ? Math.max(0, Math.min(1, failureProgress)) : 0;
  const running = pose === "running";
  const walking = pose === "walking";
  const moving = (running || walking) && !idle && !failed;
  const phase = visualTick * (running ? 0.55 : 0.34);
  let tilt = running ? 0.09 : pose === "jumping" ? -0.09 : pose === "crouch-jumping" ? -0.04 : 0;
  let offsetX = 0;
  let offsetY = 0;
  let fade = 1;

  if (failed) {
    const recoil = Math.sin(Math.min(1, progress * 1.5) * Math.PI / 2);
    if (game.failureReason === "hole") {
      offsetX = -10 * progress;
      offsetY = 230 * progress * progress;
      tilt = 1.4 * progress;
      fade = 1 - Math.max(0, progress - 0.7) / 0.3;
    } else if (game.failureReason === "enemy") {
      offsetX = -22 * recoil;
      offsetY = -42 * Math.sin(Math.PI * progress) + 25 * progress * progress;
      tilt = 0.85 * recoil;
    } else if (game.failureReason === "coin") {
      offsetY = 8 * Math.sin(progress * Math.PI / 2);
      tilt = -0.16 * Math.sin(progress * Math.PI / 2);
    } else {
      offsetX = -35 * recoil;
      offsetY = -22 * Math.sin(Math.PI * progress) + 20 * progress * progress;
      tilt = -0.95 * recoil;
    }
  }

  return {
    pose,
    stride: moving ? Math.sin(phase) * (running ? 9 : 6) : 0,
    bounce: moving ? Math.abs(Math.sin(phase)) * (running ? 2.6 : 1.4) : 0,
    tilt,
    squash: failed ? 1 : pose === "crouching" || pose === "crouch-jumping" ? GAME.crouchHeight / GAME.playerHeight : 1,
    blink: !failed && visualTick % 167 < 3,
    breathe: idle && !failed ? Math.sin(visualTick * 0.08) * 1.1 : 0,
    offsetX,
    offsetY,
    fade: Math.max(0, fade),
    stunned: failed,
  };
}

export function drawAnimatedCharacter(ctx: CanvasRenderingContext2D, game: GameState, visualTick = game.elapsedTicks, idle = false, failureProgress = 1): void {
  const motion = resolveCharacterMotion(game, visualTick, idle, failureProgress);
  const x = GAME.playerScreenX + GAME.playerWidth / 2;
  const airborne = motion.pose === "jumping" || motion.pose === "crouch-jumping";
  ctx.save();
  ctx.globalAlpha = motion.fade;
  if (game.failureReason !== "hole" || game.status !== "failed") {
    ctx.fillStyle = "rgba(43, 41, 64, 0.21)";
    ctx.beginPath();
    ctx.ellipse(x, GAME.groundY + 2, airborne ? 14 : 19, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.translate(x + motion.offsetX, game.py + GAME.epsilon + motion.offsetY - motion.bounce * 0.2 - motion.breathe * 0.5);
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
    if (motion.stunned) {
      ctx.moveTo(eyeX - 2.5, -49);
      ctx.lineTo(eyeX + 2.5, -44);
      ctx.moveTo(eyeX + 2.5, -49);
      ctx.lineTo(eyeX - 2.5, -44);
    } else if (motion.blink) {
      ctx.moveTo(eyeX - 2, -46);
      ctx.lineTo(eyeX + 2, -46);
    } else {
      ctx.moveTo(eyeX, -48);
      ctx.lineTo(eyeX, -44);
    }
    ctx.stroke();
  }
  if (motion.stunned) {
    ctx.fillStyle = "#6c4553";
    ctx.beginPath();
    ctx.ellipse(0, -38, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#eaa6a0";
  for (const cheekX of [-12, 12]) {
    ctx.beginPath();
    ctx.ellipse(cheekX, -41, 3, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
