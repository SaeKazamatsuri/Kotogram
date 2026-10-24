import { normalizeLine } from "../language/parser.ts";

export const SCORING_VERSION = "2026-v1";
export const ENGINE_VERSION = "2026-core-v2";
export const LANGUAGE_VERSION = "2026-language-v3";
export const PREVIOUS_LANGUAGE_VERSION = "2026-language-v2";
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
  "stage-8": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 846, characters: 22, product: 18612 },
  "stage-9": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 399, characters: 25, product: 9975 },
  "stage-10": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 652, characters: 30, product: 19560 },
  "stage-11": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 852, characters: 20, product: 17040 },
  "stage-12": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 292, characters: 12, product: 3504 },
  "stage-13": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 1052, characters: 15, product: 15780 },
  "stage-14": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 652, characters: 25, product: 16300 },
  "stage-15": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 852, characters: 13, product: 11076 },
  "stage-16": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 652, characters: 15, product: 9780 },
  "stage-17": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 1252, characters: 11, product: 13772 },
  "stage-18": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 252, characters: 9, product: 2268 },
  "stage-19": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 652, characters: 30, product: 19560 },
  "stage-20": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 706, characters: 36, product: 25416 },
  "stage-21": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 652, characters: 24, product: 15648 },
  "stage-22": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 906, characters: 30, product: 27180 },
  "stage-23": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 1452, characters: 15, product: 21780 },
  "stage-24": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 652, characters: 23, product: 14996 },
  "stage-25": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 1252, characters: 20, product: 25040 },
  "stage-26": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 852, characters: 20, product: 17040 },
  "stage-27": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 1106, characters: 29, product: 32074 },
  "stage-28": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 1159, characters: 30, product: 34770 },
  "stage-29": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 1052, characters: 28, product: 29456 },
  "stage-30": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 1412, characters: 53, product: 74836 },
};

const revisedReferences: Record<string, Omit<ScoreReference, "stageId">> = {
  "stage-2": { ...knownReferences["stage-2"]!, stageVersion: "2026-10-20-r1" },
  "stage-3": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 834, characters: 14, product: 11676 },
  "stage-5": { ...knownReferences["stage-5"]!, stageVersion: "2026-10-20-r1" },
  "stage-8": { stageVersion: "2026-10-20-r2", scoringVersion: SCORING_VERSION, timeTicks: 846, characters: 30, product: 25380 },
};

const latestReferences: Record<string, Omit<ScoreReference, "stageId">> = {
  "stage-13": { ...knownReferences["stage-13"]!, stageVersion: "2026-10-25-r2" },
  "stage-25": { ...knownReferences["stage-25"]!, stageVersion: "2026-10-25-r2" },
  "stage-5": { ...revisedReferences["stage-5"]!, stageVersion: "2026-10-20-r2" },
};

export function getScoreReference(stageId: string, stageVersion: string): ScoreReference | null {
  const value = [latestReferences[stageId], revisedReferences[stageId], knownReferences[stageId]]
    .find((reference) => reference?.stageVersion === stageVersion);
  return value ? { stageId, ...value } : null;
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
