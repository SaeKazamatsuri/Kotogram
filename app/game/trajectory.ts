import { GAME, createGame, stepGame, type GameProgram, type GameStage, type GameStatus } from "./core.ts";

export type JumpTrace = {
  startTick: number;
  peakTick: number;
  landingTick: number | null;
  startFrontX: number;
  peakFrontX: number;
  landingFrontX: number | null;
  peakY: number;
  target: { id: string; type: "wall" | "hole"; left: number; right: number; center: number } | null;
  peakOffsetX: number | null;
};

export type JumpAnalysis = {
  status: GameStatus;
  elapsedTicks: number;
  jumps: JumpTrace[];
};

export function analyzeJumpTrajectories(stage: GameStage, program: GameProgram, maxTicks = 20000): JumpAnalysis {
  if (!Number.isSafeInteger(maxTicks) || maxTicks < 1 || maxTicks > 100000) {
    throw new RangeError("maxTicks must be an integer between 1 and 100000");
  }
  const game = createGame(stage, program);
  const jumps: JumpTrace[] = [];
  let active: JumpTrace | null = null;
  const ground = GAME.groundY - GAME.epsilon;

  while (game.status === "running" && game.elapsedTicks < maxTicks) {
    const wasGrounded = game.vy === 0 && Math.abs(game.py - ground) < 0.1;
    stepGame(game);
    const front = game.px + GAME.playerWidth;
    if (wasGrounded && game.vy < 0) {
      const targets = [
        ...game.walls.map((item) => ({ id: item.id, type: "wall" as const, left: item.x, right: item.x + GAME.wallWidth, center: item.x + GAME.wallWidth / 2 })),
        ...game.holes.map((item) => ({ id: item.id, type: "hole" as const, left: item.x, right: item.x + item.w, center: item.x + item.w / 2 })),
      ].filter((item) => item.left + GAME.pad >= front).sort((a, b) => a.left - b.left);
      const target = targets[0] ?? null;
      active = {
        startTick: game.elapsedTicks, peakTick: game.elapsedTicks, landingTick: null,
        startFrontX: front, peakFrontX: front, landingFrontX: null, peakY: game.py,
        target, peakOffsetX: target ? front - target.center : null,
      };
      jumps.push(active);
    }
    if (!active) continue;
    if (game.py < active.peakY) {
      active.peakY = game.py;
      active.peakTick = game.elapsedTicks;
      active.peakFrontX = front;
      active.peakOffsetX = active.target ? front - active.target.center : null;
    }
    if (game.vy === 0 && Math.abs(game.py - ground) < 0.1 && game.elapsedTicks > active.startTick) {
      active.landingTick = game.elapsedTicks;
      active.landingFrontX = front;
      active = null;
    }
  }
  return { status: game.status === "running" ? "timeout" : game.status, elapsedTicks: game.elapsedTicks, jumps };
}
