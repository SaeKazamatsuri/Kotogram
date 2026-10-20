import { createGame, runToCompletion, type GameStage } from "../game/core.ts";
import { analyzeProgram } from "../language/parser.ts";
import { countSourceCharacters, selectBestRuns } from "../scoring/score.ts";

export type ExplorationLimits = {
  maxCandidates?: number;
  maxTicks?: number;
  maxCharacters?: number;
  maxMs?: number;
};

export type ExploredRun = {
  source: string;
  elapsedTicks: number;
  charCount: number;
  product: number;
};

export type ExplorationReport = {
  checked: number;
  candidatePool: number;
  cleared: number;
  truncated: boolean;
  limits: Required<ExplorationLimits>;
  best: { time: ExploredRun | null; chars: ExploredRun | null; overall: ExploredRun | null };
};

function limit(value: number | undefined, fallback: number, ceiling: number, name: string): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > ceiling) {
    throw new RangeError(name + " must be an integer between 1 and " + ceiling);
  }
  return resolved;
}

export function candidatePrograms(): string[] {
  const jumps = ["", "かべとぶ", "あなとぶ", "かべとあなとぶ", "まえとぶ", "かべ3かいとぶ", "かべ4かいとぶ"];
  const programs: string[] = [];
  for (const jump of jumps) {
    for (const crouch of ["", "おばけしゃがむ"]) {
      for (const speed of ["", "はしる"]) {
        for (const coin of ["", "こいんとる"]) {
          for (const trigger of ["", "すいっちおす"]) {
            const source = [speed, jump, crouch, coin, trigger].filter(Boolean).join("\n");
            if (source) programs.push(source);
          }
        }
      }
    }
  }
  for (const count of [2, 3]) {
    const source = count + "かいくりかえす\nこいんとる\nすいっちおす\nおわり";
    programs.push(source, "はしる\n" + source);
  }
  return programs;
}

export function exploreStage(stage: GameStage, options: ExplorationLimits = {}): ExplorationReport {
  const limits: Required<ExplorationLimits> = {
    maxCandidates: limit(options.maxCandidates, 128, 1000, "maxCandidates"),
    maxTicks: limit(options.maxTicks, 20000, 100000, "maxTicks"),
    maxCharacters: limit(options.maxCharacters, 100, 2000, "maxCharacters"),
    maxMs: limit(options.maxMs, 3000, 60000, "maxMs"),
  };
  const sources = candidatePrograms();
  const started = Date.now();
  const cleared: { runId: string; source: string; elapsedTicks: number; charCount: number }[] = [];
  let checked = 0;
  let truncated = false;
  for (const source of sources) {
    if (checked >= limits.maxCandidates || Date.now() - started >= limits.maxMs) {
      truncated = true;
      break;
    }
    const charCount = countSourceCharacters(source);
    if (charCount > limits.maxCharacters) continue;
    checked++;
    const parsed = analyzeProgram(source);
    if (parsed.diagnostics.length > 0) continue;
    const game = runToCompletion(createGame(stage, parsed.program), limits.maxTicks);
    if (game.status === "cleared") {
      cleared.push({ runId: String(checked).padStart(4, "0"), source, elapsedTicks: game.elapsedTicks, charCount });
    }
  }
  const best = selectBestRuns(cleared);
  const present = (run: typeof cleared[number] | undefined): ExploredRun | null =>
    run ? { source: run.source, elapsedTicks: run.elapsedTicks, charCount: run.charCount, product: run.elapsedTicks * run.charCount } : null;
  return {
    checked, candidatePool: sources.length, cleared: cleared.length, truncated, limits,
    best: { time: present(best.time), chars: present(best.chars), overall: present(best.overall) },
  };
}
