import { GAME, isCrouching, type GameState } from "./core.ts";

export type PlayerPose = "walking" | "running" | "jumping" | "crouching" | "crouch-jumping";

export function getPlayerPose(game: GameState): PlayerPose {
  const airborne = game.vy !== 0 || game.py < GAME.groundY - GAME.epsilon - 0.1;
  const crouching = isCrouching(game);
  if (airborne) return crouching ? "crouch-jumping" : "jumping";
  if (crouching) return "crouching";
  return game.vx > game.baseSpeed ? "running" : "walking";
}

export type RepeatProgress = { current: number; total: number };

export function getRepeatProgress(game: GameState): RepeatProgress | null {
  for (let index = game.loops.length - 1; index >= 0; index--) {
    const frame = game.loops[index]!;
    const instruction = game.steps[frame.start];
    if (instruction?.op === "repeat-start" && instruction.count > 1) {
      return { current: instruction.count - frame.remaining + 1, total: instruction.count };
    }
  }

  let onlyRepeat: { index: number; count: number; end: number } | null = null;
  for (const [index, instruction] of game.steps.entries()) {
    if (instruction.op !== "repeat-start" || instruction.count < 2) continue;
    if (onlyRepeat) return null;
    onlyRepeat = { index, count: instruction.count, end: instruction.end };
  }
  if (!onlyRepeat) return null;
  if (game.cursor <= onlyRepeat.index) return { current: 0, total: onlyRepeat.count };
  if (game.cursor > onlyRepeat.end) return { current: onlyRepeat.count, total: onlyRepeat.count };
  return null;
}
