const STORAGE_KEY = "kotogram.clearedStageCodes";

type StageStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function sessionStorageOrNull(): StageStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readAll(storage: StageStorage): Record<string, string> {
  try {
    const value: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(
      ([key, code]) => /^stage-\d+$/.test(key) && typeof code === "string",
    ));
  } catch {
    return {};
  }
}

export function getClearedStageCode(stageId: string, storage: StageStorage | null = sessionStorageOrNull()): string {
  if (!storage || !/^stage-\d+$/.test(stageId)) return "";
  return readAll(storage)[stageId] ?? "";
}

export function saveClearedStageCode(stageId: string, code: string, storage: StageStorage | null = sessionStorageOrNull()): void {
  if (!storage || !/^stage-\d+$/.test(stageId) || !code) return;
  try {
    const all = readAll(storage);
    all[stageId] = code;
    storage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    return;
  }
}

export function clearClearedStageCodes(storage: StageStorage | null = sessionStorageOrNull()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}
