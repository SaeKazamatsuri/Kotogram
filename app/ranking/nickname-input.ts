import { editWithSoftKey, type SoftKey, type TextSelection } from "../editor/text-input.ts";

export function editNicknameWithSoftKey(state: TextSelection, key: SoftKey): TextSelection {
  const updated = editWithSoftKey(state, key);
  const text = updated.text.replace(/[\r\n]/g, "").slice(0, 16);
  const start = Math.min(updated.start, text.length);
  const end = Math.min(updated.end, text.length);
  return { text, start, end };
}
