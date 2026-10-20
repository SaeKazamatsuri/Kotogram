import { canPlayStage, type ProgressionStage } from "./progression.ts";

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
    x: 3 + (position / Math.max(1, count - 1)) * 94,
    y: [62, 34, 66, 36, 61, 32, 64, 41][position % 8]!,
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
