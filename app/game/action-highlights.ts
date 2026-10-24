import { GAME, isCrouching, type ExecutionTrace, type GameAction, type GameState } from "./core.ts";
import type { SourceMap } from "../language/parser.ts";

export type SustainedAction = "walk" | "run" | "sprint" | "crouch";
export type SustainedHighlight = { line: number; action: SustainedAction };
export type ActionHighlights = { active: number[]; sustained: SustainedHighlight[] };

/** Conditional watchers are observing even when no obstacle is sensed yet.
 *  A watcher that exhausted its fire limit is no longer monitoring. */
export function monitoredSourceLines(game: GameState, sourceMap?: SourceMap): number[] {
  if (game.status !== "running" || !sourceMap) return [];
  const lines = game.program.flatMap((rule, index) => {
    if (!(rule.conds?.length || rule.cond)) return [];
    if (rule.maxFires !== undefined && (game.fired[index]?.size ?? 0) >= rule.maxFires) return [];
    const line = sourceMap.watchers[index];
    return typeof line === "number" && line > 0 ? [line] : [];
  });
  return [...new Set(lines)].sort((a, b) => a - b);
}

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
  let lastActionLine: number | null = null;

  return {
    record(event: ExecutionTrace, sourceMap?: SourceMap) {
      const line = event.kind === "watcher"
        ? sourceMap?.watchers[event.index] : sourceMap?.steps[event.index];
      if (!line || line < 1) return;
      if (event.action) lastActionLine = line;
      // Crouching only lasts 26 ticks; a shorter pulse leaves time to see its continuing state.
      const pulse = event.action === "crouch" ? Math.min(10, STRONG_TICKS) : STRONG_TICKS;
      strongUntil.set(line, event.tick + pulse);
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
    lastActionLine() { return lastActionLine; },
    reset() {
      strongUntil.clear();
      pace = null;
      crouch = null;
      lastActionLine = null;
    },
  };
}
