import { GAME, isCrouching, type ExecutionTrace, type GameAction, type GameState } from "./core.ts";
import type { SourceMap } from "../language/parser.ts";

export type SustainedAction = "walk" | "run" | "sprint" | "crouch";
export type SustainedHighlight = { line: number; action: SustainedAction };
export type ActionHighlights = { active: number[]; sustained: SustainedHighlight[] };

const STRONG_TICKS = Math.round(GAME.tickRate * 0.5);
const isPace = (action: GameAction): action is "walk" | "run" | "sprint" =>
  action === "walk" || action === "run" || action === "sprint";

function expectedSpeed(game: GameState, action: "walk" | "run" | "sprint"): number {
  return game.baseSpeed * (action === "run" ? GAME.runMultiplier : action === "sprint" ? GAME.sprintMultiplier : 1);
}

/**
 * Presentation-only state. It observes accepted instructions but never modifies the simulation
 * or its scoring/serialization. New pace instructions supersede the previous pace line.
 */
export function createActionHighlights() {
  const strongUntil = new Map<number, number>();
  let pace: SustainedHighlight | null = null;
  let crouch: SustainedHighlight | null = null;

  return {
    record(event: ExecutionTrace, sourceMap?: SourceMap) {
      const line = event.kind === "watcher"
        ? sourceMap?.watchers[event.index] : sourceMap?.steps[event.index];
      if (!line || line < 1) return;
      strongUntil.set(line, event.tick + STRONG_TICKS);
      if (event.action && isPace(event.action)) pace = { line, action: event.action };
      if (event.action === "crouch") crouch = { line, action: "crouch" };
    },
    snapshot(game: GameState): ActionHighlights {
      for (const [line, until] of strongUntil) {
        if (until < game.elapsedTicks) strongUntil.delete(line);
      }
      const sustained: SustainedHighlight[] = [];
      if (pace && isPace(pace.action) && Math.abs(game.vx - expectedSpeed(game, pace.action)) < 0.00001) {
        sustained.push(pace);
      }
      if (crouch && isCrouching(game)) sustained.push(crouch);
      return { active: [...strongUntil.keys()].sort((a, b) => a - b), sustained };
    },
    reset() {
      strongUntil.clear();
      pace = null;
      crouch = null;
    },
  };
}
