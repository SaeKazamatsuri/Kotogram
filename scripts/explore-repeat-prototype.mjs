import { readFileSync } from "node:fs";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { countSourceCharacters } from "../app/scoring/score.ts";
import { validateStage } from "../app/stage/validator.ts";

const stage = JSON.parse(readFileSync(new URL("../experiments/stages/repeat-sequence.json", import.meta.url), "utf8"));
const errors = validateStage(stage.id, stage, true);
if (errors.length) throw new Error(JSON.stringify(errors));
const solutions = {
  loop: "3かいくりかえす\nこいんとる\nすいっちおす\nおわり",
  expanded: Array(3).fill("1かいくりかえす\nこいんとる\nすいっちおす\nおわり").join("\n"),
  watchers: "こいんとる\nすいっちおす",
  reverse: "3かいくりかえす\nすいっちおす\nこいんとる\nおわり",
  short: "2かいくりかえす\nこいんとる\nすいっちおす\nおわり",
};
const report = Object.fromEntries(Object.entries(solutions).map(([name, source]) => {
  const parsed = analyzeProgram(source);
  if (parsed.diagnostics.length) throw new Error(JSON.stringify(parsed.diagnostics));
  const game = runToCompletion(createGame(stage, parsed.program));
  return [name, { status: game.status, reason: game.failureReason ?? null, ticks: game.elapsedTicks, chars: countSourceCharacters(source), consumed: game.sequenceConsumed.size }];
}));
console.log(JSON.stringify(report, null, 2));
if (report.loop.status !== "cleared" || report.expanded.status !== "cleared" || report.watchers.reason !== "trap" || report.reverse.reason !== "trap" || report.short.status !== "failed" || report.loop.chars >= report.expanded.chars) process.exitCode = 1;
