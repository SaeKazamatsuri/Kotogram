import { GAME, type GameState } from "./core.ts";

export function decorativePhase(seed: number, visualTick: number): number {
  return visualTick * 0.065 + seed * 2.39996;
}

export function drawAmbientEffects(ctx: CanvasRenderingContext2D, game: GameState, visualTick: number): void {
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const phase = decorativePhase(i, visualTick);
    const x = ((i * 127 - game.px * 0.08) % (GAME.width + 36) + GAME.width + 36) % (GAME.width + 36) - 18;
    const y = 24 + (i * 47) % (GAME.groundY - 64) + Math.sin(phase) * 5;
    ctx.globalAlpha = 0.1 + Math.abs(Math.sin(phase)) * 0.28;
    ctx.fillStyle = "#fff4d1";
    ctx.beginPath();
    ctx.arc(x, y, 1.3 + Math.sin(phase) ** 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawSpeedTrail(ctx: CanvasRenderingContext2D, game: GameState, visualTick: number, idle: boolean): void {
  if (idle || game.vx <= 0 || game.status !== "running") return;
  const running = game.vx > game.baseSpeed;
  ctx.save();
  ctx.fillStyle = "#f6e8ca";
  for (let i = 0; i < (running ? 5 : 3); i++) {
    const lifetime = ((visualTick + i * 4) % 25) / 25;
    const x = GAME.playerScreenX + 10 - lifetime * (running ? 54 : 30);
    const y = GAME.groundY - 2 - Math.sin(decorativePhase(i, visualTick)) * 3;
    ctx.globalAlpha = (1 - lifetime) * (running ? 0.5 : 0.27);
    ctx.beginPath();
    ctx.arc(x, y, 2 + lifetime * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawResultEffects(ctx: CanvasRenderingContext2D, game: GameState, failureProgress = 1): void {
  if (game.status !== "failed") return;
  const progress = Math.max(0, Math.min(1, failureProgress));
  ctx.save();
  const shade = ctx.createLinearGradient(0, 0, 0, GAME.height);
  shade.addColorStop(0, "rgba(72, 36, 69, 0.35)");
  shade.addColorStop(0.5, "rgba(72, 36, 69, 0)");
  shade.addColorStop(1, "rgba(72, 36, 69, 0.12)");
  ctx.globalAlpha = 0.3 + 0.7 * progress;
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, GAME.width, GAME.height);

  if (game.failureReason !== "hole" && game.failureReason !== "coin" && progress < 0.5) {
    const alpha = 1 - progress * 2;
    const x = GAME.playerScreenX + GAME.playerWidth / 2;
    const y = game.py - GAME.playerHeight / 2;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#fff0ae";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 18 + progress * 110, 0, Math.PI * 2);
    ctx.stroke();
    for (let index = 0; index < 8; index++) {
      const angle = index * Math.PI / 4;
      const inner = 24 + progress * 60;
      const outer = inner + 12 + 10 * (1 - progress);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
      ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
      ctx.stroke();
    }
  }
  ctx.restore();
}
