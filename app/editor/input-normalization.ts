export function sanitizeCodeInput(input: string): string {
  const hiragana = input.normalize("NFC").replace(/[ァ-ヶ]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60));
  return (hiragana.match(/[ぁ-ゟー0-9０-９ \u3000\r\n]/g) ?? []).join("");
}

export function codeInputNotice(input: string): string | null {
  const normalized = input.normalize("NFC");
  const hiragana = normalized.replace(/[ァ-ヶ]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60));
  if (sanitizeCodeInput(input) !== hiragana) {
    return "ひらがなと すうじで かいてね。つかえない もじは はいらないよ。";
  }
  if (hiragana !== normalized) {
    return "かたかなを ひらがなに なおしたよ。";
  }
  return null;
}
