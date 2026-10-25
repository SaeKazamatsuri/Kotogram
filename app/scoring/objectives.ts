import type { GameState } from "../game/core.ts";

/** Deterministic fixed-point objective completion. No client-submitted values are trusted by the Worker. */
export type ObjectiveProgress = {
  collected: number;
  coinTarget: number;
  skipped: number;
  skipTarget: number;
  completionBp: number;
  secretDoorRiskBp?: number;
};

export function objectiveProgress(game: Pick<GameState, "coins" | "switches" | "requiredCoins" | "requiredSkips"> & Partial<Pick<GameState, "goalBonusBp" | "secretDoorRiskBp" | "doors">>): ObjectiveProgress {
  const coinTarget = Math.max(0, game.requiredCoins);
  const skipTarget = Math.max(0, game.requiredSkips);
  const collected = Math.min(coinTarget, game.coins.filter((c) => c.collected).length);
  const skipped = Math.min(skipTarget, game.switches.filter((s) => s.trap && s.skipped).length);
  const coinBp = coinTarget ? 3000 + Math.floor(7000 * collected / coinTarget) : 10000;
  const skipBp = skipTarget ? 4000 + Math.floor(6000 * skipped / skipTarget) : 10000;
  const objectiveBp = Math.round(coinBp * skipBp / 10000);
  const goalBp = game.goalBonusBp ?? 10000;
  const affectedDoorCount = game.doors?.filter(door=>door.broken||door.vaulted).length??0;
  const perDoorBp = game.secretDoorRiskBp ?? 10000;
  let riskBp = 10000;
  for(let n=0;n<affectedDoorCount;n++)riskBp=Math.round(riskBp*perDoorBp/10000);
  const completionBp = Math.max(1200, Math.round(objectiveBp * goalBp * riskBp / 100000000));
  return { collected, coinTarget, skipped, skipTarget, completionBp,
    ...(affectedDoorCount>0 && perDoorBp<10000 ? {secretDoorRiskBp:riskBp} : {}) };
}
