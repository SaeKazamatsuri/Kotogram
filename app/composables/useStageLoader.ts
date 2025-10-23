type StageListItem = { id: string; title: string; file: string };
type StageManifest = { version?: string; stages: StageListItem[] };
type StageData = {
  id: string;
  meta?: { title?: string; bg?: string; scrollSpeed?: number };
  entities?: { player?: any; goal?: { x: number } };
  clear?: any;
};

export function useStageLoader() {
  const { get } = useAssetJson();
  const manifestPath = "/stages/manifest.json";
  let manifestCache: StageManifest | null = null;

  async function getManifest(): Promise<StageManifest> {
    if (manifestCache) return manifestCache;
    try {
      const m = await get<StageManifest>(manifestPath);
      manifestCache = m;
      return m;
    } catch {
      // フォールバック（プレースホルダ）
      manifestCache = {
        version: "fallback",
        stages: [
          {
            id: "stage-1",
            title: "かべをとびこえよう",
            file: "/stages/stage-1.json",
          },
          {
            id: "stage-2",
            title: "かべとおばけ",
            file: "/stages/stage-2.json",
          },
          {
            id: "stage-3",
            title: "くりかえしに挑戦",
            file: "/stages/stage-3.json",
          },
        ],
      };
      return manifestCache;
    }
  }

  async function listStages(): Promise<StageListItem[]> {
    const m = await getManifest();
    return m.stages;
  }

  async function loadStage(id: string): Promise<StageData> {
    const m = await getManifest();
    const item = m.stages.find((s) => s.id === id);
    const version = m.version;
    if (item) {
      try {
        return await get<StageData>(item.file, { version });
      } catch {}
    }
    // 直パス or 最小フォールバック
    try {
      return await get<StageData>(`/stages/${id}.json`, { version });
    } catch {
      return {
        id,
        meta: { title: "ステージ（仮）", scrollSpeed: 2.5 },
        entities: { goal: { x: 800 } },
      };
    }
  }

  return { listStages, loadStage, getManifest };
}
