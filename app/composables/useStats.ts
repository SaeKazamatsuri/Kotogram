type Stat = { seconds: number; chars: number };
type AllStats = Record<string, Stat>;

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage ?? null;
}

function readAll(storage: Storage | null, key: string): AllStats {
  if (!storage) return {};
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as AllStats) : {};
  } catch {
    return {};
  }
}

export function useStats() {
  const key = "kotogram.stats";
  const startMap = new Map<string, number>();

  function stageStart(id: string) {
    startMap.set(id, performance.now());
  }

  function stageClear(id: string, chars: number): Stat {
    const start = startMap.get(id) ?? performance.now();
    const sec = Math.round(((performance.now() - start) / 1000) * 10) / 10;
    const record: Stat = { seconds: sec, chars };
    const storage = getStorage();
    if (storage) {
      try {
        const all = readAll(storage, key);
        all[id] = record;
        storage.setItem(key, JSON.stringify(all));
      } catch {
        storage.removeItem(key);
      }
    }
    return record;
  }

  function getAll(): AllStats {
    const storage = getStorage();
    return readAll(storage, key);
  }

  function isCleared(id: string): boolean {
    const all = getAll();
    return typeof all[id]?.seconds === "number";
  }

  function reset() {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.clear();
    } catch {}
  }

  return { stageStart, stageClear, getAll, isCleared, reset };
}
