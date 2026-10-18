import {
  ENGINE_VERSION, LANGUAGE_VERSION, SCORING_VERSION, SEASON_ID,
  rankingScopeKey, selectBestRuns, type BestRuns, type ScoredRun,
} from "../scoring/score.ts";

export type Stat = { seconds: number; chars: number; elapsedTicks?: number };
type AllStats = Record<string, Stat>;
type StoredBests = Record<string, BestRuns<ScoredRun>>;

const STATS_KEY = "kotogram.stats";
const BESTS_KEY = "kotogram.bests";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readRecord<T>(storage: Storage | null, key: string): Record<string, T> {
  if (!storage) return {};
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? "{}");
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, T>
      : {};
  } catch {
    return {};
  }
}

function scopeKey(id: string, stageVersion: string) {
  return rankingScopeKey({
    seasonId: SEASON_ID,
    stageId: id,
    stageVersion,
    engineVersion: ENGINE_VERSION,
    languageVersion: LANGUAGE_VERSION,
    scoringVersion: SCORING_VERSION,
  });
}

export function useStats() {
  const startMap = new Map<string, number>();

  function stageStart(id: string) {
    startMap.set(id, performance.now());
  }

  function stageClear(
    id: string, chars: number, gameSeconds?: number,
    elapsedTicks?: number, source = "", stageVersion = "2025-10-26",
  ): Stat {
    const start = startMap.get(id) ?? performance.now();
    const isOfficial = Number.isSafeInteger(elapsedTicks) && elapsedTicks !== undefined && elapsedTicks > 0;
    const seconds = isOfficial ? elapsedTicks! / 60 : gameSeconds ?? (performance.now() - start) / 1000;
    const record: Stat = {
      seconds: Math.round(seconds * 10) / 10,
      chars,
      ...(isOfficial ? { elapsedTicks } : {}),
    };
    const storage = getStorage();
    if (!storage) return record;
    try {
      const all = readRecord<Stat>(storage, STATS_KEY);
      all[id] = record;
      storage.setItem(STATS_KEY, JSON.stringify(all));
      if (isOfficial && Number.isSafeInteger(chars) && chars > 0) {
        const allBests = readRecord<BestRuns<ScoredRun>>(storage, BESTS_KEY);
        const key = scopeKey(id, stageVersion);
        const previous = allBests[key] ?? {};
        const run: ScoredRun = {
          runId: typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
          elapsedTicks: elapsedTicks!,
          charCount: chars,
          source,
        };
        allBests[key] = selectBestRuns([...Object.values(previous), run].filter(
          (item): item is ScoredRun => !!item && typeof item.runId === "string",
        ));
        storage.setItem(BESTS_KEY, JSON.stringify(allBests));
      }
    } catch {
      return record;
    }
    return record;
  }

  function getBestRecords(id: string, stageVersion: string): BestRuns<ScoredRun> {
    return readRecord<BestRuns<ScoredRun>>(getStorage(), BESTS_KEY)[scopeKey(id, stageVersion)] ?? {};
  }

  function getAll(): AllStats {
    return readRecord<Stat>(getStorage(), STATS_KEY);
  }

  function isCleared(id: string): boolean {
    return typeof getAll()[id]?.seconds === "number";
  }

  function reset() {
    const storage = getStorage();
    if (!storage) return;
    for (const key of [STATS_KEY, BESTS_KEY, "kotogram.player", "kotogram.nickname", "kotogram.editor"]) {
      try {
        storage.removeItem(key);
      } catch {}
    }
    startMap.clear();
  }

  return { stageStart, stageClear, getAll, getBestRecords, isCleared, reset };
}
