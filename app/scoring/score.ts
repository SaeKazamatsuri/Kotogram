import { normalizeLine } from "../language/parser.ts";

export const SCORING_VERSION = "2026-v2";
export const PREVIOUS_SCORING_VERSION = "2026-v1";
export const ENGINE_VERSION = "2026-core-v3";
export const PREVIOUS_ENGINE_VERSION = "2026-core-v2";
export const LANGUAGE_VERSION = "2026-language-v5";
export const PREVIOUS_LANGUAGE_VERSION = "2026-language-v4";
export const EARLIER_LANGUAGE_VERSION = "2026-language-v3";
export const LEGACY_LANGUAGE_VERSION = "2026-language-v2";
export const FIRST_LANGUAGE_VERSION = "2026-language-v1";
export const SEASON_ID = "2026-festival";

export type StrategyKind = "speed" | "compact" | "balanced";

export function classifyStrategy(scores: { time: number; chars: number; overall: number }): StrategyKind {
  if (scores.time > scores.chars * 1.08) return "speed";
  if (scores.chars > scores.time * 1.08) return "compact";
  return "balanced";
}

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
  completionBp?: number;
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
  "stage-28": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 1163, characters: 37, product: 43031 },
  "stage-21": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 670, characters: 24, product: 16080 },
  "stage-22": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 890, characters: 30, product: 26700 },
  "stage-29": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 1047, characters: 28, product: 29316 },
  "stage-23": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 1446, characters: 15, product: 21690 },
  "stage-24": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 652, characters: 23, product: 14996 },
  "stage-18": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 652, characters: 9, product: 5868 },
  "stage-13": { ...knownReferences["stage-13"]!, stageVersion: "2026-10-25-r2" },
  "stage-25": { ...knownReferences["stage-25"]!, stageVersion: "2026-10-25-r2" },
  "stage-19": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 652, characters: 41, product: 26732 },
  "stage-2": { ...knownReferences["stage-2"]!, stageVersion: "2026-10-20-r1" },
  "stage-3": { stageVersion: "2026-10-20-r1", scoringVersion: SCORING_VERSION, timeTicks: 834, characters: 14, product: 11676 },
  "stage-5": { ...knownReferences["stage-5"]!, stageVersion: "2026-10-20-r1" },
  "stage-8": { stageVersion: "2026-10-20-r2", scoringVersion: SCORING_VERSION, timeTicks: 846, characters: 30, product: 25380 },
};

const latestReferences: Record<string, Omit<ScoreReference, "stageId">> = {
  "stage-12": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 432, characters: 23, product: 9936 },
  "stage-18": { stageVersion: "2026-10-25-r3", scoringVersion: SCORING_VERSION, timeTicks: 665, characters: 16, product: 10640 },
  "stage-16": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 652, characters: 20, product: 13040 },
  "stage-13": { stageVersion: "2026-10-25-r3", scoringVersion: SCORING_VERSION, timeTicks: 1061, characters: 15, product: 15915 },
  "stage-17": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 1252, characters: 18, product: 22536 },
  "stage-21": { stageVersion: "2026-10-25-r3", scoringVersion: SCORING_VERSION, timeTicks: 670, characters: 36, product: 24120 },
  "stage-24": { stageVersion: "2026-10-25-r3", scoringVersion: SCORING_VERSION, timeTicks: 729, characters: 23, product: 16767 },
  "stage-20": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 706, characters: 48, product: 33888 },
  "stage-26": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 979, characters: 44, product: 43076 },
  "stage-23": { stageVersion: "2026-10-25-r3", scoringVersion: SCORING_VERSION, timeTicks: 1446, characters: 15, product: 21690 },
  "stage-25": { stageVersion: "2026-10-25-r3", scoringVersion: SCORING_VERSION, timeTicks: 1261, characters: 20, product: 25220 },
  "stage-29": { stageVersion: "2026-10-25-r3", scoringVersion: SCORING_VERSION, timeTicks: 1047, characters: 35, product: 36645 },
  "stage-14": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 652, characters: 25, product: 16300 },
  "stage-19": { stageVersion: "2026-10-25-r3", scoringVersion: SCORING_VERSION, timeTicks: 662, characters: 41, product: 27142 },
  "stage-27": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 1090, characters: 29, product: 31610 },
  "stage-30": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 1438, characters: 60, product: 86280 },
  "stage-11": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 852, characters: 27, product: 23004 },
  "stage-15": { stageVersion: "2026-10-25-r2", scoringVersion: SCORING_VERSION, timeTicks: 877, characters: 13, product: 11401 },
  "stage-22": { stageVersion: "2026-10-25-r3", scoringVersion: SCORING_VERSION, timeTicks: 997, characters: 30, product: 29910 },
  "stage-28": { stageVersion: "2026-10-25-r3", scoringVersion: SCORING_VERSION, timeTicks: 1163, characters: 37, product: 43031 },
  "stage-8": { stageVersion: "2026-10-25-r3", scoringVersion: SCORING_VERSION, timeTicks: 592, characters: 30, product: 17760 },
  "stage-9": { ...knownReferences["stage-9"]!, stageVersion: "2026-10-25-r3" },
  "stage-10": { stageVersion: "2026-10-25-r3", scoringVersion: SCORING_VERSION, timeTicks: 632, characters: 30, product: 18960 },




  "stage-5": { ...revisedReferences["stage-5"]!, stageVersion: "2026-10-20-r2" },
};

