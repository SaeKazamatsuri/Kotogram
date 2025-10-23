// ステージ毎の経過秒 & 文字数を localStorage 永続化
type Stat = { seconds: number; chars: number };
type AllStats = Record<string, Stat>;

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
    try {
      const all: AllStats = JSON.parse(localStorage.getItem(key) || "{}");
      all[id] = record;
      localStorage.setItem(key, JSON.stringify(all));
    } catch {}
    return record;
  }

  function getAll(): AllStats {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      return {};
    }
  }

  return { stageStart, stageClear, getAll };
}
