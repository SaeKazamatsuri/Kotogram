import type { FailReason } from "~/types/game";

export type StageListItem = { id: string; title: string; file: string; version?: string };
export type StageManifest = { version?: string; stages: StageListItem[] };
export type StageMeta = {
  title?: string;
  bg?: string;
  scrollSpeed?: number;
  hint?: string;
  failHints?: Partial<Record<FailReason, string>>;
  dictionary?: { conditions?: string[]; actions?: string[]; examples?: string[] };
};
export type WallStageObject = { type: "wall"; position: number };
export type GhostStageObject = { type: "ghost"; position: number; patrolRange?: number; patrolPeriod?: number };
export type HoleStageObject = {
  type: "hole";
  position: number;
  width?: number;
};
export type GoalStageObject = { type: "goal"; position: number };
export type CoinStageObject = { type: "coin"; position: number; id?: string };
export type SwitchStageObject = { type: "switch"; position: number; id: string; targetDoorId: string; trap?: boolean; color?: "red" | "green" | "blue" | "yellow" | "purple"; shape?: "circle" | "cross" | "triangle" | "square" | "star"; sequenceStep?: number };
export type DoorStageObject = { type: "door"; position: number; id: string; breakable?: boolean; vaultable?: boolean; autoCloseTicks?: number };
export type ConveyorStageObject = { type: "conveyor"; position: number; id?: string; width: number; multiplier: number };
export type FragileFloorStageObject = { type: "fragileFloor"; position: number; id?: string; width: number; breakAfterTicks: number };
export type WindStageObject = { type: "wind"; position: number; id?: string; width: number; multiplier: number };
export type PressurePlateStageObject = { type: "pressurePlate"; position: number; id: string; width: number; holdTicks: number; targetDoorId: string };
export type MovingPlatformStageObject = { type: "movingPlatform"; position: number; id: string; width: number; travel: number; period: number };
export type LaserStageObject = { type: "laser"; position: number; id: string; period: number; activeTicks: number; phaseOffset?: number };
export type StageObject =
  | WallStageObject
  | GhostStageObject
  | HoleStageObject
  | GoalStageObject
  | CoinStageObject
  | SwitchStageObject
  | DoorStageObject
  | ConveyorStageObject
  | FragileFloorStageObject
  | WindStageObject
  | PressurePlateStageObject
  | MovingPlatformStageObject
  | LaserStageObject
  | { type: string; [key: string]: unknown };
export type StageData = {
  id?: string;
  goal?: number;
  scrollSpeed?: number;
  requiredCoins?: number;
  requiredSkips?: number;
  optionalObjectives?: boolean;
  learningObjectives?: string[];
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
    return await get<StageManifest>(manifestPath, { ttlMs: stageCacheTtlMs });
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
      return await get<StageData>(item.file, { version: item.version ?? manifest.version, ttlMs: stageCacheTtlMs });
    } catch {
      throw new Error("ステージを よみこめなかったよ。ホームから もういちど ためしてね");
    }
  }

  return { listStages, loadStage, getManifest };
}
