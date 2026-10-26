export type KeyboardContext = "code" | "nickname";

type KeyboardStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const keys: Record<KeyboardContext, string> = {
  code: "kotogram.keyboard.code",
  nickname: "kotogram.keyboard.nickname",
};

function currentStorage(): KeyboardStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getKeyboardExpanded(context: KeyboardContext, storage: KeyboardStorage | null = currentStorage()): boolean {
  try {
    return storage?.getItem(keys[context]) === "open";
  } catch {
    return false;
  }
}

export function setKeyboardExpanded(context: KeyboardContext, expanded: boolean, storage: KeyboardStorage | null = currentStorage()): void {
  try {
    storage?.setItem(keys[context], expanded ? "open" : "closed");
  } catch {
    return;
  }
}

export function clearKeyboardPreferences(storage: KeyboardStorage | null = currentStorage()): void {
  for (const key of Object.values(keys)) {
    try {
      storage?.removeItem(key);
    } catch {
      continue;
    }
  }
}
