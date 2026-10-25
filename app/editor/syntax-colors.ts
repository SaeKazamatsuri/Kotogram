import type { Token, TokenKind } from "../language/parser.ts";

export type SyntaxPiece = { text: string; kind: TokenKind | "plain" };

export function syntaxPieces(line: string, tokens: readonly Token[]): SyntaxPiece[] {
  const pieces: SyntaxPiece[] = [];
  let cursor = 0;
  for (const token of [...tokens].sort((a, b) => a.column - b.column)) {
    const start = Math.max(cursor, Math.min(line.length, token.column - 1));
    const end = Math.min(line.length, Math.max(start, (token.endColumn ?? token.column + token.raw.length) - 1));
    if (cursor < start) pieces.push({ text: line.slice(cursor, start), kind: "plain" });
    if (start < end) pieces.push({ text: line.slice(start, end), kind: token.kind });
    cursor = end;
  }
  if (cursor < line.length) pieces.push({ text: line.slice(cursor), kind: "plain" });
  return pieces;
}

export const TOKEN_CLASS: Record<TokenKind | "plain", string> = {
  condition: "text-[#155e75] underline decoration-2 decoration-[#155e75]",
  action: "text-[#6d28d9] font-bold",
  attribute: "text-[#92400e] bg-[#ffedca] underline decoration-dotted decoration-2",
  number: "text-[#9a3412] font-bold",
  count: "text-[#1d4ed8]",
  repeat: "text-[#1d4ed8] underline decoration-dashed",
  end: "text-[#1d4ed8] underline decoration-dashed",
  if: "text-[#1d4ed8] underline decoration-dashed",
  then: "text-[#475569]",
  or: "text-[#475569]",
  particle: "text-[#475569]",
  unknown: "text-[#9f1239] underline decoration-wavy",
  plain: "text-[#172439]",
};
