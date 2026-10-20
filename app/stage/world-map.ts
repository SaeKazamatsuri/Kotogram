import { canPlayStage, type ProgressionStage } from "./progression.ts";

export type WorldMapPosition = {
  x: number;
  y: number;
  mobileX: number;
  mobileY: number;
};

const stops: readonly WorldMapPosition[] = [
  { x: 8, y: 68, mobileX: 27, mobileY: 9 },
  { x: 22, y: 32, mobileX: 72, mobileY: 22 },
  { x: 36, y: 62, mobileX: 29, mobileY: 35 },
  { x: 50, y: 24, mobileX: 71, mobileY: 48 },
  { x: 65, y: 65, mobileX: 28, mobileY: 61 },
  { x: 79, y: 35, mobileX: 71, mobileY: 74 },
  { x: 94, y: 48, mobileX: 50, mobileY: 87 },
];

export function worldMapPosition(index: number): WorldMapPosition {
  if (index < stops.length) return stops[Math.max(0, index)]!;
  const extra = index - stops.length;
  return {
    x: 94,
    y: 48,
    mobileX: extra % 2 === 0 ? 28 : 71,
    mobileY: 87 + (extra + 1) * 13,
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
