import { analyzeProgram, type Statement } from "../language/parser.ts";

export type MasteryResult = {
  loopChallenge: boolean;
  repeatUsed: boolean;
  secretFound: boolean;
  alternateChallenge: boolean;
};

const repeatStages = new Set([8, 9, 10, 14, 17, 19, 20, 22, 27, 28, 30]);
const alternateStages = new Set([12, 13, 16, 18, 21, 24, 25, 26, 29, 30]);

function isRepeated(statements: Statement[]): boolean {
  return statements.some((statement) =>
    statement.kind === "repeat" || (statement.kind === "if" && isRepeated(statement.body)));
}

export function stageMastery(stageId: string, source: string): MasteryResult {
  const id = Number(stageId.match(/^stage-(\d+)$/)?.[1]);
  const parsed = analyzeProgram(source);
  if (parsed.diagnostics.length) return { loopChallenge: false, repeatUsed: false, secretFound: false, alternateChallenge: false };
  const repeatUsed = isRepeated(parsed.body);
  const secretFound = parsed.program.watchers.some((rule) => rule.action === "powerJump" || rule.action === "sprint")
    || parsed.program.steps.some((step) => (step.op === "action" || step.op === "wait") && (step.action === "powerJump" || step.action === "sprint"));
  return {
    loopChallenge: repeatStages.has(id),
    repeatUsed,
    secretFound,
    alternateChallenge: alternateStages.has(id),
  };
}
