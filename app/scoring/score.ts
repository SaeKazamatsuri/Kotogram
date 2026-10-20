import { normalizeLine } from "../language/parser.ts";

export const SCORING_VERSION = "2026-v1";
export const ENGINE_VERSION = "2026-core-v2";
export const LANGUAGE_VERSION = "2026-language-v2";
export const LEGACY_LANGUAGE_VERSION = "2026-language-v1";
export const SEASON_ID = "2026-festival";

export type ScoreKind = "time" | "chars" | "overall";
export type ScoreReference = {
  stageId: string;
  stageVersion: string;
  scoringVersion: string;
  timeTicks: number;
  characters: number;
  product: number;
};

export type ScoredRun = {
  runId: string;
  elapsedTicks: number;
  charCount: number;
  source: string;
};

export type BestRuns<T extends ScoredRun = ScoredRun> = {
  time?: T;
  chars?: T;
  overall?: T;
};

const knownReferences: Record<string, Omit<ScoreReference, "stageId">> = {
  "stage-1": { stageVersion: "2025-10-26", scoringVersion: SCORING_VERSION, timeTicks: 712, characters: 4, product: 2848 },
  "stage-2": { stageVersion: "2025-10-26", scoringVersion: SCORING_VERSION, timeTicks: 983, characters: 7, product: 6881 },
  "stage-3": { stageVersion: "2025-10-26", scoringVersion: SCORING_VERSION, timeTicks: 1434, characters: 14, product: 20076 },
  "stage-4": { stageVersion: "2025-10-26", scoringVersion: SCORING_VERSION, timeTicks: 806, characters: 11, product: 8866 },
  "stage-5": { stageVersion: "2025-10-26", scoringVersion: SCORING_VERSION, timeTicks: 746, characters: 14, product: 10444 },
  "stage-6": { stageVersion: "2025-10-26", scoringVersion: SCORING_VERSION, timeTicks: 512, characters: 9, product: 4608 },
  "stage-7": { stageVersion: "2025-10-26", scoringVersion: SCORING_VERSION, timeTicks: 679, characters: 10, product: 6790 },
};

const revisedReferences: Record<string, Omit<ScoreReference, "stageId">> = {
  "stage-2": { ...knownReferences["stage-2"]!, stageVersion: "2026-10-20-r1" },
  "stage-3": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 834, characters: 14, product: 11676 },
  "stage-5": { ...knownReferences["stage-5"]!, stageVersion: "2026-10-20-r1" },
};

export function getScoreReference(stageId: string, stageVersion: string): ScoreReference | null {
  const baseline = knownReferences[stageId];
  const revised = revisedReferences[stageId];
  const value = revised?.stageVersion === stageVersion ? revised : baseline;
  return value?.stageVersion === stageVersion ? { stageId, ...value } : null;
}

export function countSourceCharacters(source: string): number {
  return [...normalizeLine(source.replace(/\r\n?/g, "\n")).replace(/\n/g, "")].length;
}

function positiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(name + " must be a positive safe integer");
  }
}

export function runProduct(run: Pick<ScoredRun, "elapsedTicks" | "charCount">): number {
  positiveInteger(run.elapsedTicks, "elapsedTicks");
  positiveInteger(run.charCount, "charCount");
  const product = run.elapsedTicks * run.charCount;
  positiveInteger(product, "product");
  return product;
}

export function calculateScores(reference: ScoreReference, run: Pick<ScoredRun, "elapsedTicks" | "charCount">) {
  positiveInteger(reference.timeTicks, "timeTicks");
  positiveInteger(reference.characters, "characters");
  positiveInteger(reference.product, "reference product");
  const product = runProduct(run);
  return {
    time: 1000 * reference.timeTicks / run.elapsedTicks,
    chars: 1000 * reference.characters / run.charCount,
    overall: 1000 * reference.product / product,
  };
}

export function compareRuns(kind: ScoreKind, a: ScoredRun, b: ScoredRun): number {
  const leftProduct = runProduct(a);
  const rightProduct = runProduct(b);
  if (kind === "time") return a.elapsedTicks - b.elapsedTicks || a.charCount - b.charCount;
  if (kind === "chars") return a.charCount - b.charCount || a.elapsedTicks - b.elapsedTicks;
  return leftProduct - rightProduct || a.elapsedTicks - b.elapsedTicks || a.charCount - b.charCount;
}

export function selectBestRuns<T extends ScoredRun>(runs: readonly T[]): BestRuns<T> {
  const best: BestRuns<T> = {};
  for (const run of runs) {
    runProduct(run);
    for (const kind of ["time", "chars", "overall"] as const) {
      const previous = best[kind];
      if (!previous || compareRuns(kind, run, previous) < 0 || (compareRuns(kind, run, previous) === 0 && run.runId < previous.runId)) {
        best[kind] = run;
      }
    }
  }
  return best;
}

export function rankRuns<T extends ScoredRun>(kind: ScoreKind, runs: readonly T[]): { rank: number; run: T }[] {
  const sorted = [...runs].sort((a, b) => compareRuns(kind, a, b) || a.runId.localeCompare(b.runId));
  return sorted.map((run, index) => ({
    rank: index > 0 && compareRuns(kind, sorted[index - 1]!, run) === 0
      ? sorted.findIndex((candidate) => compareRuns(kind, candidate, run) === 0) + 1
      : index + 1,
    run,
  }));
}

export type RankingScope = {
  seasonId: string;
  stageId: string;
  stageVersion: string;
  engineVersion: string;
  languageVersion: string;
  scoringVersion: string;
};

export function rankingScopeKey(scope: RankingScope): string {
  return JSON.stringify([
    scope.seasonId, scope.stageId, scope.stageVersion,
    scope.engineVersion, scope.languageVersion, scope.scoringVersion,
  ]);
}
