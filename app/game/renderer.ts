import { GAME, worldToScreenX, type GameState } from "./core.ts";
import { drawHoles, drawWorldObjects, drawFinish } from "./obstacles.ts";
import { drawAmbientEffects, drawSpeedTrail, drawResultEffects } from "./effects.ts";
import { drawAnimatedCharacter } from "./character.ts";
import { getPlayerPose, getRepeatProgress, type PlayerPose } from "./visuals.ts";
import { layerX, PARALLAX_DEPTH, type ScenePalette } from "./scenery.ts";

export function renderGameFrame(ctx: CanvasRenderingContext2D, game: GameState, palette: ScenePalette, visualTick = game.elapsedTicks, idle = false, failureProgress = 1, reduceMotion = false, characterOffsetX = 0): void {
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

  for (let i = 0; i < palette.starCount; i++) {
    const x = layerX(i, game.px, 63, PARALLAX_DEPTH.stars, GAME.width);
    const y = 24 + (i * 47) % 125;
    ctx.fillStyle = palette.stars;
    ctx.fillRect(x, y, 3 + i % 2, 3 + i % 2);
  }

  for (let i = 0; i < 6; i++) {
    const x = layerX(i, game.px + (reduceMotion || idle ? 0 : visualTick * 0.25), 172, PARALLAX_DEPTH.clouds, GAME.width) - 50;
    const y = 62 + (i % 3) * 36;
    ctx.fillStyle = palette.cloud;
    ctx.beginPath();
    ctx.ellipse(x, y, 42, 13, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 20, y + 4, 28, 11, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 24, y + 5, 29, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!reduceMotion) drawAmbientEffects(ctx, game, visualTick);

  ctx.fillStyle = palette.farHill;
  ctx.beginPath();
  ctx.moveTo(0, GAME.groundY);
  for (let x = 0; x <= GAME.width + 24; x += 16) {
    ctx.lineTo(x, GAME.groundY - 70 + Math.sin((x + game.px * PARALLAX_DEPTH.farHill) / 86) * 21 + Math.cos((x + game.px * 0.08) / 41) * 9);
  }
  ctx.lineTo(GAME.width, GAME.groundY);
  ctx.fill();

  ctx.fillStyle = palette.nearHill;
  ctx.beginPath();
  ctx.moveTo(0, GAME.groundY);
  for (let x = 0; x <= GAME.width + 16; x += 12) {
    ctx.lineTo(x, GAME.groundY - 33 + Math.sin((x + game.px * PARALLAX_DEPTH.nearHill) / 77) * 14);
  }
  ctx.lineTo(GAME.width, GAME.groundY);
  ctx.fill();

  for (let i = 0; i < 8; i++) {
    const x = layerX(i, game.px, 126, PARALLAX_DEPTH.trees, GAME.width);
    const height = 27 + (i % 4) * 13;
    const base = GAME.groundY - 6;

    if (palette.biome === "canyon") {
      ctx.fillStyle = palette.trunk;
      ctx.beginPath();
      ctx.moveTo(x - 26, base);
      ctx.lineTo(x - 22, base - height + 16);
      ctx.lineTo(x - 17, base - height + 16);
      ctx.lineTo(x - 14, base - height - 1);
      ctx.lineTo(x + 12, base - height - 1);
      ctx.lineTo(x + 17, base - height + 16);
      ctx.lineTo(x + 22, base - height + 16);
      ctx.lineTo(x + 26, base);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = palette.treeLight;
      ctx.fillRect(x - 15, base - height + 14, 26, 3);
      ctx.fillRect(x - 20, base - 15, 40, 3);
      if (i % 2 === 0) {
        ctx.fillStyle = palette.trees;
        ctx.fillRect(x + 31, base - 30, 7, 30);
        ctx.fillRect(x + 23, base - 19, 11, 6);
        ctx.fillRect(x + 21, base - 26, 6, 13);
        ctx.fillRect(x + 36, base - 24, 10, 6);
        ctx.fillRect(x + 43, base - 31, 6, 13);
      }
    } else if (palette.biome === "starlight") {
      ctx.save();
      ctx.shadowColor = palette.treeLight;
      ctx.shadowBlur = 9;
      ctx.fillStyle = palette.trees;
      ctx.beginPath();
      ctx.moveTo(x - 18, base);
      ctx.lineTo(x - 10, base - height * .62);
      ctx.lineTo(x, base - height - 28);
      ctx.lineTo(x + 15, base - height * .50);
      ctx.lineTo(x + 19, base);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = palette.treeLight;
      ctx.beginPath();
      ctx.moveTo(x, base - height - 23);
      ctx.lineTo(x + 7, base - height * .5);
      ctx.lineTo(x, base - 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = palette.trunk;
      ctx.fillRect(x - 3, base - height + 14, 7, height);
      ctx.fillStyle = palette.trees;
      ctx.beginPath();
      ctx.moveTo(x, base - height - 14);
      ctx.lineTo(x - 17, base - height + 19);
      ctx.lineTo(x + 17, base - height + 19);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = palette.treeLight;
      for (const [offsetX, offsetY, radius] of [[-12, 3, 12], [9, -5, 15], [0, -18, 11]]) {
        ctx.beginPath();
        ctx.arc(x + offsetX, base - height + offsetY, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, GAME.groundY, GAME.width, GAME.groundHeight);
  ctx.fillStyle = palette.grass;
  ctx.fillRect(0, GAME.groundY, GAME.width, 12);
  ctx.fillStyle = palette.groundRim;
  ctx.fillRect(0, GAME.groundY + 11, GAME.width, 3);
  ctx.fillStyle = palette.groundTile;
  for (let i = 0; i < 17; i++) {
    const x = layerX(i, game.px, 52, PARALLAX_DEPTH.ground, GAME.width) - 14;
    ctx.fillRect(x, GAME.groundY + 23, 31, 5);
    ctx.fillRect(x + 20, GAME.groundY + 50, 25, 5);
  }

  drawHoles(ctx, game);
  drawWorldObjects(ctx, game, visualTick);

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

  if (!reduceMotion) drawSpeedTrail(ctx, game, visualTick, idle);
  const pose: PlayerPose = getPlayerPose(game);
  drawAnimatedCharacter(ctx, game, visualTick, idle, failureProgress, characterOffsetX);

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
  ctx.fillText(game.status === "failed" ? "あっ！" : actionLabels[pose], 22, 34);

  const repeat = getRepeatProgress(game);
  if (repeat) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(GAME.width / 2 - 100, 12, 200, 32);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText("くりかえし " + repeat.current + " / " + repeat.total, GAME.width / 2 - 87, 34);
  }

  if (game.requiredSkips > 0) {
    const skipped = game.switches.filter((item) => item.skipped && item.trap).length;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(GAME.width - 184, 48, 170, 32);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText("みおくり " + skipped + " / " + game.requiredSkips, GAME.width - 175, 70);
  }

  if (game.requiredCoins > 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(GAME.width - 184, 12, 170, 32);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 15px sans-serif";
    const collected = game.coins.filter((coin) => coin.collected).length;
    ctx.fillText("こいん " + collected + " / " + game.requiredCoins, GAME.width - 172, 34);
  }

  drawFinish(ctx, game);
  drawResultEffects(ctx, game, failureProgress);
}

