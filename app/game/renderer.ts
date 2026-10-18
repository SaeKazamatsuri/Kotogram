import { GAME, isCrouching, worldToScreenX, type GameState } from "./core.ts";
import { getPlayerPose, type PlayerPose } from "./visuals.ts";
import { layerX, type ScenePalette } from "./scenery.ts";

export type SpriteKey = "player" | "wall" | "ghost" | "goal";

export function renderGameFrame(ctx: CanvasRenderingContext2D, game: GameState, palette: ScenePalette, sprites: Record<SpriteKey, CanvasImageSource | null>): void {
  ctx.clearRect(0, 0, GAME.width, GAME.height);

  const background = ctx.createLinearGradient(0, 0, 0, GAME.height);
  background.addColorStop(0, palette.skyTop);
  background.addColorStop(1, palette.skyBottom);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, GAME.width, GAME.height);

  ctx.fillStyle = palette.sunGlow;
  ctx.beginPath();
  ctx.arc(GAME.width - 123, 88, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.sun;
  ctx.beginPath();
  ctx.arc(GAME.width - 123, 88, 34, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 12; i++) {
    const x = layerX(i, game.px, 63, 0.06, GAME.width);
    const y = 24 + (i * 47) % 125;
    ctx.fillStyle = palette.stars;
    ctx.fillRect(x, y, 3 + i % 2, 3 + i % 2);
  }

  for (let i = 0; i < 6; i++) {
    const x = layerX(i, game.px, 172, 0.11, GAME.width) - 50;
    const y = 62 + (i % 3) * 36;
    ctx.fillStyle = palette.cloud;
    ctx.beginPath();
    ctx.ellipse(x, y, 42, 13, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 20, y + 4, 28, 11, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 24, y + 5, 29, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = palette.farHill;
  ctx.beginPath();
  ctx.moveTo(0, GAME.groundY);
  for (let x = 0; x <= GAME.width + 24; x += 16) {
    ctx.lineTo(x, GAME.groundY - 70 + Math.sin((x + game.px * 0.12) / 86) * 21 + Math.cos((x + game.px * 0.08) / 41) * 9);
  }
  ctx.lineTo(GAME.width, GAME.groundY);
  ctx.fill();

  ctx.fillStyle = palette.nearHill;
  ctx.beginPath();
  ctx.moveTo(0, GAME.groundY);
  for (let x = 0; x <= GAME.width + 16; x += 12) {
    ctx.lineTo(x, GAME.groundY - 33 + Math.sin((x + game.px * 0.24) / 77) * 14);
  }
  ctx.lineTo(GAME.width, GAME.groundY);
  ctx.fill();

  for (let i = 0; i < 8; i++) {
    const x = layerX(i, game.px, 126, 0.28, GAME.width);
    const height = 27 + (i % 4) * 13;
    const base = GAME.groundY - 6;
    ctx.fillStyle = palette.trunk;
    ctx.fillRect(x - 3, base - height + 14, 7, height);
    ctx.fillStyle = palette.trees;
    ctx.beginPath();
    ctx.moveTo(x, base - height - 14);
    ctx.lineTo(x - 17, base - height + 19);
    ctx.lineTo(x + 17, base - height + 19);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, GAME.groundY, GAME.width, GAME.groundHeight);
  ctx.fillStyle = palette.grass;
  ctx.fillRect(0, GAME.groundY, GAME.width, 12);
  ctx.fillStyle = palette.groundTile;
  for (let i = 0; i < 17; i++) {
    const x = layerX(i, game.px, 52, 1, GAME.width) - 14;
    ctx.fillRect(x, GAME.groundY + 23, 31, 5);
    ctx.fillRect(x + 20, GAME.groundY + 50, 25, 5);
  }

  for (const hole of game.holes) {
    const left = Math.max(0, worldToScreenX(game, hole.x));
    const right = Math.min(GAME.width, worldToScreenX(game, hole.x + hole.w));
    if (right > left) {
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(left, GAME.groundY, right - left, GAME.groundHeight);
    }
  }

  for (const coin of game.coins) {
    if (coin.collected) continue;
    const x = worldToScreenX(game, coin.x);
    if (x < -GAME.coinRadius || x > GAME.width + GAME.coinRadius) continue;
    ctx.beginPath();
    ctx.arc(x, GAME.groundY - 34, GAME.coinRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#facc15";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#854d0e";
    ctx.stroke();
  }

  for (const item of game.switches) {
    const x = worldToScreenX(game, item.x);
    if (x < -32 || x > GAME.width + 32) continue;
    ctx.fillStyle = item.activated ? "#4ade80" : "#f97316";
    ctx.fillRect(x - 11, GAME.groundY - 33, 22, 25);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(item.activated ? "○" : "おす", x - 17, GAME.groundY - 42);
  }

  for (const door of game.doors) {
    const x = worldToScreenX(game, door.x);
    if (x < -GAME.doorWidth || x > GAME.width + GAME.doorWidth) continue;
    ctx.fillStyle = door.open ? "rgba(34,197,94,0.25)" : "#7c3aed";
    ctx.fillRect(x, GAME.groundY - GAME.doorHeight, GAME.doorWidth, GAME.doorHeight);
    ctx.strokeStyle = door.open ? "#15803d" : "#4c1d95";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, GAME.groundY - GAME.doorHeight, GAME.doorWidth, GAME.doorHeight);
  }

  for (const wall of game.walls) {
    const x = worldToScreenX(game, wall.x);
    if (x < -GAME.wallWidth || x > GAME.width + GAME.wallWidth) continue;
    if (sprites.wall) ctx.drawImage(sprites.wall, x, GAME.groundY - GAME.wallHeight, GAME.wallWidth, GAME.wallHeight);
    else {
      ctx.fillStyle = "#9ca3af";
      ctx.fillRect(x, GAME.groundY - GAME.wallHeight, GAME.wallWidth, GAME.wallHeight);
    }
  }

  for (const ghost of game.ghosts) {
    const x = worldToScreenX(game, ghost.x);
    if (x < -GAME.ghostWidth || x > GAME.width + GAME.ghostWidth) continue;
    const y = GAME.groundY - GAME.ghostHeight - GAME.ghostClearance;
    if (sprites.ghost) ctx.drawImage(sprites.ghost, x, y, GAME.ghostWidth, GAME.ghostHeight);
    else {
      const center = x + GAME.ghostWidth / 2;
      const headHeight = GAME.ghostHeight * 0.65;
      const neck = y + headHeight;
      const bottom = y + GAME.ghostHeight;
      const radius = GAME.ghostWidth * 0.45;
      const arc = y + headHeight * 0.35;
      const taper = GAME.ghostWidth * 0.2;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(center - radius, arc);
      ctx.quadraticCurveTo(center - radius, y, center, y);
      ctx.quadraticCurveTo(center + radius, y, center + radius, arc);
      ctx.quadraticCurveTo(center + radius * 0.92, neck, center + taper, neck);
      ctx.quadraticCurveTo(center + taper * 0.6, bottom, center, bottom);
      ctx.quadraticCurveTo(center - taper * 0.6, bottom, center - taper, neck);
      ctx.quadraticCurveTo(center - radius * 0.92, neck, center - radius, arc);
      ctx.closePath();
      ctx.fill();
    }
  }

  for (const wall of game.walls) {
    if (!game.ghosts.some((ghost) => ghost.x === wall.x)) continue;
    const x = worldToScreenX(game, wall.x);
    if (x < -GAME.wallWidth || x > GAME.width) continue;
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 4, GAME.groundY - GAME.ghostHeight - GAME.ghostClearance - 5, GAME.ghostWidth + 8, GAME.ghostHeight + GAME.ghostClearance + 9);
    ctx.fillStyle = "#fff7ed";
    ctx.fillRect(x - 4, GAME.groundY - GAME.ghostHeight - GAME.ghostClearance - 28, 53, 22);
    ctx.fillStyle = "#9a3412";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("2つ!", x + 2, GAME.groundY - GAME.ghostHeight - GAME.ghostClearance - 12);
  }

  const pose: PlayerPose = getPlayerPose(game);
  const playerHeight = isCrouching(game) ? GAME.crouchHeight : GAME.playerHeight;
  const playerTop = game.py - playerHeight;
  if (sprites.player) {
    ctx.drawImage(sprites.player, GAME.playerScreenX, playerTop, GAME.playerWidth, playerHeight);
  } else {
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(GAME.playerScreenX + 4, playerTop, GAME.playerWidth - 8, playerHeight);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(GAME.playerScreenX + 13, playerTop + 10, 5, 5);
    ctx.fillRect(GAME.playerScreenX + 26, playerTop + 10, 5, 5);
  }

  const actionLabels: Record<PlayerPose, string> = {
    walking: "あるく",
    running: "はしる",
    jumping: "じゃんぷ",
    crouching: "しゃがむ",
    "crouch-jumping": "じゃんぷ＋しゃがむ",
  };
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillRect(12, 12, 180, 32);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(actionLabels[pose], 22, 34);

  if (game.requiredCoins > 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(GAME.width - 184, 12, 170, 32);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 15px sans-serif";
    const collected = game.coins.filter((coin) => coin.collected).length;
    ctx.fillText("こいん " + collected + " / " + game.requiredCoins, GAME.width - 172, 34);
  }

  const goalX = worldToScreenX(game, game.goalX);
  if (goalX < GAME.width && goalX + GAME.goalWidth > 0) {
    if (sprites.goal) ctx.drawImage(sprites.goal, goalX, GAME.groundY - GAME.goalHeight, GAME.goalWidth, GAME.goalHeight);
    else {
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(goalX, GAME.groundY - GAME.goalHeight, GAME.goalWidth, GAME.goalHeight);
    }
  }
}

