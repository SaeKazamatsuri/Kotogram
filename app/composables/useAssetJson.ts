// fetch + localStorageキャッシュ（version/ttl対応）
type GetOpts = { version?: string; ttlMs?: number };

export function useAssetJson() {
  const isClient = typeof window !== "undefined";
  const baseKey = "kotogram.asset";

  async function get<T = any>(path: string, opts: GetOpts = {}): Promise<T> {
    if (!isClient) return await $fetch<T>(path);
    const key = `${baseKey}:${path}`;
    const now = Date.now();
    const { version, ttlMs } = opts;

    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const cached = JSON.parse(raw) as {
          data: T;
          savedAt: number;
          version?: string;
        };
        const fresh =
          (!ttlMs || now - cached.savedAt < ttlMs) &&
          (!version || cached.version === version);
        if (fresh) return cached.data;
      }
    } catch {}

    // fetch（失敗したらキャッシュへフォールバック）
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`GET ${path} ${res.status}`);
      const data = (await res.json()) as T;
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ data, savedAt: now, version })
        );
      } catch {}
      return data;
    } catch {
      try {
        const raw = localStorage.getItem(key);
        if (raw) return (JSON.parse(raw) as any).data as T;
      } catch {}
      throw new Error(`Failed to load ${path}`);
    }
  }

  return { get };
}
