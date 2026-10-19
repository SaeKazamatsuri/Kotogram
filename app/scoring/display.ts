import { calculateScores, getScoreReference, type BestRuns, type ScoredRun, type ScoreKind } from "./score.ts";

export function formatBestScore(
  stageId: string,
  stageVersion: string,
  bests: BestRuns<ScoredRun> | undefined,
  kind: ScoreKind,
): string {
  const run = bests?.[kind];
  const reference = getScoreReference(stageId, stageVersion);
  if (!run || !reference) return "－";
  return Math.round(calculateScores(reference, run)[kind]).toLocaleString("ja-JP") + "点";
}
