import { GAME, isCrouching, type GameState } from "./core.ts";

export type PlayerPose = "walking" | "running" | "jumping" | "crouching" | "crouch-jumping";

export function getPlayerPose(game: GameState): PlayerPose {
  const airborne = game.vy !== 0 || game.py < GAME.groundY - GAME.epsilon - 0.1;
  const crouching = isCrouching(game);
  if (airborne) return crouching ? "crouch-jumping" : "jumping";
  if (crouching) return "crouching";
  return game.vx > game.baseSpeed ? "running" : "walking";
}
