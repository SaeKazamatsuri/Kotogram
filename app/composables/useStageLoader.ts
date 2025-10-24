import type { FailReason } from "~/types/game";

export type StageListItem = { id: string; title: string; file: string };
export type StageManifest = { version?: string; stages: StageListItem[] };
export type StageMeta = {
  title?: string;
  bg?: string;
  scrollSpeed?: number;
  hint?: string;
  failHints?: Partial<Record<FailReason, string>>;
};
export type WallStageObject = { type: "wall"; position: number };
export type GhostStageObject = { type: "ghost"; position: number };
export type HoleStageObject = {
  type: "hole";
  position: number;
  width?: number;
};
export type GoalStageObject = { type: "goal"; position: number };
export type StageObject =
  | WallStageObject
  | GhostStageObject
  | HoleStageObject
  | GoalStageObject
  | { type: string; [key: string]: unknown };
export type StageData = {
  id?: string;
  goal?: number;
  scrollSpeed?: number;
  objects?: StageObject[];
  meta?: StageMeta;
  entities?: { player?: unknown; goal?: { x: number } };
  clear?: unknown;
  [key: string]: unknown;
};

export function useStageLoader() {
  const { get } = useAssetJson();
  const manifestPath = "/stages/manifest.json";
  let manifestCache: StageManifest | null = null;

  async function getManifest(): Promise<StageManifest> {
    if (manifestCache) return manifestCache;
    try {
      const manifest = await get<StageManifest>(manifestPath);
      manifestCache = manifest;
      return manifest;
    } catch {
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
            title: "かべとおばけをよけよう",
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
    const manifest = await getManifest();
    return manifest.stages;
  }

  async function loadStage(id: string): Promise<StageData> {
    const manifest = await getManifest();
    const item = manifest.stages.find((stage) => stage.id === id);
    const version = manifest.version;
    if (item) {
      try {
        return await get<StageData>(item.file, { version });
      } catch {
        /* noop */
      }
    }
    try {
      return await get<StageData>(`/stages/${id}.json`, { version });
    } catch {
      return {
        id,
        goal: 800,
        scrollSpeed: 2.5,
        meta: { title: "ステージ（仮）" },
      };
    }
  }

  return { listStages, loadStage, getManifest };
}