const secretDoorReferences: Record<string, Omit<ScoreReference, "stageId">> = {
  "stage-8": { stageVersion: "2026-10-25-r4", scoringVersion: SCORING_VERSION, timeTicks: 592, characters: 30, product: 17760 },
  "stage-10": { stageVersion: "2026-10-25-r4", scoringVersion: SCORING_VERSION, timeTicks: 632, characters: 30, product: 18960 },
  "stage-21": { stageVersion: "2026-10-25-r4", scoringVersion: SCORING_VERSION, timeTicks: 670, characters: 36, product: 24120 },
  "stage-23": { stageVersion: "2026-10-25-r4", scoringVersion: SCORING_VERSION, timeTicks: 1446, characters: 15, product: 21690 },
};

const riskBalancedReferences: Record<string, Omit<ScoreReference, "stageId">> = {
  "stage-14": { stageVersion: "2026-10-26-r1", scoringVersion: SCORING_VERSION, timeTicks: 652, characters: 25, product: 16300 },
  "stage-8": { stageVersion: "2026-10-25-r5", scoringVersion: SCORING_VERSION, timeTicks: 592, characters: 30, product: 17760 },
  "stage-10": { stageVersion: "2026-10-25-r5", scoringVersion: SCORING_VERSION, timeTicks: 632, characters: 30, product: 18960 },
};

export function getScoreReference(stageId: string, stageVersion: string, scoringVersion = SCORING_VERSION): ScoreReference | null {
  const value = [riskBalancedReferences[stageId], secretDoorReferences[stageId], latestReferences[stageId], revisedReferences[stageId], knownReferences[stageId]]
    .find((reference) => reference?.stageVersion === stageVersion);
  return value && [SCORING_VERSION, PREVIOUS_SCORING_VERSION].includes(scoringVersion) ? { stageId, ...value, scoringVersion } : null;
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

export function calculateScores(reference: ScoreReference, run: Pick<ScoredRun, "elapsedTicks" | "charCount" | "completionBp">) {
  positiveInteger(reference.timeTicks, "timeTicks");
  positiveInteger(reference.characters, "characters");
  positiveInteger(reference.product, "reference product");
  const product = runProduct(run);
  const rate = normalizedCompletionBp(run) / 10000;
  return {
    time: 1000 * reference.timeTicks / run.elapsedTicks * rate,
    chars: 1000 * reference.characters / run.charCount * rate,
    overall: 1000 * reference.product / product * rate,
  };
}

export function normalizedCompletionBp(run: { completionBp?: number }): number {
  const bp = run.completionBp ?? 10000;
  if (!Number.isSafeInteger(bp) || bp < 1200 || bp > 10000) throw new RangeError("completionBp must be between 1200 and 10000");
  return bp;
}

export function compareRuns(kind: ScoreKind, a: ScoredRun, b: ScoredRun): number {
  const leftProduct = runProduct(a);
  const rightProduct = runProduct(b);
  const leftBp = normalizedCompletionBp(a);
  const rightBp = normalizedCompletionBp(b);
  if (kind === "time") return a.elapsedTicks * rightBp - b.elapsedTicks * leftBp || a.charCount - b.charCount;
  if (kind === "chars") return a.charCount * rightBp - b.charCount * leftBp || a.elapsedTicks - b.elapsedTicks;
  return leftProduct * rightBp - rightProduct * leftBp || a.elapsedTicks - b.elapsedTicks || a.charCount - b.charCount;
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
