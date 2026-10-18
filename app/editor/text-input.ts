export type TextSelection = { text: string; start: number; end: number };
export type SoftKey =
  | { kind: "insert"; text: string }
  | { kind: "backspace" | "left" | "right" | "dakuten" | "handakuten" | "small" };

const voicedPairs = [
  ["かきくけこ", "がぎぐげご"],
  ["さしすせそ", "ざじずぜぞ"],
  ["たちつてと", "だぢづでど"],
  ["はひふへほ", "ばびぶべぼ"],
  ["う", "ゔ"],
];
const semiVoicedPairs = [["はひふへほ", "ぱぴぷぺぽ"]];
const smallPairs = [["あいうえおつやゆよわ", "ぁぃぅぇぉっゃゅょゎ"]];

function characterMap(pairs: string[][]): Map<string, string> {
  const result = new Map<string, string>();
  for (const [normal, modified] of pairs) {
    const original = [...normal];
    const replacement = [...modified];
    for (let i = 0; i < original.length; i++) {
      result.set(original[i], replacement[i]);
      result.set(replacement[i], original[i]);
    }
  }
  return result;
}

const voiced = characterMap(voicedPairs);
const semiVoiced = characterMap(semiVoicedPairs);
const small = characterMap(smallPairs);

export function editWithSoftKey(state: TextSelection, key: SoftKey): TextSelection {
  const { text } = state;
  const start = Math.min(text.length, Math.max(0, state.start));
  const end = Math.min(text.length, Math.max(start, state.end));
  const replace = (replacement: string, from = start, to = end): TextSelection => {
    const updated = text.slice(0, from) + replacement + text.slice(to);
    const pos = from + replacement.length;
    return { text: updated, start: pos, end: pos };
  };

  if (key.kind === "insert") return replace(key.text);
  if (key.kind === "backspace") return start === end && start > 0 ? replace("", start - 1, start) : replace("");
  if (key.kind === "left") {
    const pos = start === end ? Math.max(0, start - 1) : start;
    return { text, start: pos, end: pos };
  }
  if (key.kind === "right") {
    const pos = start === end ? Math.min(text.length, end + 1) : end;
    return { text, start: pos, end: pos };
  }
  const table = key.kind === "dakuten" ? voiced : key.kind === "handakuten" ? semiVoiced : small;
  const from = start < end && end - start === 1 ? start : start - 1;
  if (from < 0 || from >= text.length) return { text, start, end };
  const replacement = table.get(text[from]);
  if (!replacement) return { text, start, end };
  return replace(replacement, from, from + 1);
}
