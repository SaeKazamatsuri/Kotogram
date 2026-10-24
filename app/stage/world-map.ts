import { canPlayStage, type ProgressionStage } from "./progression.ts";

export const STAGE_WORLDS = [
  { title: "こもれびの森", start: 1, end: 10, subtitle: "はじめての ことばのぼうけん" },
  { title: "夕やけの谷", start: 11, end: 20, subtitle: "はやさと ちえの ぼうけん" },
  { title: "星あかりの国", start: 21, end: 30, subtitle: "ぜんぶの ちからを あわせよう" },
] as const;

export function worldIndexForStage(stageId: string | undefined): number {
  const number = Number(stageId?.match(/^stage-([0-9]+)$/)?.[1]);
  if (!Number.isInteger(number) || number < 1) return 0;
  return Math.min(STAGE_WORLDS.length - 1, Math.floor((number - 1) / 10));
}

export function worldPaletteForStage(stageId: string | undefined): "day" | "sunset" | "twilight" {
  return (["day", "sunset", "twilight"] as const)[worldIndexForStage(stageId)]!;
}



export type WorldMapPosition = {
  x: number;
  y: number;
  mobileX: number;
  mobileY: number;
};

export function worldMapPosition(index: number, total = 30): WorldMapPosition {
  const count = Math.max(1, total);
  const position = Math.max(0, index);
  return {
    x: 8.5 + (position / Math.max(1, count - 1)) * 83,
    y: [42, 24, 44, 24, 42, 22, 44, 27][position % 8]!,
    mobileX: position % 2 === 0 ? 30 : 70,
    mobileY: 6 + (position / Math.max(1, count - 1)) * 86,
  };
}

export function currentWorldStageId(
  stages: readonly ProgressionStage[],
  isCleared: (id: string) => boolean,
): string | null {
  return stages.find((stage) => !isCleared(stage.id) && canPlayStage(stage.id, stages, isCleared))?.id
    ?? stages[stages.length - 1]?.id
    ?? null;
}
