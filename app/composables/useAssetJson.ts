type GetOpts = { version?: string; ttlMs?: number };
type CachedAsset<T> = { data: T; savedAt: number; version?: string };

export function useAssetJson() {
  const isClient = typeof window !== "undefined";
  const baseKey = "kotogram.asset";

  async function get<T = unknown>(path: string, opts: GetOpts = {}): Promise<T> {
    if (!isClient) return await $fetch<T>(path);
    const key = baseKey + ":" + path;
    const now = Date.now();
    const { version, ttlMs } = opts;

    function readCache(): CachedAsset<T> | null {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (parsed === null || typeof parsed !== "object" || !("data" in parsed)) return null;
        return parsed as CachedAsset<T>;
      } catch {
        return null;
      }
    }

    const cached = readCache();
    if (cached && (!ttlMs || now - cached.savedAt < ttlMs) && (!version || cached.version === version)) {
      return cached.data;
    }

    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw new Error("GET " + path + " " + response.status);
      const data = (await response.json()) as T;
      try {
        localStorage.setItem(key, JSON.stringify({ data, savedAt: now, version }));
      } catch {
        return data;
      }
      return data;
    } catch {
      const fallback = readCache();
      if (fallback && (!version || fallback.version === version)) return fallback.data;
      throw new Error("Failed to load " + path);
    }
  }

  return { get };
}
