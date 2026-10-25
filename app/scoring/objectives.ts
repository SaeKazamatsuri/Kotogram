import type { GameState } from "../game/core.ts";

/** Deterministic fixed-point objective completion. No client-submitted values are trusted by the Worker. */
export type ObjectiveProgress = {
  collected: number;
  coinTarget: number;
  skipped: number;
  skipTarget: number;
  completionBp: number;
};

export function objectiveProgress(game: Pick<GameState, "coins" | "switches" | "requiredCoins" | "requiredSkips"> & Partial<Pick<GameState, "goalBonusBp">>): ObjectiveProgress {
  const coinTarget = Math.max(0, game.requiredCoins);
  const skipTarget = Math.max(0, game.requiredSkips);
  const collected = Math.min(coinTarget, game.coins.filter((c) => c.collected).length);
  const skipped = Math.min(skipTarget, game.switches.filter((s) => s.trap && s.skipped).length);
  const coinBp = coinTarget ? 3000 + Math.floor(7000 * collected / coinTarget) : 10000;
  const skipBp = skipTarget ? 4000 + Math.floor(6000 * skipped / skipTarget) : 10000;
  const objectiveBp = Math.round(coinBp * skipBp / 10000);
  const goalBp = game.goalBonusBp ?? 10000;
  return { collected, coinTarget, skipped, skipTarget, completionBp: Math.max(1200, Math.round(objectiveBp * goalBp / 10000)) };
}
