export type ProgressionStage = { id: string };

export function canPlayStage(
  id: string,
  stages: readonly ProgressionStage[],
  isCleared: (id: string) => boolean,
): boolean {
  const index = stages.findIndex((stage) => stage.id === id);
  return index === 0 || (index > 0 && isCleared(stages[index - 1]!.id));
}

export function nextStageId(
  id: string,
  stages: readonly ProgressionStage[],
): string | null {
  const index = stages.findIndex((stage) => stage.id === id);
  return index < 0 ? null : stages[index + 1]?.id ?? null;
}
