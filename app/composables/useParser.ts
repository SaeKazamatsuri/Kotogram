import { analyzeProgram, type Vocabulary } from "~/language/parser";
import type { GameRule } from "~/game/core";

export type Rule = GameRule;

export function useParser() {
  function parseProgram(lines: string[], dictionary: Vocabulary) {
    return analyzeProgram(lines, dictionary);
  }
  return { parseProgram };
}
