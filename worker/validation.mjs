import {
  ENGINE_VERSION, LANGUAGE_VERSION, PREVIOUS_LANGUAGE_VERSION, LEGACY_LANGUAGE_VERSION, SCORING_VERSION, SEASON_ID,
  countSourceCharacters, getScoreReference, rankingScopeKey,
} from "../app/scoring/score.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { isValidId } from "../app/ranking/identity.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import stage1 from "../public/stages/stage-1.json" with { type: "json" };
import stage2 from "../public/stages/stage-2.json" with { type: "json" };
import stage3 from "../public/stages/stage-3.json" with { type: "json" };
import stage4 from "../public/stages/stage-4.json" with { type: "json" };
import stage5 from "../public/stages/stage-5.json" with { type: "json" };
import stage6 from "../public/stages/stage-6.json" with { type: "json" };
import stage7 from "../public/stages/stage-7.json" with { type: "json" };
import stage8 from "../public/stages/stage-8.json" with { type: "json" };
import manifest from "../public/stages/manifest.json" with { type: "json" };

const safeName = /^[^\p{Cc}\p{Cf}<>]*$/u;
const replayStages = new Map([
  ["stage-1", stage1],
  ["stage-2", stage2],
  ["stage-3", stage3],
  ["stage-4", stage4],
  ["stage-5", stage5],
  ["stage-6", stage6],
  ["stage-7", stage7],
  ["stage-8", stage8],
]);
export const replayStageIds = [...replayStages.keys()];
const currentStageVersions = new Map(manifest.stages.map((entry) => [entry.id, entry.version ?? manifest.version]));
const MAX_REPLAY_TICKS = 20000;

function requiredString(value, key) {
  if (typeof value !== "string" || value.length === 0) throw new RangeError(key + " is required");
  return value;
}

export function validateScope(input) {
  if (!input || typeof input !== "object") throw new RangeError("scope is required");
  const scope = {
    seasonId: requiredString(input.seasonId, "seasonId"),
    stageId: requiredString(input.stageId, "stageId"),
    stageVersion: requiredString(input.stageVersion, "stageVersion"),
    engineVersion: requiredString(input.engineVersion, "engineVersion"),
    languageVersion: requiredString(input.languageVersion, "languageVersion"),
    scoringVersion: requiredString(input.scoringVersion, "scoringVersion"),
  };
  if (
    scope.seasonId !== SEASON_ID ||
    scope.engineVersion !== ENGINE_VERSION ||
    ![LANGUAGE_VERSION, PREVIOUS_LANGUAGE_VERSION, LEGACY_LANGUAGE_VERSION].includes(scope.languageVersion) ||
    scope.scoringVersion !== SCORING_VERSION ||
    !getScoreReference(scope.stageId, scope.stageVersion)
  ) throw new RangeError("unsupported ranking scope");
  return scope;
}

export function validateRunPayload(input) {
  const scope = validateScope(input);
  if (scope.stageVersion !== currentStageVersions.get(scope.stageId)) throw new RangeError("old stage version is read-only");
  if (scope.languageVersion !== LANGUAGE_VERSION) throw new RangeError("old language version is read-only");
  const runId = requiredString(input.runId, "runId");
  const playerId = requiredString(input.playerId, "playerId");
  if (!isValidId(runId) || !isValidId(playerId)) throw new RangeError("invalid runId or playerId");
  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : "";
  if ([...nickname].length > 16 || !safeName.test(nickname)) throw new RangeError("invalid nickname");
  const source = requiredString(input.source, "source");
  if (source.length > 2000 || new TextEncoder().encode(source).length > 8192) throw new RangeError("source too long");
  if (analyzeProgram(source).diagnostics.length) throw new RangeError("invalid program");
  if (!Number.isSafeInteger(input.elapsedTicks) || input.elapsedTicks < 1 || input.elapsedTicks > 100000) throw new RangeError("invalid elapsedTicks");
  if (!Number.isSafeInteger(input.charCount) || input.charCount < 1 || input.charCount > 2000) throw new RangeError("invalid charCount");
  if (countSourceCharacters(source) !== input.charCount) throw new RangeError("charCount does not match source");
  return { ...scope, runId, playerId, nickname, source, elapsedTicks: input.elapsedTicks, charCount: input.charCount };
}

export function verifyRunResult(input) {
  const stage = replayStages.get(input.stageId);
  if (!stage) throw new RangeError("unknown stage for replay");
  const parsed = analyzeProgram(input.source);
  if (parsed.diagnostics.length) throw new RangeError("invalid program");
  const game = runToCompletion(createGame(stage, parsed.program), MAX_REPLAY_TICKS);
  if (game.status !== "cleared" || game.elapsedTicks !== input.elapsedTicks) {
    throw new RangeError("run does not match verified clear time");
  }
  return game.elapsedTicks;
}

export function sameRun(a, b) {
  return a.runId === b.runId && a.playerId === b.playerId &&
    a.elapsedTicks === b.elapsedTicks && a.charCount === b.charCount && a.source === b.source;
}

export function scopeObjectId(scope) {
  return rankingScopeKey(validateScope(scope));
}
