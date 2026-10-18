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
export type CoinStageObject = { type: "coin"; position: number; id?: string };
export type SwitchStageObject = { type: "switch"; position: number; id: string; targetDoorId: string };
export type DoorStageObject = { type: "door"; position: number; id: string };
export type StageObject =
  | WallStageObject
  | GhostStageObject
  | HoleStageObject
  | GoalStageObject
  | CoinStageObject
  | SwitchStageObject
  | DoorStageObject
  | { type: string; [key: string]: unknown };
export type StageData = {
  id?: string;
  goal?: number;
  scrollSpeed?: number;
  requiredCoins?: number;
  objects?: StageObject[];
  meta?: StageMeta;
  entities?: { player?: unknown; goal?: { x: number } };
  clear?: unknown;
  [key: string]: unknown;
};

export function useStageLoader() {
  const { get } = useAssetJson();
  const manifestPath = "/stages/manifest.json";
  const stageCacheTtlMs = 300000;

  async function getManifest(): Promise<StageManifest> {
    try {
      return await get<StageManifest>(manifestPath, { ttlMs: stageCacheTtlMs });
    } catch {
      return {
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
    }
  }

  async function listStages(): Promise<StageListItem[]> {
    const manifest = await getManifest();
    return manifest.stages;
  }

  async function loadStage(id: string): Promise<StageData> {
    const manifest = await getManifest();
    const item = manifest.stages.find((stage) => stage.id === id);
    if (!item) throw new Error("ステージが みつからなかったよ");
    try {
      return await get<StageData>(item.file, { version: manifest.version, ttlMs: stageCacheTtlMs });
    } catch {
      throw new Error("ステージを よみこめなかったよ。ホームから もういちど ためしてね");
    }
  }

  return { listStages, loadStage, getManifest };
}
